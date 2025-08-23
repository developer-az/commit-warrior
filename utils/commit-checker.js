const GitHubApiClient = require('./api-client');
const DateUtils = require('./date-utils');
const Logger = require('./logger');

class CommitChecker {
  constructor(username, token) {
    this.username = username;
    this.token = token;
    this.apiClient = new GitHubApiClient(token);
    this.logger = new Logger('CommitChecker');
  }

  // Main method to check commits with improved reliability
  async checkCommits() {
    if (!this.username || !this.token) {
      return {
        success: false,
        message: 'GitHub credentials not set',
        error: 'MISSING_CREDENTIALS'
      };
    }

    try {
      this.logger.info('Starting commit check', { username: this.username });
      this.logger.time('commitCheck');
      
      const today = DateUtils.getTodayInUserTimezone();
      this.logger.debug('Checking commits for date', { date: today });

      // First validate the token
      const tokenValidation = await this.apiClient.validateToken();
      if (!tokenValidation.valid) {
        return {
          success: false,
          message: `Invalid token: ${tokenValidation.error}`,
          error: 'INVALID_TOKEN'
        };
      }

      this.logger.debug('Token validated', { user: tokenValidation.user.login });

      // Use a primary method (Events API) with fallback
      let result;
      try {
        result = await this._checkCommitsViaEvents(today);
      } catch (error) {
        this.logger.warn('Events API failed, trying repositories method', { error: error.message });
        result = await this._checkCommitsViaRepositories(today);
      }

      // Calculate streak
      const streakInfo = await this._calculateStreak();
      
      const finalResult = {
        success: true,
        hasCommitted: result.hasCommitted,
        commitCount: result.commitCount,
        streak: streakInfo.streak,
        lastCommitDate: streakInfo.lastCommitDate,
        method: result.method,
        rateLimitRemaining: this.apiClient.remainingRequests
      };

      this.logger.timeEnd('commitCheck');
      this.logger.logCommitResult(finalResult);
      return finalResult;

    } catch (error) {
      this.logger.error('Error checking GitHub commits', { error: error.message, stack: error.stack });
      
      // Provide better error messages
      let message = 'Failed to check commits';
      let errorCode = 'UNKNOWN_ERROR';
      
      if (error.response?.status === 401) {
        message = 'Invalid GitHub token. Please check your token has the correct permissions.';
        errorCode = 'INVALID_TOKEN';
      } else if (error.response?.status === 403) {
        if (error.response.headers['x-ratelimit-remaining'] === '0') {
          message = 'Rate limit exceeded. Please try again later.';
          errorCode = 'RATE_LIMIT_EXCEEDED';
        } else {
          message = 'Access forbidden. Your token may need additional permissions.';
          errorCode = 'ACCESS_FORBIDDEN';
        }
      } else if (error.response?.status >= 500) {
        message = 'GitHub API is currently unavailable. Please try again later.';
        errorCode = 'API_UNAVAILABLE';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        message = 'Network error. Please check your internet connection.';
        errorCode = 'NETWORK_ERROR';
      }

      return {
        success: false,
        message,
        error: errorCode,
        details: error.message
      };
    }
  }

  // Primary method: Check commits via Events API
  async _checkCommitsViaEvents(today) {
    console.log('Checking commits via Events API');
    
    const events = await this.apiClient.getUserEvents(this.username, 100);
    console.log(`Retrieved ${events.length} events`);

    // Filter today's push events
    const todayEvents = events.filter(event => {
      const eventDate = DateUtils.getDateFromISOString(event.created_at);
      return DateUtils.isToday(eventDate) && event.type === 'PushEvent';
    });

    let commitCount = 0;
    const commitDetails = [];

    for (const event of todayEvents) {
      if (event.payload && event.payload.commits) {
        const commits = event.payload.commits.filter(commit => 
          commit.author && commit.author.email && 
          commit.author.name && 
          !commit.message.toLowerCase().includes('merge')
        );
        
        commitCount += commits.length;
        
        commits.forEach(commit => {
          commitDetails.push({
            sha: commit.sha,
            message: commit.message,
            repository: event.repo.name,
            timestamp: event.created_at
          });
        });
      }
    }

    console.log(`Found ${commitCount} commits today via Events API`);

    return {
      hasCommitted: commitCount > 0,
      commitCount,
      details: commitDetails,
      method: 'events'
    };
  }

  // Fallback method: Check commits via Repositories API
  async _checkCommitsViaRepositories(today) {
    console.log('Checking commits via Repositories API');
    
    const repos = await this.apiClient.getUserRepos(this.username, 50);
    console.log(`Retrieved ${repos.length} repositories`);

    // Filter to recently updated repositories
    const recentRepos = repos.filter(repo => {
      if (!repo.updated_at) return false;
      const updatedDate = DateUtils.getDateFromISOString(repo.updated_at);
      const daysSinceUpdate = DateUtils.daysBetween(updatedDate, today);
      return daysSinceUpdate <= 7; // Only check repos updated in last week
    }).slice(0, 20); // Limit to 20 repos to avoid rate limits

    console.log(`Checking ${recentRepos.length} recently updated repositories`);

    let totalCommitCount = 0;
    const commitDetails = [];

    // Check commits in parallel but with concurrency limit
    const concurrencyLimit = 3;
    for (let i = 0; i < recentRepos.length; i += concurrencyLimit) {
      const batch = recentRepos.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (repo) => {
        try {
          const commits = await this.apiClient.getRepoCommits(
            this.username, 
            repo.name, 
            {
              author: this.username,
              since: DateUtils.getStartOfDayUTC(today),
              until: DateUtils.getEndOfDayUTC(today),
              perPage: 50
            }
          );

          if (commits.length > 0) {
            console.log(`Repository ${repo.name}: found ${commits.length} commits today`);
            
            commits.forEach(commit => {
              commitDetails.push({
                sha: commit.sha,
                message: commit.commit.message,
                repository: repo.name,
                timestamp: commit.commit.author.date
              });
            });
            
            return commits.length;
          }
          return 0;
        } catch (error) {
          console.warn(`Error checking commits for repo ${repo.name}:`, error.message);
          return 0;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      totalCommitCount += batchResults.reduce((sum, count) => sum + count, 0);
    }

    console.log(`Found ${totalCommitCount} commits today via Repositories API`);

    return {
      hasCommitted: totalCommitCount > 0,
      commitCount: totalCommitCount,
      details: commitDetails,
      method: 'repositories'
    };
  }

  // Calculate streak based on recent contribution activity
  async _calculateStreak() {
    try {
      console.log('Calculating contribution streak');
      
      const events = await this.apiClient.getUserEvents(this.username, 300);
      
      // Get contribution events from the last 90 days
      const cutoffDate = DateUtils.getDaysAgo(90);
      const contributionEvents = events.filter(event => {
        const eventDate = DateUtils.getDateFromISOString(event.created_at);
        return ['PushEvent', 'CreateEvent', 'PullRequestEvent', 'IssuesEvent']
          .includes(event.type) && eventDate >= cutoffDate;
      });

      // Group events by date
      const contributionDates = new Set();
      let lastCommitDate = null;

      contributionEvents.forEach(event => {
        const eventDate = DateUtils.getDateFromISOString(event.created_at);
        contributionDates.add(eventDate);
        
        if (event.type === 'PushEvent' && (!lastCommitDate || eventDate > lastCommitDate)) {
          lastCommitDate = eventDate;
        }
      });

      const sortedDates = Array.from(contributionDates).sort((a, b) => new Date(b) - new Date(a));
      console.log('Recent contribution dates:', sortedDates.slice(0, 10));

      // Calculate streak
      let streak = 0;
      const today = DateUtils.getTodayInUserTimezone();
      const yesterday = DateUtils.getYesterdayInUserTimezone();

      // Start from today if there's a contribution, otherwise from yesterday
      let currentDate = sortedDates.includes(today) ? today : 
                        (sortedDates.includes(yesterday) ? yesterday : null);

      if (currentDate) {
        streak = 1;
        
        // Count backwards for consecutive days
        let checkDate = new Date(currentDate);
        checkDate.setDate(checkDate.getDate() - 1);
        
        while (true) {
          const dateStr = DateUtils.getDateFromISOString(checkDate.toISOString());
          
          if (sortedDates.includes(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      console.log(`Calculated streak: ${streak} days`);

      return {
        streak,
        lastCommitDate,
        contributionDates: sortedDates.slice(0, 30) // Keep recent 30 days for debugging
      };

    } catch (error) {
      console.error('Error calculating streak:', error);
      return {
        streak: 0,
        lastCommitDate: null,
        contributionDates: []
      };
    }
  }

  // Get rate limit info
  async getRateLimitInfo() {
    try {
      return await this.apiClient.getRateLimit();
    } catch (error) {
      console.error('Error getting rate limit info:', error);
      return null;
    }
  }
}

module.exports = CommitChecker;