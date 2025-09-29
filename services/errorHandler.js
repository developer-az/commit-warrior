class CommitWarriorError extends Error {
  constructor(message, type, originalError = null, details = null) {
    super(message);
    this.name = 'CommitWarriorError';
    this.type = type;
    this.originalError = originalError;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// Error types
const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  AUTH: 'AUTH',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION: 'VALIDATION',
  API: 'API',
  STORAGE: 'STORAGE',
  UNKNOWN: 'UNKNOWN'
};

// User-friendly error messages with solutions
const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: {
    title: 'Network Connection Error',
    message: 'Unable to connect to GitHub. Please check your internet connection.',
    solutions: [
      'Check your internet connection',
      'Try again in a few moments',
      'Check if GitHub is accessible from your browser'
    ]
  },
  [ERROR_TYPES.AUTH]: {
    title: 'Authentication Error',
    message: 'GitHub token is invalid or has insufficient permissions.',
    solutions: [
      'Verify your GitHub token is correct',
      'Ensure the token has "repo" scope permissions',
      'Generate a new token at github.com/settings/tokens',
      'Make sure the token hasn\'t expired'
    ]
  },
  [ERROR_TYPES.RATE_LIMIT]: {
    title: 'Rate Limit Exceeded',
    message: 'Too many requests to GitHub API. Please wait before trying again.',
    solutions: [
      'Wait a few minutes before trying again',
      'Consider using a GitHub token with higher rate limits',
      'Try again during off-peak hours'
    ]
  },
  [ERROR_TYPES.VALIDATION]: {
    title: 'Invalid Input',
    message: 'The provided information is not valid.',
    solutions: [
      'Check that your GitHub username is correct',
      'Ensure your token is properly formatted',
      'Remove any extra spaces from your input'
    ]
  },
  [ERROR_TYPES.API]: {
    title: 'GitHub API Error',
    message: 'GitHub API returned an unexpected response.',
    solutions: [
      'Try again in a few moments',
      'Check GitHub\'s status page',
      'Verify your token permissions'
    ]
  },
  [ERROR_TYPES.STORAGE]: {
    title: 'Storage Error',
    message: 'Unable to save or load settings.',
    solutions: [
      'Restart the application',
      'Check disk space availability',
      'Try resetting settings if the problem persists'
    ]
  },
  [ERROR_TYPES.UNKNOWN]: {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred.',
    solutions: [
      'Try again in a few moments',
      'Restart the application',
      'Check the application logs for more details'
    ]
  }
};

function categorizeError(error) {
  if (!error) return ERROR_TYPES.UNKNOWN;
  
  // Check for network errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEDOUT' || error.message?.includes('network')) {
    return ERROR_TYPES.NETWORK;
  }
  
  // Check for GitHub API errors
  if (error.response) {
    const status = error.response.status;
    
    if (status === 401 || status === 403) {
      // Check if it's specifically a rate limit error
      if (error.response.headers && 
          (error.response.headers['x-ratelimit-remaining'] === '0' ||
           error.response.data?.message?.includes('rate limit'))) {
        return ERROR_TYPES.RATE_LIMIT;
      }
      return ERROR_TYPES.AUTH;
    }
    
    if (status >= 500) {
      return ERROR_TYPES.API;
    }
    
    if (status >= 400) {
      return ERROR_TYPES.VALIDATION;
    }
  }
  
  // Check for validation errors
  if (error.message?.includes('required') || error.message?.includes('invalid')) {
    return ERROR_TYPES.VALIDATION;
  }
  
  // Check for storage errors
  if (error.code?.startsWith('E') && (error.code.includes('FILE') || error.code.includes('DIR'))) {
    return ERROR_TYPES.STORAGE;
  }
  
  return ERROR_TYPES.UNKNOWN;
}

function createUserFriendlyError(error, context = '') {
  const errorType = categorizeError(error);
  const errorInfo = ERROR_MESSAGES[errorType];
  
  let message = errorInfo.message;
  if (context) {
    message = `${context}: ${message}`;
  }
  
  // Add specific details if available
  let details = {
    type: errorType,
    solutions: errorInfo.solutions,
    technical: error.message
  };
  
  if (error.response) {
    details.statusCode = error.response.status;
    details.apiMessage = error.response.data?.message;
    
    // Add rate limit info if available
    if (error.response.headers) {
      const remaining = error.response.headers['x-ratelimit-remaining'];
      const reset = error.response.headers['x-ratelimit-reset'];
      
      if (remaining !== undefined) {
        details.rateLimitRemaining = remaining;
      }
      
      if (reset) {
        const resetTime = new Date(parseInt(reset) * 1000);
        details.rateLimitReset = resetTime.toISOString();
      }
    }
  }
  
  return new CommitWarriorError(message, errorType, error, details);
}

module.exports = {
  CommitWarriorError,
  ERROR_TYPES,
  ERROR_MESSAGES,
  categorizeError,
  createUserFriendlyError
};