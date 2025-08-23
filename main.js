const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Import new utilities
const CommitChecker = require('./utils/commit-checker');
const ConfigManager = require('./utils/config-manager');
const DateUtils = require('./utils/date-utils');
const Logger = require('./utils/logger');

// Initialize configuration manager and logger
const configManager = new ConfigManager();
const logger = new Logger('Main');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    resizable: true,
    show: false,
    backgroundColor: '#1e1e1e'
  });

  mainWindow.loadFile('index.html');

  // Wait for the window to be ready before showing it
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Configure auto updater
function setupAutoUpdater() {
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';

  // Check for updates when the app starts
  autoUpdater.checkForUpdatesAndNotify();

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);
}

// Auto updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('Download progress:', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  // Notify the user that an update is ready
  if (mainWindow) {
    mainWindow.webContents.send('update-ready');
  }
});

// Improved GitHub commit checking function
async function checkGitHubCommits(username, token) {
  if (!username || !token) {
    return { 
      success: false, 
      message: 'GitHub credentials not set',
      error: 'MISSING_CREDENTIALS'
    };
  }

  try {
    logger.info('=== Starting Commit Check ===');
    logger.debug('Checking commits', { user: username, date: DateUtils.getTodayInUserTimezone() });
    
    const commitChecker = new CommitChecker(username, token);
    const result = await commitChecker.checkCommits();
    
    // Cache the result for quick retrieval
    if (result.success) {
      configManager.setCacheWithTimestamp('lastResult', result);
      configManager.updateCache('lastCheck', Date.now());
    }
    
    logger.info('=== Commit Check Complete ===');
    return result;
    
  } catch (error) {
    logger.error('Unexpected error in checkGitHubCommits', { error: error.message, stack: error.stack });
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: 'UNEXPECTED_ERROR',
      details: error.message
    };
  }
}

app.whenReady().then(() => {
  logger.info('Application starting up');
  logger.logSystemInfo();
  createWindow();
  setupAutoUpdater();
  
  // Clean up old cache on startup
  configManager.cleanupCache();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers with improved error handling
ipcMain.handle('save-settings', async (event, settings) => {
  if (!settings || !settings.githubUsername || !settings.githubToken) {
    return {
      success: false,
      message: 'Invalid settings: username and token are required',
      error: 'INVALID_INPUT'
    };
  }

  try {
    logger.debug('Validating GitHub credentials');
    
    // Verify the credentials first
    const result = await checkGitHubCommits(settings.githubUsername, settings.githubToken);
    
    if (!result.success) {
      return {
        ...result,
        message: `Credential validation failed: ${result.message}`
      };
    }
    
    // If verification succeeds, save the settings
    configManager.saveSettings(settings);
    
    // Cache user info for display
    const commitChecker = new CommitChecker(settings.githubUsername, settings.githubToken);
    const tokenValidation = await commitChecker.apiClient.validateToken();
    if (tokenValidation.valid) {
      configManager.setCacheWithTimestamp('userInfo', tokenValidation.user);
    }
    
    logger.info('Settings saved successfully');
    return result;
    
  } catch (error) {
    logger.error('Error in save-settings handler', { error: error.message });
    return {
      success: false,
      message: 'Failed to save settings: ' + (error.message || 'Unknown error'),
      error: 'SAVE_ERROR'
    };
  }
});

ipcMain.handle('check-commits', async () => {
  const settings = configManager.getSettings();
  
  if (!settings?.githubUsername || !settings?.githubToken) {
    return {
      success: false,
      message: 'Settings not found. Please set up your GitHub credentials.',
      error: 'MISSING_SETTINGS'
    };
  }
  
  // Check if we have a recent cached result
  const cacheTimeout = configManager.getPreference('cacheTimeout', 5);
  const cachedResult = configManager.getCacheWithTimestamp('lastResult', cacheTimeout);
  
  if (cachedResult && configManager.getPreference('enableAutoCheck', true)) {
    logger.debug('Returning cached result');
    return {
      ...cachedResult,
      cached: true
    };
  }
  
  return await checkGitHubCommits(settings.githubUsername, settings.githubToken);
});

ipcMain.handle('get-settings', () => {
  const settings = configManager.getSettings();
  const userInfo = configManager.getCacheWithTimestamp('userInfo', 60); // 1 hour cache for user info
  
  return {
    ...settings,
    userInfo: userInfo || null
  };
});

ipcMain.handle('reset-settings', () => {
  try {
    configManager.clearSettings();
    configManager.clearCache();
    logger.info('Settings reset successfully');
    return { 
      success: true,
      message: 'Settings reset successfully'
    };
  } catch (error) {
    logger.error('Error resetting settings', { error: error.message });
    return {
      success: false,
      message: 'Failed to reset settings',
      error: 'RESET_ERROR'
    };
  }
});

// New IPC handlers for configuration management
ipcMain.handle('get-preferences', () => {
  return configManager.getPreferences();
});

ipcMain.handle('update-preference', (event, key, value) => {
  try {
    const preferences = configManager.updatePreference(key, value);
    return {
      success: true,
      preferences
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update preference: ${error.message}`,
      error: 'PREFERENCE_ERROR'
    };
  }
});

ipcMain.handle('get-rate-limit', async () => {
  const settings = configManager.getSettings();
  
  if (!settings?.githubUsername || !settings?.githubToken) {
    return null;
  }
  
  try {
    const commitChecker = new CommitChecker(settings.githubUsername, settings.githubToken);
    return await commitChecker.getRateLimitInfo();
  } catch (error) {
    console.error('Error getting rate limit info:', error);
    return null;
  }
});

ipcMain.handle('get-debug-info', () => {
  return {
    config: configManager.getDebugInfo(),
    app: {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      electron: process.versions.electron
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timezone: DateUtils.getUserTimezoneOffset(),
      today: DateUtils.getTodayInUserTimezone()
    }
  };
});

// Handle update installation
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});