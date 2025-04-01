document.addEventListener('DOMContentLoaded', async () => {
    // Get UI elements
    const statusContainer = document.getElementById('status-container');
    const setupForm = document.getElementById('setup-form');
    const statusIcon = document.getElementById('status-icon');
    const statusMessage = document.getElementById('status-message');
    const usernameInput = document.getElementById('github-username');
    const tokenInput = document.getElementById('github-token');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const checkNowBtn = document.getElementById('check-now-btn');
    const updateBanner = document.getElementById('update-banner');
    const updateNowBtn = document.getElementById('update-now-btn');
    const appVersion = document.getElementById('app-version');
    
    // Set current version
    appVersion.textContent = process.env.npm_package_version || '1.0.0';
    
    // Load saved settings
    const settings = await window.electronAPI.getSettings();
    
    // Show appropriate UI based on settings
    if (settings?.githubUsername && settings?.githubToken) {
      setupForm.classList.add('hidden');
      statusContainer.classList.remove('hidden');
      // Perform initial check only if we have credentials
      const initialResult = await window.electronAPI.checkCommits();
      updateUI(initialResult);
    } else {
      setupForm.classList.remove('hidden');
      statusContainer.classList.add('hidden');
      if (settings?.githubUsername) {
        usernameInput.value = settings.githubUsername;
      }
    }
    
    // Show setup form when needed
    window.electronAPI.onSetupRequired(() => {
      statusContainer.classList.add('hidden');
      setupForm.classList.remove('hidden');
    });
    
    // Save settings button
    saveSettingsBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      const token = tokenInput.value.trim();
      
      if (!username || !token) {
        statusMessage.textContent = 'Please enter both username and token.';
        return;
      }
      
      const result = await window.electronAPI.saveSettings({ githubUsername: username, githubToken: token });
      if (result.success) {
        setupForm.classList.add('hidden');
        statusContainer.classList.remove('hidden');
      }
      updateUI(result);
    });
    
    // Check commits
    checkNowBtn.addEventListener('click', async () => {
      const result = await window.electronAPI.checkCommits();
      updateUI(result);
    });

    // Handle update ready
    window.electronAPI.onUpdateReady(() => {
      updateBanner.classList.add('show');
    });

    // Handle update installation
    updateNowBtn.addEventListener('click', () => {
      window.electronAPI.installUpdate();
    });
    
    // Update UI based on result
    function updateUI(result) {
      if (!result.success) {
        statusIcon.textContent = '⚠';
        statusIcon.className = 'status-icon error';
        statusMessage.textContent = result.message;
        return;
      }
      
      statusIcon.textContent = result.hasCommitted ? '✓' : '✗';
      statusIcon.className = result.hasCommitted ? 'status-icon committed' : 'status-icon not-committed';
      statusMessage.textContent = result.hasCommitted ? 
        'You made a commit today! 🎉' : 
        'No commits yet today';
    }
});