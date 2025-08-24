const axios = require('axios');
const logger = require('./logger');
const { createUserFriendlyError } = require('./errorHandler');
const RetryManager = require('./retryManager');
const CacheManager = require('./cacheManager');

class GitHubAPIService {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
    this.lastRequestTime = null;
    this.retryManager = new RetryManager();
    this.cache = new CacheManager();
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

  async makeRequest(endpoint, options = {}, context = '', useCache = false, cacheKey = null) {
    const startTime = Date.now();
    
    // Check cache first if enabled
    if (useCache && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug(`Using cached response for ${endpoint}`, { cacheKey });
        return { data: cached };
      }
    }
    
    const operation = async () => {
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
        
        // Cache the response if enabled
        if (useCache && cacheKey) {
          this.cache.set(cacheKey, response.data);
          logger.debug(`Cached response for ${endpoint}`, { cacheKey });
        }
        
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
    };
    
    // Use retry manager for the request
    return await this.retryManager.executeWithRetry(operation, {
      retryableErrors: ['NETWORK', 'RATE_LIMIT', 'API']
    });
  }

  async searchCommits(username, token, date) {
    const endpoint = `/search/commits`;
    const query = `author:${username}+committer-date:${date}`;
    const cacheKey = this.cache.generateKey('search-commits', username, date);
    
    logger.info(`Searching commits for ${username} on ${date}`);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params: { q: query }
    }, 'Searching for commits', true, cacheKey);
  }

  async getUserEvents(username, token, perPage = 100) {
    const endpoint = `/users/${username}/events`;
    const cacheKey = this.cache.generateKey('user-events', username);
    
    logger.info(`Getting user events for ${username}`);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params: { per_page: perPage }
    }, 'Fetching user events', true, cacheKey);
  }

  async getUserRepositories(username, token, perPage = 100) {
    const endpoint = `/users/${username}/repos`;
    const cacheKey = this.cache.generateKey('repositories', username);
    
    logger.info(`Getting repositories for ${username}`);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params: {
        per_page: perPage,
        sort: 'updated',
        direction: 'desc'
      }
    }, 'Fetching user repositories', true, cacheKey);
  }

  async getRepositoryCommits(username, repoName, token, params = {}) {
    const endpoint = `/repos/${username}/${repoName}/commits`;
    const cacheKey = this.cache.generateKey('commits', username, repoName, JSON.stringify(params));
    
    logger.debug(`Getting commits for ${username}/${repoName}`, params);
    
    return this.makeRequest(endpoint, {
      headers: this.createHeaders(token),
      params
    }, `Fetching commits for ${repoName}`, true, cacheKey);
  }

  async validateToken(username, token) {
    try {
      logger.info(`Validating token for ${username}`);
      
      // Check cache first
      const cached = this.cache.getUserValidation(username, token);
      if (cached) {
        logger.debug('Using cached token validation result');
        return cached;
      }
      
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
      
      const result = {
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
      
      // Cache the successful validation
      this.cache.cacheUserValidation(username, token, result);
      
      return result;
      
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

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache() {
    this.cache.clear();
    logger.info('API cache cleared');
  }
}

module.exports = GitHubAPIService;