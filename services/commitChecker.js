const logger = require('./logger');
const GitHubAPIService = require('./githubAPI');
const { createUserFriendlyError } = require('./errorHandler');

class CommitChecker {
  constructor() {
    this.githubAPI = new GitHubAPIService();
  }

  async checkTodaysCommits(username, token) {
    const today = new Date().toISOString().split('T')[0];
    logger.info(`Starting commit check for ${username} on ${today}`);
    
    const results = {
      date: today,
      username,
      methods: {},
      finalResult: {
        hasCommitted: false,
        commitCount: 0,
        streak: 0
      }
    };

    try {
      // Method 1: Search API
      results.methods.searchAPI = await this.checkViaSearchAPI(username, token, today);
      
      // Method 2: Events API
      results.methods.eventsAPI = await this.checkViaEventsAPI(username, token, today);
      
      // Method 3: Repository commits
      results.methods.repoAPI = await this.checkViaRepositoryAPI(username, token, today);
      
      // Calculate streak
      results.methods.streakCalculation = await this.calculateStreak(username, token);
      
      // Determine final result
      results.finalResult = this.consolidateResults(results.methods);
      
      logger.info('Commit check completed', {
        username,
        date: today,
        result: results.finalResult
      });
      
      return results;
      
    } catch (error) {
      logger.error('Commit check failed', {
        username,
        error: error.message,
        details: error.details
      });
      
      throw error;
    }
  }

  async checkViaSearchAPI(username, token, date) {
    const method = 'SearchAPI';
    logger.info(`${method}: Checking commits via Search API`);
    
    try {
      const response = await this.githubAPI.searchCommits(username, token, date);
      const commitCount = response.data.total_count || 0;
      const hasCommitted = commitCount > 0;
      
      logger.info(`${method}: Found ${commitCount} commits`, {
        hasCommitted,
        incompleteResults: response.data.incomplete_results
      });
      
      return {
        success: true,
        commitCount,
        hasCommitted,
        method,
        details: {
          totalCount: response.data.total_count,
          incompleteResults: response.data.incomplete_results,
          commits: response.data.items?.slice(0, 3)?.map(commit => ({
            sha: commit.sha.substring(0, 7),
            message: commit.commit.message.split('\n')[0],
            repository: commit.repository.name,
            date: commit.commit.committer.date
          })) || []
        }
      };
      
    } catch (error) {
      logger.warn(`${method}: Failed`, error.message);
      
      return {
        success: false,
        error: error.message,
        method,
        commitCount: 0,
        hasCommitted: false
      };
    }
  }

  async checkViaEventsAPI(username, token, date) {
    const method = 'EventsAPI';
    logger.info(`${method}: Checking commits via Events API`);
    
    try {
      const response = await this.githubAPI.getUserEvents(username, token);
      const todayEvents = response.data.filter(event => {
        const eventDate = new Date(event.created_at).toISOString().split('T')[0];
        return eventDate === date && event.type === 'PushEvent';
      });
      
      let commitCount = 0;
      const commitDetails = [];
      
      for (const event of todayEvents) {
        if (event.payload && event.payload.commits) {
          const eventCommits = event.payload.commits.length;
          commitCount += eventCommits;
          
          commitDetails.push({
            repository: event.repo.name,
            commits: eventCommits,
            time: event.created_at,
            commits_sample: event.payload.commits.slice(0, 2).map(c => ({
              sha: c.sha.substring(0, 7),
              message: c.message.split('\n')[0]
            }))
          });
        }
      }
      
      const hasCommitted = commitCount > 0;
      
      logger.info(`${method}: Found ${commitCount} commits in ${todayEvents.length} push events`, {
        hasCommitted,
        eventsChecked: response.data.length
      });
      
      return {
        success: true,
        commitCount,
        hasCommitted,
        method,
        details: {
          totalEvents: response.data.length,
          pushEvents: todayEvents.length,
          commitDetails
        }
      };
      
    } catch (error) {
      logger.warn(`${method}: Failed`, error.message);
      
      return {
        success: false,
        error: error.message,
        method,
        commitCount: 0,
        hasCommitted: false
      };
    }
  }

  async checkViaRepositoryAPI(username, token, date) {
    const method = 'RepositoryAPI';
    logger.info(`${method}: Checking commits via Repository API`);
    
    try {
      const reposResponse = await this.githubAPI.getUserRepositories(username, token);
      
      // Filter to recently updated repos
      const todayTimestamp = new Date(date).getTime();
      const recentRepos = reposResponse.data.filter(repo => {
        const updatedDate = new Date(repo.updated_at).toISOString().split('T')[0];
        return updatedDate === date || 
               (new Date(repo.updated_at).getTime() > todayTimestamp - 7 * 24 * 60 * 60 * 1000);
      });
      
      // If no recent repos, check the 15 most recently updated ones
      const reposToCheck = recentRepos.length > 0 ? recentRepos : reposResponse.data.slice(0, 15);
      
      logger.info(`${method}: Checking ${reposToCheck.length} repositories`, {
        totalRepos: reposResponse.data.length,
        recentRepos: recentRepos.length
      });
      
      let totalCommits = 0;
      const repoResults = [];
      
      for (const repo of reposToCheck) {
        try {
          const commitsResponse = await this.githubAPI.getRepositoryCommits(username, repo.name, token, {
            author: username,
            since: `${date}T00:00:00Z`,
            until: `${date}T23:59:59Z`,
            per_page: 100
          });
          
          const repoCommits = commitsResponse.data.length;
          totalCommits += repoCommits;
          
          if (repoCommits > 0) {
            repoResults.push({
              name: repo.name,
              commits: repoCommits,
              commitDetails: commitsResponse.data.slice(0, 3).map(commit => ({
                sha: commit.sha.substring(0, 7),
                message: commit.commit.message.split('\n')[0],
                date: commit.commit.committer.date
              }))
            });
          }
          
        } catch (error) {
          logger.warn(`${method}: Error checking repo ${repo.name}`, error.message);
          // Continue with other repos
        }
      }
      
      const hasCommitted = totalCommits > 0;
      
      logger.info(`${method}: Found ${totalCommits} commits across ${repoResults.length} repositories`);
      
      return {
        success: true,
        commitCount: totalCommits,
        hasCommitted,
        method,
        details: {
          totalReposChecked: reposToCheck.length,
          reposWithCommits: repoResults.length,
          repoResults
        }
      };
      
    } catch (error) {
      logger.warn(`${method}: Failed`, error.message);
      
      return {
        success: false,
        error: error.message,
        method,
        commitCount: 0,
        hasCommitted: false
      };
    }
  }

  async calculateStreak(username, token) {
    logger.info('Calculating commit streak');
    
    try {
      const response = await this.githubAPI.getUserEvents(username, token, 100);
      
      // Extract contribution dates
      const contributionDates = new Set();
      
      for (const event of response.data) {
        if (['PushEvent', 'CreateEvent', 'PullRequestEvent', 'IssuesEvent', 
             'PullRequestReviewEvent', 'CommitCommentEvent'].includes(event.type)) {
          const eventDate = new Date(event.created_at).toISOString().split('T')[0];
          contributionDates.add(eventDate);
        }
      }
      
      const sortedDates = Array.from(contributionDates).sort((a, b) => new Date(b) - new Date(a));
      
      // Calculate streak
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const committedToday = sortedDates.includes(today);
      const committedYesterday = sortedDates.includes(yesterdayStr);
      
      let streak = 0;
      let startDate = null;
      
      if (committedToday) {
        startDate = today;
        streak = 1;
      } else if (committedYesterday) {
        startDate = yesterdayStr;
        streak = 1;
      }
      
      if (startDate) {
        let currentDateObj = new Date(startDate);
        currentDateObj.setDate(currentDateObj.getDate() - 1);
        
        while (true) {
          const dateStr = currentDateObj.toISOString().split('T')[0];
          
          if (sortedDates.includes(dateStr)) {
            streak++;
            currentDateObj.setDate(currentDateObj.getDate() - 1);
          } else {
            break;
          }
        }
      }
      
      logger.info(`Calculated streak: ${streak} days`, {
        contributionDates: sortedDates.slice(0, 10),
        committedToday,
        committedYesterday
      });
      
      return {
        success: true,
        streak,
        contributionDates: sortedDates,
        committedToday,
        committedYesterday
      };
      
    } catch (error) {
      logger.warn('Streak calculation failed', error.message);
      
      return {
        success: false,
        error: error.message,
        streak: 0
      };
    }
  }

  consolidateResults(methods) {
    // Get the maximum commit count from successful methods
    let maxCommitCount = 0;
    let hasCommitted = false;
    let streak = 0;
    
    // Check each method's results
    ['searchAPI', 'eventsAPI', 'repoAPI'].forEach(methodName => {
      const method = methods[methodName];
      if (method && method.success) {
        maxCommitCount = Math.max(maxCommitCount, method.commitCount);
        if (method.hasCommitted) {
          hasCommitted = true;
        }
      }
    });
    
    // Get streak from streak calculation
    if (methods.streakCalculation && methods.streakCalculation.success) {
      streak = methods.streakCalculation.streak;
      
      // If we have a streak but no commits found, infer that there might be commits
      if (streak >= 2 && methods.streakCalculation.committedYesterday && !hasCommitted) {
        logger.info('Inferring commit exists based on streak pattern');
        hasCommitted = true;
        maxCommitCount = Math.max(maxCommitCount, 1);
      }
    }
    
    logger.info('Consolidating results', {
      maxCommitCount,
      hasCommitted,
      streak,
      methodsUsed: Object.keys(methods).filter(key => methods[key]?.success)
    });
    
    return {
      hasCommitted,
      commitCount: maxCommitCount,
      streak
    };
  }
}

module.exports = CommitChecker;