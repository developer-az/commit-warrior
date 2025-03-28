const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveSettings: (settings) => {
    console.log('Sending settings to main process:', settings);
    ipcRenderer.send('save-settings', settings);
  },
  checkCommits: () => ipcRenderer.send('check-commits'),
  onCommitStatus: (callback) => ipcRenderer.on('commit-status', (_, value) => callback(value)),
  onSetupRequired: (callback) => ipcRenderer.on('setup-required', () => callback()),
  onApiError: (callback) => ipcRenderer.on('api-error', (_, message) => callback(message))
});