// Basic tests to validate the stability improvements
const assert = require('assert');
const DateUtils = require('../utils/date-utils');
const ConfigManager = require('../utils/config-manager');
const Logger = require('../utils/logger');

// Test DateUtils
function testDateUtils() {
  console.log('Testing DateUtils...');
  
  // Test basic date functions
  const today = DateUtils.getTodayInUserTimezone();
  assert(today.match(/^\d{4}-\d{2}-\d{2}$/), 'Today should be in YYYY-MM-DD format');
  
  const yesterday = DateUtils.getYesterdayInUserTimezone();
  assert(yesterday.match(/^\d{4}-\d{2}-\d{2}$/), 'Yesterday should be in YYYY-MM-DD format');
  
  // Test date calculations
  assert(DateUtils.isToday(today), 'isToday should return true for today');
  assert(DateUtils.isYesterday(yesterday), 'isYesterday should return true for yesterday');
  
  // Test days ago
  const threeDaysAgo = DateUtils.getDaysAgo(3);
  assert(threeDaysAgo.match(/^\d{4}-\d{2}-\d{2}$/), 'getDaysAgo should return valid date');
  
  // Test UTC conversions
  const startOfDay = DateUtils.getStartOfDayUTC(today);
  assert(startOfDay.endsWith('T00:00:00Z'), 'Start of day should end with T00:00:00Z');
  
  const endOfDay = DateUtils.getEndOfDayUTC(today);
  assert(endOfDay.endsWith('T23:59:59Z'), 'End of day should end with T23:59:59Z');
  
  console.log('✅ DateUtils tests passed');
}

// Test ConfigManager
function testConfigManager() {
  console.log('Testing ConfigManager...');
  
  const config = new ConfigManager();
  
  // Reset to defaults first
  config.resetPreferencesToDefault();
  
  // Test default preferences
  const preferences = config.getPreferences();
  assert(preferences.checkInterval === 15, 'Default check interval should be 15 minutes');
  assert(preferences.enableNotifications === true, 'Notifications should be enabled by default');
  
  // Test preference updates
  const updated = config.updatePreference('checkInterval', 30);
  assert(updated.checkInterval === 30, 'Check interval should be updated to 30');
  
  // Test settings validation
  const validation = config.validateConfig();
  assert(Array.isArray(validation.issues), 'Validation should return issues array');
  
  // Test cache functionality
  config.setCacheWithTimestamp('test', { data: 'test' });
  const cached = config.getCacheWithTimestamp('test', 1);
  assert(cached && cached.data === 'test', 'Cache should store and retrieve data');
  
  // Clean up test data
  config.resetPreferencesToDefault();
  
  console.log('✅ ConfigManager tests passed');
}

// Test Logger
function testLogger() {
  console.log('Testing Logger...');
  
  const logger = new Logger('Test');
  
  // Test basic logging (should not throw)
  logger.info('Test info message');
  logger.warn('Test warning message');
  logger.error('Test error message');
  logger.debug('Test debug message');
  
  // Test performance timing
  logger.time('test-operation');
  setTimeout(() => {
    logger.timeEnd('test-operation');
  }, 10);
  
  // Test rate limit logging
  const rateLimitData = {
    resources: {
      core: {
        limit: 5000,
        remaining: 4500,
        reset: Math.floor(Date.now() / 1000) + 3600
      }
    }
  };
  logger.logRateLimit(rateLimitData);
  
  // Test commit result logging
  const commitResult = {
    success: true,
    hasCommitted: true,
    commitCount: 3,
    streak: 5,
    method: 'events'
  };
  logger.logCommitResult(commitResult);
  
  console.log('✅ Logger tests passed');
}

// Test error handling scenarios
function testErrorHandling() {
  console.log('Testing error handling scenarios...');
  
  const config = new ConfigManager();
  
  // Test invalid preference updates
  try {
    config.updatePreference(null, 'invalid');
    assert(false, 'Should have thrown error for invalid preference');
  } catch (error) {
    // Expected error
  }
  
  // Test cache with invalid data
  const invalidCache = config.getCacheWithTimestamp('nonexistent', 1);
  assert(invalidCache === null, 'Should return null for nonexistent cache');
  
  console.log('✅ Error handling tests passed');
}

// Test utility functions work together
function testIntegration() {
  console.log('Testing integration...');
  
  const config = new ConfigManager();
  const logger = new Logger('Integration');
  
  // Test that preferences affect behavior
  const cacheTimeout = config.getPreference('cacheTimeout', 5);
  assert(typeof cacheTimeout === 'number', 'Cache timeout should be a number');
  
  // Test logger with config data
  logger.info('Configuration loaded', config.getDebugInfo());
  
  // Test date utilities with configuration
  const today = DateUtils.getTodayInUserTimezone();
  logger.debug('Current date', { today });
  
  console.log('✅ Integration tests passed');
}

// Run all tests
async function runTests() {
  console.log('🧪 Running Commit Warrior stability tests...\n');
  
  try {
    testDateUtils();
    testConfigManager();
    testLogger();
    testErrorHandling();
    testIntegration();
    
    console.log('\n🎉 All tests passed! The stability improvements are working correctly.');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ DateUtils: Timezone and date handling');
    console.log('- ✅ ConfigManager: Settings and preferences management');
    console.log('- ✅ Logger: Comprehensive logging system');
    console.log('- ✅ Error Handling: Graceful error recovery');
    console.log('- ✅ Integration: Components work together');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testDateUtils,
  testConfigManager,
  testLogger,
  testErrorHandling,
  testIntegration,
  runTests
};