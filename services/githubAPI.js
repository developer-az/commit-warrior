const axios = require('axios');
const logger = require('./logger');
const { createUserFriendlyError } = require('./errorHandler');

class GitHubAPIService {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
    this.lastRequestTime = null;
  }

  createHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Commit-Warrior/1.0.6'
    };
  }

  updateRateLimitInfo(response) {
    if (response?.headers) {
      this.rateLimitRemaining = response.headers['x-ratelimit-remaining'];
      this.rateLimitReset = response.headers['x-ratelimit-reset'];
      this.lastRequestTime = new Date();
      
      logger.debug('Rate limit updated', {
        remaining: this.rateLimitRemaining,
        reset: this.rateLimitReset ? new Date(parseInt(this.rateLimitReset) * 1000) : null
      });
    }
  }

  async makeRequest(endpoint, options = {}, context = '') {
    const startTime = Date.now();
    
    try {
      logger.debug(`Making API request to ${endpoint}`, { options });
      
      const response = await axios({
        url: `${this.baseURL}${endpoint}`,
        method: 'GET',
        timeout: 30000, // 30 second timeout
        ...options
      });
      
      this.updateRateLimitInfo(response);
      
      const duration = Date.now() - startTime;
      logger.debug(`API request successful`, { 
        endpoint, 
        status: response.status, 
        duration,
        dataLength: response.data?.length || (typeof response.data === 'object' ? Object.keys(response.data).length : 'unknown')
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`API request failed`, { 
        endpoint, 
        duration,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data
      });
      
      throw createUserFriendlyError(error, context);
    }
  }

  async searchCommits(username, token, date) {
    const endpoint = `/search/commits`;
    const query = `author:${username}+committer-date:${date}`;
    
    logger.info(`Searching commits for ${username} on ${date}`);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params: { q: query }
    }, 'Searching for commits');
  }

  async getUserEvents(username, token, perPage = 100) {
    const endpoint = `/users/${username}/events`;
    
    logger.info(`Getting user events for ${username}`);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params: { per_page: perPage }
    }, 'Fetching user events');
  }

  async getUserRepositories(username, token, perPage = 100) {
    const endpoint = `/users/${username}/repos`;
    
    logger.info(`Getting repositories for ${username}`);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params: {
        per_page: perPage,
        sort: 'updated',
        direction: 'desc'
      }
    }, 'Fetching user repositories');
  }

  async getRepositoryCommits(username, repoName, token, params = {}) {
    const endpoint = `/repos/${username}/${repoName}/commits`;
    
    logger.debug(`Getting commits for ${username}/${repoName}`, params);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params
    }, `Fetching commits for ${repoName}`);
  }

  async validateToken(username, token) {
    try {
      logger.info(`Validating token for ${username}`);
      
      // Make a simple API call to validate the token
      const response = await this.makeRequest('/user', {
        headers: this.createHeaders(token)
      }, 'Validating GitHub token');
      
      const user = response.data;
      
      // Check if the token user matches the provided username
      if (user.login.toLowerCase() !== username.toLowerCase()) {
        logger.warn('Username mismatch', {
          provided: username,
          tokenUser: user.login
        });
        
        return {
          valid: false,
          error: 'Token belongs to a different user',
          providedUsername: username,
          tokenUsername: user.login
        };
      }
      
      logger.info('Token validation successful', {
        username: user.login,
        id: user.id,
        accountType: user.type
      });
      
      return {
        valid: true,
        user: {
          login: user.login,
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
          type: user.type
        },
        scopes: response.headers['x-oauth-scopes']?.split(', ') || []
      };
      
    } catch (error) {
      logger.error('Token validation failed', error.details || error.message);
      
      return {
        valid: false,
        error: error.message,
        type: error.type
      };
    }
  }

  getRateLimitStatus() {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset ? new Date(parseInt(this.rateLimitReset) * 1000) : null,
      lastRequest: this.lastRequestTime
    };
  }
}

module.exports = GitHubAPIService;