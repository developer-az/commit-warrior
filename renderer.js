document.addEventListener('DOMContentLoaded', () => {
    // Get UI elements
    const statusContainer = document.getElementById('status-container');
    const setupForm = document.getElementById('setup-form');
    const statusIcon = document.getElementById('status-icon');
    const statusMessage = document.getElementById('status-message');
    const usernameInput = document.getElementById('github-username');
    const tokenInput = document.getElementById('github-token');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const checkNowBtn = document.getElementById('check-now-btn');
    
    // Add console log to debug
    console.log('Elements:', {
      statusContainer: !!statusContainer,
      setupForm: !!setupForm,
      saveSettingsBtn: !!saveSettingsBtn
    });
    
    // Force show the setup form at startup
    setupForm.classList.remove('hidden');
    statusContainer.classList.add('hidden');
    
    // Show setup form when needed
    window.electronAPI.onSetupRequired(() => {
      statusContainer.classList.add('hidden');
      setupForm.classList.remove('hidden');
    });
    
    // Save settings button
    saveSettingsBtn.addEventListener('click', () => {
      console.log('Save button clicked');
      const username = usernameInput.value.trim();
      const token = tokenInput.value.trim();
      
      console.log('Saving settings:', { username, hasToken: !!token });
      
      if (username && token) {
        // Send settings in the correct format expected by main process
        window.electronAPI.saveSettings({
          githubUsername: username,
          githubToken: token
        });
      } else {
        statusMessage.textContent = 'Please enter both username and token.';
      }
    });
    
    // Check now button
    checkNowBtn.addEventListener('click', () => {
      window.electronAPI.checkCommits();
    });
    
    // Handle commit status updates
    window.electronAPI.onCommitStatus((hasCommitted) => {
      statusContainer.classList.remove('hidden');
      setupForm.classList.add('hidden');
      
      statusIcon.textContent = hasCommitted ? '✓' : '✗';
      statusIcon.className = hasCommitted ? 'status-icon committed' : 'status-icon not-committed';
      statusMessage.textContent = hasCommitted ? 
        'You made a commit today! 🎉' : 
        'No commits yet today';
    });
    
    // Handle API errors
    window.electronAPI.onApiError((error) => {
      statusMessage.textContent = `Error: ${error}`;
      statusIcon.textContent = '⚠';
      statusIcon.className = 'status-icon error';
    });
  });