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
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
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
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.cloak-preview'
        }
      }
    );

    return {
      success: true,
      hasCommitted: response.data.total_count > 0
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message
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
  store.set('settings', settings);
  const result = await checkGitHubCommits(settings.githubUsername, settings.githubToken);
  return result;
});

ipcMain.handle('check-commits', async () => {
  const settings = store.get('settings');
  return await checkGitHubCommits(settings?.githubUsername, settings?.githubToken);
});

ipcMain.handle('get-settings', () => {
  return store.get('settings') || { githubUsername: '', githubToken: '' };
});

// Handle update installation
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});