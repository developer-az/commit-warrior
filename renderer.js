document.addEventListener('DOMContentLoaded', async () => {
    // Get UI elements
    const setupForm = document.getElementById('setup-form');
    const statusContainer = document.getElementById('status-container');
    const statusMessage = document.getElementById('status-message');
    const usernameInput = document.getElementById('github-username');
    const tokenInput = document.getElementById('github-token');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const checkNowBtn = document.getElementById('check-now-btn');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    const committedImage = document.getElementById('committed-image');
    const notCommittedImage = document.getElementById('not-committed-image');
    const githubInfo = document.getElementById('github-info');
    const githubAvatar = document.getElementById('github-avatar');
    const githubUsernameDisplay = document.getElementById('github-username-display');
    const commitCount = document.getElementById('commit-count');
    const streakCount = document.getElementById('streak-count');
    const loadingSpinner = document.getElementById('loading-spinner');

    window.electronAPI.onUpdateReady(() => {
        const confirmUpdate = confirm("A new update is ready. Would you like to install it now?");
        if (confirmUpdate) {
          window.electronAPI.installUpdate();
        }
      });
      

    // Helper function to show message
    function showMessage(message, type = '') {
        statusMessage.textContent = message;
        statusMessage.className = type;
    }

    // Helper function to set loading state
    function setLoading(isLoading) {
        saveSettingsBtn.disabled = isLoading;
        checkNowBtn.disabled = isLoading;
        loadingSpinner.classList.toggle('visible', isLoading);
        if (isLoading) {
            showMessage('Loading...', 'loading');
        }
    }

    // Helper function to update status images
    function updateStatusImages(hasCommitted) {
        committedImage.classList.toggle('visible', hasCommitted);
        notCommittedImage.classList.toggle('visible', !hasCommitted);
    }

    // Helper function to update GitHub info
    function updateGitHubInfo(username, avatarUrl) {
        githubInfo.classList.remove('hidden');
        githubAvatar.src = avatarUrl;
        githubUsernameDisplay.textContent = username;
    }

    // Load saved settings
    try {
        const settings = await window.electronAPI.getSettings();
        if (settings?.githubUsername && settings?.githubToken) {
            setupForm.classList.add('hidden');
            statusContainer.classList.remove('hidden');
            updateGitHubInfo(settings.githubUsername, `https://github.com/${settings.githubUsername}.png`);
            await checkCommits();
        } else {
            setupForm.classList.remove('hidden');
            statusContainer.classList.add('hidden');
            githubInfo.classList.add('hidden');
            if (settings?.githubUsername) {
                usernameInput.value = settings.githubUsername;
            }
        }
    } catch (error) {
        showMessage('Failed to load settings', 'error');
    }

    // Save settings
    saveSettingsBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const token = tokenInput.value.trim();

        if (!username || !token) {
            showMessage('Please enter both username and token', 'error');
            return;
        }

        setLoading(true);
        try {
            const result = await window.electronAPI.saveSettings({ githubUsername: username, githubToken: token });
            
            if (result.success) {
                setupForm.classList.add('hidden');
                statusContainer.classList.remove('hidden');
                updateGitHubInfo(username, `https://github.com/${username}.png`);
                await checkCommits();
            } else {
                showMessage(result.message, 'error');
            }
        } catch (error) {
            showMessage('Failed to save settings', 'error');
        } finally {
            setLoading(false);
        }
    });

    // Check commits
    async function checkCommits() {
        setLoading(true);
        try {
            const result = await window.electronAPI.checkCommits();
            if (result.success) {
                const message = result.hasCommitted ? 'You made a commit today! 🎉' : 'No commits yet today';
                showMessage(message, result.hasCommitted ? 'success' : '');
                updateStatusImages(result.hasCommitted);
                commitCount.textContent = result.commitCount || 0;
                streakCount.textContent = result.streak || 0;
            } else {
                showMessage(result.message, 'error');
                updateStatusImages(false);
            }
        } catch (error) {
            showMessage('Failed to check commits', 'error');
            updateStatusImages(false);
        } finally {
            setLoading(false);
        }
    }

    // Check now button
    checkNowBtn.addEventListener('click', checkCommits);

    // Reset settings
    resetSettingsBtn.addEventListener('click', async () => {
        try {
            await window.electronAPI.resetSettings();
            setupForm.classList.remove('hidden');
            statusContainer.classList.add('hidden');
            githubInfo.classList.add('hidden');
            usernameInput.value = '';
            tokenInput.value = '';
            showMessage('Settings reset successfully', 'success');
            updateStatusImages(false);
            commitCount.textContent = '0';
            streakCount.textContent = '0';
        } catch (error) {
            showMessage('Failed to reset settings', 'error');
        }
    });
});