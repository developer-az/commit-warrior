const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Core functionality
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  checkCommits: () => ipcRenderer.invoke('check-commits'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  
  // Configuration management
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  updatePreference: (key, value) => ipcRenderer.invoke('update-preference', key, value),
  
  // Monitoring and debugging
  getRateLimit: () => ipcRenderer.invoke('get-rate-limit'),
  getDebugInfo: () => ipcRenderer.invoke('get-debug-info'),
  
  // Event listeners
  onCommitStatus: (callback) => ipcRenderer.on('commit-status', (_, value) => callback(value)),
  onSetupRequired: (callback) => ipcRenderer.on('setup-required', () => callback()),
  onApiError: (callback) => ipcRenderer.on('api-error', (_, message) => callback(message)),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', () => callback()),
  
  // Updates
  installUpdate: () => ipcRenderer.invoke('install-update')
});