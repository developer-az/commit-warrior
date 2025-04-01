const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// Initialize electron store
const store = new Store();

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

// Check GitHub commits
async function checkGitHubCommits(username, token) {
  if (!username || !token) {
    return { success: false, message: 'GitHub credentials not set' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await axios.get(
      `https://api.github.com/search/commits?q=author:${username}+committer-date:${today}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    const hasCommitted = response.data.total_count > 0;
    const commitCount = response.data.total_count;

    // Get streak information
    const streakResponse = await axios.get(
      `https://api.github.com/users/${username}/events`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    // Calculate streak
    let streak = 0;
    let currentDate = new Date();
    const events = streakResponse.data;
    
    for (const event of events) {
      const eventDate = new Date(event.created_at).toISOString().split('T')[0];
      if (eventDate === currentDate.toISOString().split('T')[0]) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      success: true,
      hasCommitted,
      commitCount,
      streak
    };
  } catch (error) {
    console.error('Error checking GitHub commits:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to check commits'
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
    // Verify the credentials first
    const result = await checkGitHubCommits(settings.githubUsername, settings.githubToken);
    
    if (!result.success) {
      return result;
    }
    
    // If verification succeeds, save the settings
    store.set('settings', settings);
    return result;
  } catch (error) {
    console.error('Error in save-settings handler:', error);
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
    return { success: true };
  } catch (error) {
    console.error('Error resetting settings:', error);
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