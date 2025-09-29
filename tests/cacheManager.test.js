const CacheManager = require('../services/cacheManager');

function testCacheManager() {
  console.log('Testing Cache Manager...');
  
  const cache = new CacheManager();
  
  // Test basic set/get
  cache.set('test-key', { data: 'test value' }, 1000);
  const retrieved = cache.get('test-key');
  console.assert(retrieved && retrieved.data === 'test value', 'Should store and retrieve data');
  
  // Test cache expiration
  cache.set('expire-key', { data: 'will expire' }, 1); // 1ms TTL
  setTimeout(() => {
    const expired = cache.get('expire-key');
    console.assert(expired === null, 'Should return null for expired entries');
  }, 10);
  
  // Test cache key generation
  const key = cache.generateKey('user-events', 'testuser', '2024-01-01');
  console.assert(key === 'user-events:testuser:2024-01-01', 'Should generate correct cache key');
  
  // Test specific cache methods
  cache.cacheUserEvents('testuser', [{ type: 'PushEvent' }]);
  const userEvents = cache.getUserEvents('testuser');
  console.assert(userEvents && userEvents[0].type === 'PushEvent', 'Should cache and retrieve user events');
  
  // Test cache stats
  const stats = cache.getStats();
  console.assert(typeof stats.totalEntries === 'number', 'Should return cache statistics');
  
  // Test cache cleanup
  cache.clear();
  const afterClear = cache.get('test-key');
  console.assert(afterClear === null, 'Should clear all cache entries');
  
  console.log('✅ Cache Manager tests passed');
}

module.exports = { testCacheManager };