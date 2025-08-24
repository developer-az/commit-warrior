// Mock electron app for testing
const path = require('path');
global.electron = {
  app: {
    getPath: (type) => {
      if (type === 'userData') {
        return path.join(__dirname, '..', 'tmp', 'test-user-data');
      }
      return '/tmp';
    }
  }
};

const { testErrorHandler } = require('./errorHandler.test.js');
const { testCacheManager } = require('./cacheManager.test.js');
const { testRetryManager } = require('./retryManager.test.js');

async function runTests() {
  console.log('🧪 Running Commit Warrior Tests\n');
  
  try {
    testErrorHandler();
    testCacheManager();
    testRetryManager();
    
    console.log('\n✅ All tests passed! 🎉');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };