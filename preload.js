const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  checkCommits: () => ipcRenderer.invoke('check-commits'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  onCommitStatus: (callback) => ipcRenderer.on('commit-status', (_, value) => callback(value)),
  onSetupRequired: (callback) => ipcRenderer.on('setup-required', () => callback()),
  onApiError: (callback) => ipcRenderer.on('api-error', (_, message) => callback(message)),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', () => callback()),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // Debug functions
  getLogs: (level, limit) => ipcRenderer.invoke('get-logs', level, limit),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  getRateLimitStatus: () => ipcRenderer.invoke('get-rate-limit-status'),
  setLogLevel: (level) => ipcRenderer.invoke('set-log-level', level),
  getCacheStats: () => ipcRenderer.invoke('get-cache-stats'),
  clearCache: () => ipcRenderer.invoke('clear-cache')
});