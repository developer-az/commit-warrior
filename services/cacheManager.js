const logger = require('./logger');

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 100;
    
    // Different TTLs for different types of data
    this.ttlConfig = {
      'user-validation': 10 * 60 * 1000,  // 10 minutes
      'user-events': 2 * 60 * 1000,       // 2 minutes
      'repositories': 5 * 60 * 1000,      // 5 minutes
      'commits': 1 * 60 * 1000,           // 1 minute for commit data
      'search-commits': 30 * 1000,        // 30 seconds for search results
    };
  }

  generateKey(type, ...params) {
    const keyParts = [type, ...params.map(p => String(p))];
    return keyParts.join(':');
  }

  set(key, data, ttl = null) {
    // Clean up old entries if cache is getting too large
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanup();
    }
    
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      data,
      expiresAt,
      createdAt: Date.now()
    });
    
    logger.debug(`Cached data with key: ${key}`, {
      ttl: ttl || this.defaultTTL,
      expiresAt: new Date(expiresAt).toISOString(),
      cacheSize: this.cache.size
    });
  }

  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    }
    
    if (Date.now() > cached.expiresAt) {
      logger.debug(`Cache expired for key: ${key}`);
      this.cache.delete(key);
      return null;
    }
    
    logger.debug(`Cache hit for key: ${key}`, {
      age: Date.now() - cached.createdAt,
      ttl: cached.expiresAt - cached.createdAt
    });
    
    return cached.data;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Deleted cache entry: ${key}`);
    }
    return deleted;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared cache (${size} entries)`);
  }

  cleanup() {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    logger.debug(`Cache cleanup completed`, {
      deletedCount,
      remainingSize: this.cache.size
    });
  }

  // Specific cache methods for different data types
  cacheUserValidation(username, token, validationData) {
    const key = this.generateKey('user-validation', username, this.hashToken(token));
    this.set(key, validationData, this.ttlConfig['user-validation']);
  }

  getUserValidation(username, token) {
    const key = this.generateKey('user-validation', username, this.hashToken(token));
    return this.get(key);
  }

  cacheUserEvents(username, events) {
    const key = this.generateKey('user-events', username);
    this.set(key, events, this.ttlConfig['user-events']);
  }

  getUserEvents(username) {
    const key = this.generateKey('user-events', username);
    return this.get(key);
  }

  cacheRepositories(username, repos) {
    const key = this.generateKey('repositories', username);
    this.set(key, repos, this.ttlConfig['repositories']);
  }

  getRepositories(username) {
    const key = this.generateKey('repositories', username);
    return this.get(key);
  }

  cacheCommits(username, repo, date, commits) {
    const key = this.generateKey('commits', username, repo, date);
    this.set(key, commits, this.ttlConfig['commits']);
  }

  getCommits(username, repo, date) {
    const key = this.generateKey('commits', username, repo, date);
    return this.get(key);
  }

  cacheSearchCommits(username, date, searchResults) {
    const key = this.generateKey('search-commits', username, date);
    this.set(key, searchResults, this.ttlConfig['search-commits']);
  }

  getSearchCommits(username, date) {
    const key = this.generateKey('search-commits', username, date);
    return this.get(key);
  }

  // Simple token hashing for cache keys (not for security)
  hashToken(token) {
    let hash = 0;
    for (let i = 0; i < Math.min(token.length, 10); i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      totalSize++;
      if (now > cached.expiresAt) {
        expiredCount++;
      }
    }
    
    return {
      totalEntries: totalSize,
      expiredEntries: expiredCount,
      activeEntries: totalSize - expiredCount,
      maxSize: this.maxCacheSize,
      utilizationPercent: Math.round((totalSize / this.maxCacheSize) * 100)
    };
  }
}

module.exports = CacheManager;