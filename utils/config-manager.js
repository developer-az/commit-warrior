const Store = require('electron-store');

class ConfigManager {
  constructor() {
    this.defaults = {
      settings: {
        githubUsername: '',
        githubToken: ''
      },
      preferences: {
        checkInterval: 15, // minutes
        enableNotifications: true,
        enableAutoCheck: true,
        theme: 'dark',
        maxRepositoriesToCheck: 20,
        cacheTimeout: 5, // minutes
        enableVerboseLogging: false
      },
      cache: {
        lastCheck: null,
        lastResult: null,
        userInfo: null
      }
    };

    this.store = new Store({
      name: 'commit-warrior-config',
      defaults: this.defaults
    });
  }

  // Settings management
  getSettings() {
    return this.store.get('settings', {
      githubUsername: '',
      githubToken: ''
    });
  }

  saveSettings(settings) {
    const currentSettings = this.getSettings();
    const newSettings = { ...currentSettings, ...settings };
    this.store.set('settings', newSettings);
    return newSettings;
  }

  clearSettings() {
    this.store.set('settings', {
      githubUsername: '',
      githubToken: ''
    });
  }

  hasValidSettings() {
    const settings = this.getSettings();
    return settings.githubUsername && settings.githubToken;
  }

  // Preferences management
  getPreferences() {
    return this.store.get('preferences');
  }

  updatePreference(key, value) {
    const preferences = this.getPreferences();
    preferences[key] = value;
    this.store.set('preferences', preferences);
    return preferences;
  }

  getPreference(key, defaultValue = null) {
    const preferences = this.getPreferences();
    return preferences[key] !== undefined ? preferences[key] : defaultValue;
  }

  resetPreferencesToDefault() {
    const defaults = this.defaults.preferences;
    this.store.set('preferences', defaults);
    return defaults;
  }

  // Cache management
  getCache() {
    return this.store.get('cache');
  }

  updateCache(key, value) {
    const cache = this.getCache();
    cache[key] = value;
    this.store.set('cache', cache);
  }

  getCacheValue(key, defaultValue = null) {
    const cache = this.getCache();
    return cache[key] !== undefined ? cache[key] : defaultValue;
  }

  clearCache() {
    this.store.set('cache', {
      lastCheck: null,
      lastResult: null,
      userInfo: null
    });
  }

  // Check if cache is valid
  isCacheValid(key, maxAgeMinutes = 5) {
    const cache = this.getCache();
    const cacheEntry = cache[key];
    
    if (!cacheEntry || !cacheEntry.timestamp) {
      return false;
    }

    const age = Date.now() - cacheEntry.timestamp;
    const maxAge = maxAgeMinutes * 60 * 1000;
    return age < maxAge;
  }

  // Set cache with timestamp
  setCacheWithTimestamp(key, value) {
    this.updateCache(key, {
      value,
      timestamp: Date.now()
    });
  }

  // Get cache value with timestamp check
  getCacheWithTimestamp(key, maxAgeMinutes = 5) {
    if (this.isCacheValid(key, maxAgeMinutes)) {
      const cache = this.getCache();
      return cache[key].value;
    }
    return null;
  }

  // Export all settings for backup
  exportConfig() {
    return {
      settings: this.getSettings(),
      preferences: this.getPreferences(),
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Import settings from backup (excluding sensitive token)
  importConfig(config) {
    if (config.preferences) {
      this.store.set('preferences', config.preferences);
    }
    
    if (config.settings && config.settings.githubUsername) {
      const currentSettings = this.getSettings();
      this.saveSettings({
        ...currentSettings,
        githubUsername: config.settings.githubUsername
        // Don't import token for security
      });
    }
    
    return true;
  }

  // Get all data for debugging
  getDebugInfo() {
    return {
      settings: {
        ...this.getSettings(),
        githubToken: this.getSettings().githubToken ? '[REDACTED]' : ''
      },
      preferences: this.getPreferences(),
      cache: {
        ...this.getCache(),
        userInfo: this.getCache().userInfo ? '[CACHED]' : null
      },
      storeSize: this.store.size
    };
  }

  // Validate configuration
  validateConfig() {
    const issues = [];
    
    const settings = this.getSettings();
    if (!settings.githubUsername) {
      issues.push('GitHub username is not set');
    }
    if (!settings.githubToken) {
      issues.push('GitHub token is not set');
    }

    const preferences = this.getPreferences();
    if (preferences.checkInterval < 1 || preferences.checkInterval > 60) {
      issues.push('Check interval should be between 1 and 60 minutes');
    }
    if (preferences.maxRepositoriesToCheck < 1 || preferences.maxRepositoriesToCheck > 100) {
      issues.push('Max repositories to check should be between 1 and 100');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  // Clean up old cache entries
  cleanupCache() {
    const cache = this.getCache();
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    let cleaned = false;
    Object.keys(cache).forEach(key => {
      if (cache[key] && cache[key].timestamp && cache[key].timestamp < cutoff) {
        delete cache[key];
        cleaned = true;
      }
    });

    if (cleaned) {
      this.store.set('cache', cache);
    }

    return cleaned;
  }
}

module.exports = ConfigManager;