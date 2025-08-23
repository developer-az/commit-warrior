const axios = require('axios');

class GitHubApiClient {
  constructor(token) {
    this.token = token;
    this.cache = new Map();
    this.rateLimitReset = null;
    this.remainingRequests = 5000;
    
    // Create axios instance with default config
    this.client = axios.create({
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      timeout: 10000 // 10 second timeout
    });

    // Add response interceptor for rate limit handling
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit info from headers
        this.remainingRequests = parseInt(response.headers['x-ratelimit-remaining']) || this.remainingRequests;
        this.rateLimitReset = parseInt(response.headers['x-ratelimit-reset']) * 1000; // Convert to milliseconds
        return response;
      },
      (error) => {
        if (error.response?.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
          // Rate limit exceeded
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
          error.rateLimitExceeded = true;
          error.resetTime = resetTime;
        }
        throw error;
      }
    );
  }

  // Create cache key from URL and params
  _createCacheKey(url, params = {}) {
    const paramString = new URLSearchParams(params).toString();
    return `${url}?${paramString}`;
  }

  // Check if cache entry is valid (5 minutes for most endpoints)
  _isCacheValid(entry, ttl = 5 * 60 * 1000) {
    return entry && (Date.now() - entry.timestamp < ttl);
  }

  // Wait for rate limit reset
  async _waitForRateLimit() {
    if (this.rateLimitReset && Date.now() < this.rateLimitReset) {
      const waitTime = Math.min(this.rateLimitReset - Date.now(), 60 * 1000); // Max 1 minute wait
      console.log(`Rate limit exceeded. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Make API request with retry logic
  async _makeRequest(url, params = {}, options = {}) {
    const { useCache = true, cacheTtl = 5 * 60 * 1000, maxRetries = 3 } = options;
    const cacheKey = this._createCacheKey(url, params);

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (this._isCacheValid(cached, cacheTtl)) {
        console.log(`Cache hit for ${url}`);
        return cached.data;
      }
    }

    // Check rate limit before making request
    if (this.remainingRequests <= 5) {
      await this._waitForRateLimit();
    }

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Making request to ${url} (attempt ${attempt}/${maxRetries})`);
        const response = await this.client.get(url, { params });
        
        // Cache successful response
        if (useCache) {
          this.cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
          });
          
          // Clean up old cache entries periodically
          if (this.cache.size > 100) {
            this._cleanupCache();
          }
        }

        return response.data;
      } catch (error) {
        lastError = error;
        
        if (error.rateLimitExceeded) {
          await this._waitForRateLimit();
          continue; // Retry after waiting
        }

        // Don't retry on 4xx errors except rate limits
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 403) {
          break;
        }

        // Exponential backoff for other errors
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Request failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // Clean up old cache entries
  _cleanupCache() {
    const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < cutoff) {
        this.cache.delete(key);
      }
    }
  }

  // Get user events
  async getUserEvents(username, perPage = 100) {
    return this._makeRequest(`https://api.github.com/users/${username}/events`, {
      per_page: perPage
    });
  }

  // Get user repositories
  async getUserRepos(username, perPage = 100) {
    return this._makeRequest(`https://api.github.com/users/${username}/repos`, {
      per_page: perPage,
      sort: 'updated',
      direction: 'desc'
    });
  }

  // Get repository commits
  async getRepoCommits(username, repoName, options = {}) {
    const { author, since, until, perPage = 100 } = options;
    return this._makeRequest(`https://api.github.com/repos/${username}/${repoName}/commits`, {
      ...(author && { author }),
      ...(since && { since }),
      ...(until && { until }),
      per_page: perPage
    });
  }

  // Search commits (requires authentication)
  async searchCommits(query) {
    if (!this.token) {
      throw new Error('Token required for commit search');
    }
    
    return this._makeRequest(`https://api.github.com/search/commits`, {
      q: query
    }, { cacheTtl: 2 * 60 * 1000 }); // Shorter cache for search
  }

  // Validate token and get user info
  async validateToken() {
    if (!this.token) {
      throw new Error('No token provided');
    }

    try {
      const userData = await this._makeRequest('https://api.github.com/user', {}, { useCache: false });
      const scopes = await this._getTokenScopes();
      
      return {
        valid: true,
        user: userData,
        scopes
      };
    } catch (error) {
      return {
        valid: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // Get token scopes
  async _getTokenScopes() {
    try {
      const response = await this.client.get('https://api.github.com/user');
      const scopeHeader = response.headers['x-oauth-scopes'];
      return scopeHeader ? scopeHeader.split(', ').filter(s => s) : [];
    } catch (error) {
      return [];
    }
  }

  // Get rate limit status
  async getRateLimit() {
    try {
      const data = await this._makeRequest('https://api.github.com/rate_limit', {}, { useCache: false });
      return data;
    } catch (error) {
      return {
        resources: {
          core: {
            limit: 60,
            remaining: this.remainingRequests,
            reset: Math.floor((this.rateLimitReset || Date.now()) / 1000)
          }
        }
      };
    }
  }
}

module.exports = GitHubApiClient;