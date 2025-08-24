const { categorizeError, createUserFriendlyError, ERROR_TYPES } = require('../services/errorHandler');

function testErrorHandler() {
  console.log('Testing Error Handler...');
  
  // Test network errors
  const networkError = new Error('ENOTFOUND');
  networkError.code = 'ENOTFOUND';
  
  const categorizedNetwork = categorizeError(networkError);
  console.assert(categorizedNetwork === ERROR_TYPES.NETWORK, 'Should categorize ENOTFOUND as NETWORK error');
  
  // Test auth errors
  const authError = new Error('Unauthorized');
  authError.response = { status: 401 };
  
  const categorizedAuth = categorizeError(authError);
  console.assert(categorizedAuth === ERROR_TYPES.AUTH, 'Should categorize 401 as AUTH error');
  
  // Test rate limit errors
  const rateLimitError = new Error('Rate limit exceeded');
  rateLimitError.response = { 
    status: 403,
    headers: { 'x-ratelimit-remaining': '0' }
  };
  
  const categorizedRateLimit = categorizeError(rateLimitError);
  console.assert(categorizedRateLimit === ERROR_TYPES.RATE_LIMIT, 'Should categorize rate limit as RATE_LIMIT error');
  
  // Test user-friendly error creation
  const userFriendlyError = createUserFriendlyError(networkError, 'Testing context');
  console.assert(userFriendlyError.type === ERROR_TYPES.NETWORK, 'User-friendly error should have correct type');
  console.assert(userFriendlyError.details.solutions.length > 0, 'Should include solutions');
  
  console.log('✅ Error Handler tests passed');
}

module.exports = { testErrorHandler };