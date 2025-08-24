const logger = require('./logger');

class RetryManager {
  constructor() {
    this.defaultOptions = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffFactor: 2,
      retryableErrors: ['NETWORK', 'RATE_LIMIT', 'API']
    };
  }

  async executeWithRetry(operation, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    let lastError;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        logger.debug(`Executing operation, attempt ${attempt + 1}/${config.maxRetries + 1}`);
        
        const result = await operation();
        
        if (attempt > 0) {
          logger.info(`Operation succeeded after ${attempt + 1} attempts`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if this error is retryable
        const isRetryable = config.retryableErrors.includes(error.type) || 
                           this.isRetryableError(error);
        
        if (!isRetryable || attempt === config.maxRetries) {
          logger.error(`Operation failed after ${attempt + 1} attempts`, {
            error: error.message,
            type: error.type,
            retryable: isRetryable
          });
          throw error;
        }
        
        // Calculate delay for next attempt
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt),
          config.maxDelay
        );
        
        logger.warn(`Operation failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          error: error.message,
          type: error.type
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  isRetryableError(error) {
    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return true;
    }
    
    // HTTP 5xx errors (server errors)
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    // Rate limit errors
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    // GitHub API rate limit specific errors
    if (error.response && error.response.status === 403 && 
        error.response.headers && 
        error.response.headers['x-ratelimit-remaining'] === '0') {
      return true;
    }
    
    return false;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryManager;