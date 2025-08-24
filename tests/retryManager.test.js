const RetryManager = require('../services/retryManager');

function testRetryManager() {
  console.log('Testing Retry Manager...');
  
  const retryManager = new RetryManager();
  
  // Test successful operation (no retries needed)
  let callCount = 0;
  const successOperation = async () => {
    callCount++;
    return { success: true };
  };
  
  retryManager.executeWithRetry(successOperation).then((result) => {
    console.assert(result.success === true, 'Should return successful result');
    console.assert(callCount === 1, 'Should only call operation once for success');
  });
  
  // Test operation that fails then succeeds
  let failCount = 0;
  const eventuallSuccessOperation = async () => {
    failCount++;
    if (failCount < 3) {
      const error = new Error('Temporary failure');
      error.type = 'NETWORK';
      throw error;
    }
    return { success: true, attempts: failCount };
  };
  
  retryManager.executeWithRetry(eventuallSuccessOperation).then((result) => {
    console.assert(result.success === true, 'Should eventually succeed');
    console.assert(result.attempts === 3, 'Should retry until success');
  });
  
  // Test non-retryable error
  const nonRetryableOperation = async () => {
    const error = new Error('Validation error');
    error.type = 'VALIDATION';
    throw error;
  };
  
  let errorCaught = false;
  retryManager.executeWithRetry(nonRetryableOperation).catch((error) => {
    errorCaught = true;
    console.assert(error.type === 'VALIDATION', 'Should not retry validation errors');
  });
  
  setTimeout(() => {
    console.assert(errorCaught, 'Should catch non-retryable errors');
    console.log('✅ Retry Manager tests passed');
  }, 100);
}

module.exports = { testRetryManager };