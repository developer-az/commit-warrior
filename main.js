const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// Import services
const logger = require('./services/logger');
const GitHubAPIService = require('./services/githubAPI');
const CommitChecker = require('./services/commitChecker');

// Initialize services and store
const store = new Store();
const githubAPI = new GitHubAPIService();
const commitChecker = new CommitChecker();

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
  const electronLog = require('electron-log');
  autoUpdater.logger = electronLog;
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
  logger.info('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  logger.info('Update available', info);
});

autoUpdater.on('update-not-available', (info) => {
  logger.info('Update not available', info);
});

autoUpdater.on('error', (err) => {
  logger.error('Error in auto-updater', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  logger.info('Download progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  logger.info('Update downloaded', info);
  // Notify the user that an update is ready
  if (mainWindow) {
    mainWindow.webContents.send('update-ready');
  }
});

// Check GitHub commits using new services
async function checkGitHubCommits(username, token) {
  if (!username || !token) {
    return { success: false, message: 'GitHub credentials not set' };
  }

  try {
    logger.info('Starting GitHub commit check', { username });
    
    const results = await commitChecker.checkTodaysCommits(username, token);
    
    return {
      success: true,
      hasCommitted: results.finalResult.hasCommitted,
      commitCount: results.finalResult.commitCount,
      streak: results.finalResult.streak,
      debug: {
        methods: results.methods,
        rateLimitStatus: githubAPI.getRateLimitStatus()
      }
    };
  } catch (error) {
    logger.error('GitHub commit check failed', { username, error: error.message });
    return {
      success: false,
      message: error.message,
      type: error.type,
      details: error.details
    };
  }
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
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

// IPC handlers
ipcMain.handle('save-settings', async (event, settings) => {
  if (!settings || !settings.githubUsername || !settings.githubToken) {
    return {
      success: false,
      message: 'Invalid settings: username and token are required'
    };
  }

  try {
    logger.info('Validating and saving settings', { username: settings.githubUsername });
    
    // Validate the credentials first
    const validation = await githubAPI.validateToken(settings.githubUsername, settings.githubToken);
    
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error,
        type: validation.type
      };
    }
    
    // Perform a commit check to ensure everything works
    const result = await checkGitHubCommits(settings.githubUsername, settings.githubToken);
    
    if (!result.success) {
      return result;
    }
    
    // If validation succeeds, save the settings
    store.set('settings', settings);
    logger.info('Settings saved successfully', { username: settings.githubUsername });
    
    return result;
  } catch (error) {
    logger.error('Error in save-settings handler', error);
    return {
      success: false,
      message: 'Failed to save settings: ' + (error.message || 'Unknown error')
    };
  }
});

ipcMain.handle('check-commits', async () => {
  const settings = store.get('settings');
  if (!settings?.githubUsername || !settings?.githubToken) {
    return {
      success: false,
      message: 'Settings not found. Please set up your GitHub credentials.'
    };
  }
  return await checkGitHubCommits(settings.githubUsername, settings.githubToken);
});

ipcMain.handle('get-settings', () => {
  return store.get('settings') || { githubUsername: '', githubToken: '' };
});

ipcMain.handle('reset-settings', () => {
  try {
    store.delete('settings');
    logger.info('Settings reset successfully');
    return { success: true };
  } catch (error) {
    logger.error('Error resetting settings', error);
    return {
      success: false,
      message: 'Failed to reset settings'
    };
  }
});

// Handle update installation
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Debug endpoints
ipcMain.handle('get-logs', (event, level, limit) => {
  return logger.getLogs(level, limit);
});

ipcMain.handle('clear-logs', () => {
  logger.clearLogs();
  return { success: true };
});

ipcMain.handle('get-rate-limit-status', () => {
  return githubAPI.getRateLimitStatus();
});

ipcMain.handle('set-log-level', (event, level) => {
  logger.setLevel(level);
  logger.info(`Log level set to ${level}`);
  return { success: true };
});

ipcMain.handle('get-cache-stats', () => {
  return githubAPI.getCacheStats();
});

ipcMain.handle('clear-cache', () => {
  githubAPI.clearCache();
  return { success: true };
});