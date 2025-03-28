const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

// Simple file-based storage
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Load settings from file or use defaults
let settings = { githubUsername: '', githubToken: '' };
try {
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
} catch (error) {
  console.error('Error loading settings:', error);
}

// Save settings to file
function saveSettings(newSettings) {
  settings = newSettings;
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

let mainWindow;
let tray;
let isQuitting = false;

// Create the app window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    },
    show: false,
    resizable: false
  });

  mainWindow.loadFile('index.html');
  
  // Show window when it's ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Hide app from taskbar/dock when closed
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

// Check GitHub commits
async function checkGitHubCommits() {
  const username = settings.githubUsername;
  const token = settings.githubToken;
  
  if (!username || !token) {
    mainWindow.webContents.send('setup-required');
    return false;
  }
  
  try {
    // Get today's date in ISO format (YYYY-MM-DD)
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
    
    const hasCommittedToday = response.data.total_count > 0;
    
    // Send result to renderer process
    mainWindow.webContents.send('commit-status', hasCommittedToday);
    
    // Update tray icon based on status
    updateTray(hasCommittedToday);
    
    return hasCommittedToday;
  } catch (error) {
    console.error('Error checking GitHub commits:', error);
    mainWindow.webContents.send('api-error', error.message);
    return false;
  }
}

// Update tray icon and tooltip
function updateTray(hasCommittedToday) {
  const iconName = hasCommittedToday ? 'committed.png' : 'not-committed.png';
  const iconPath = path.join(__dirname, 'assets', iconName);
  
  if (tray) {
    tray.setImage(iconPath);
    tray.setToolTip(hasCommittedToday ? 
      'You made a commit today! 🎉' : 
      'No commits yet today');
  }
}

app.whenReady().then(() => {
  createWindow();
  
  // Create tray icon (make sure icons exist in assets folder)
  const iconPath = path.join(__dirname, 'assets', 'not-committed.png');
  tray = new Tray(iconPath);
  tray.setToolTip('GitHub Commit Tracker');
  
  // Context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Check Now', click: checkGitHubCommits },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.show();
  });
  
  // Initial check after a short delay
  setTimeout(checkGitHubCommits, 1000);
  
  // Set up interval to check periodically (every 15 minutes)
  setInterval(checkGitHubCommits, 15 * 60 * 1000);
});

// Listen for save settings from renderer
ipcMain.on('save-settings', (event, newSettings) => {
  saveSettings(newSettings);
  checkGitHubCommits();
});

// Run a one-time check when requested
ipcMain.on('check-commits', () => {
  checkGitHubCommits();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});