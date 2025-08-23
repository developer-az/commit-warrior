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
    
    // Status info elements
    const statusInfo = document.getElementById('status-info');
    const methodInfo = document.getElementById('method-info');
    const cacheInfo = document.getElementById('cache-info');
    const rateLimitInfo = document.getElementById('rate-limit-info');

    window.electronAPI.onUpdateReady(() => {
        const confirmUpdate = confirm("A new update is ready. Would you like to install it now?");
        if (confirmUpdate) {
          window.electronAPI.installUpdate();
        }
      });
      

    // Enhanced helper function to show messages with better UX
    function showMessage(message, type = '') {
        statusMessage.textContent = message;
        statusMessage.className = type;
        
        // Auto-clear success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusMessage.textContent = '';
                statusMessage.className = '';
            }, 5000);
        }
        
        // Log for debugging
        console.log(`[${type.toUpperCase() || 'INFO'}] ${message}`);
    }

    // Enhanced loading state management
    function setLoading(isLoading) {
        // Disable buttons during loading
        saveSettingsBtn.disabled = isLoading;
        checkNowBtn.disabled = isLoading;
        resetSettingsBtn.disabled = isLoading;
        
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

    // Enhanced helper function to update GitHub info
    function updateGitHubInfo(username, avatarUrl, userInfo = null) {
        githubInfo.classList.remove('hidden');
        githubAvatar.src = avatarUrl;
        githubUsernameDisplay.textContent = userInfo?.name || username;
        
        // Add user info tooltip if available
        if (userInfo) {
            githubUsernameDisplay.title = `${userInfo.name || username} (${userInfo.login})${userInfo.company ? ` - ${userInfo.company}` : ''}`;
        }
    }

    // Enhanced settings loading with better error handling
    async function loadSettings() {
        try {
            const settings = await window.electronAPI.getSettings();
            
            if (settings?.githubUsername && settings?.githubToken) {
                setupForm.classList.add('hidden');
                statusContainer.classList.remove('hidden');
                
                // Use cached user info if available
                const avatarUrl = settings.userInfo?.avatar_url || `https://github.com/${settings.githubUsername}.png`;
                updateGitHubInfo(settings.githubUsername, avatarUrl, settings.userInfo);
                
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
            console.error('Error loading settings:', error);
            showMessage('Failed to load settings', 'error');
            setupForm.classList.remove('hidden');
            statusContainer.classList.add('hidden');
        }
    }

    // Initialize app by loading settings
    await loadSettings();

    // Enhanced save settings with better error handling
    saveSettingsBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const token = tokenInput.value.trim();

        if (!username || !token) {
            showMessage('Please enter both username and token', 'error');
            return;
        }

        // Basic validation
        if (username.length < 3) {
            showMessage('Username must be at least 3 characters long', 'error');
            return;
        }

        if (token.length < 20) {
            showMessage('Token appears to be too short. Please check your GitHub token.', 'error');
            return;
        }

        setLoading(true);
        showMessage('Validating credentials...', 'loading');
        
        try {
            const result = await window.electronAPI.saveSettings({ 
                githubUsername: username, 
                githubToken: token 
            });
            
            if (result.success) {
                showMessage('Credentials validated successfully! 🎉', 'success');
                setupForm.classList.add('hidden');
                statusContainer.classList.remove('hidden');
                
                // Get updated settings with user info
                const settings = await window.electronAPI.getSettings();
                const avatarUrl = settings.userInfo?.avatar_url || `https://github.com/${username}.png`;
                updateGitHubInfo(username, avatarUrl, settings.userInfo);
                
                // Clear the form
                tokenInput.value = '';
                
                await checkCommits();
            } else {
                let errorMessage = result.message || 'Failed to validate credentials';
                
                // Provide more helpful error messages
                if (result.error === 'INVALID_TOKEN') {
                    errorMessage = 'Invalid GitHub token. Please check your token and try again.';
                } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
                    errorMessage = 'Rate limit exceeded. Please wait a few minutes and try again.';
                } else if (result.error === 'NETWORK_ERROR') {
                    errorMessage = 'Network error. Please check your internet connection.';
                }
                
                showMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showMessage('An unexpected error occurred. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    });

    // Enhanced check commits with better feedback and caching awareness
    async function checkCommits() {
        setLoading(true);
        showMessage('Checking your GitHub activity...', 'loading');
        
        try {
            const result = await window.electronAPI.checkCommits();
            
            if (result.success) {
                // Create more detailed messages
                let message;
                let messageType = '';
                
                if (result.hasCommitted) {
                    const commitText = result.commitCount === 1 ? 'commit' : 'commits';
                    message = `🎉 You made ${result.commitCount} ${commitText} today!`;
                    messageType = 'success';
                } else {
                    message = '⏳ No commits yet today - keep coding!';
                    messageType = '';
                }
                
                // Add caching info if applicable
                if (result.cached) {
                    message += ' (cached)';
                }
                
                // Add method info for debugging (if verbose logging is enabled)
                if (result.method) {
                    console.log(`Commit data retrieved via: ${result.method}`);
                    methodInfo.textContent = `Data source: ${result.method} API`;
                }
                
                // Show cache status
                if (result.cached) {
                    cacheInfo.textContent = '⚡ Using cached data for faster response';
                } else {
                    cacheInfo.textContent = '';
                }
                
                // Show rate limit info if available
                if (result.rateLimitRemaining !== undefined) {
                    if (result.rateLimitRemaining < 100) {
                        rateLimitInfo.textContent = `⚠️ API limit: ${result.rateLimitRemaining} requests remaining`;
                        rateLimitInfo.style.color = '#f9c513';
                    } else {
                        rateLimitInfo.textContent = `✅ API status: ${result.rateLimitRemaining} requests remaining`;
                        rateLimitInfo.style.color = '#8b949e';
                    }
                }
                
                showMessage(message, messageType);
                updateStatusImages(result.hasCommitted);
                commitCount.textContent = result.commitCount || 0;
                streakCount.textContent = result.streak || 0;
                
                // Update streak display with additional info
                if (result.streak > 0) {
                    streakCount.title = `Current streak: ${result.streak} day${result.streak === 1 ? '' : 's'}`;
                    if (result.lastCommitDate) {
                        streakCount.title += `\nLast commit: ${new Date(result.lastCommitDate).toLocaleDateString()}`;
                    }
                }
                
            } else {
                let errorMessage = result.message || 'Failed to check commits';
                
                // Provide more specific error messages
                if (result.error === 'RATE_LIMIT_EXCEEDED') {
                    errorMessage = 'Rate limit exceeded. GitHub API is temporarily unavailable.';
                } else if (result.error === 'INVALID_TOKEN') {
                    errorMessage = 'Token validation failed. Please check your GitHub token.';
                } else if (result.error === 'NETWORK_ERROR') {
                    errorMessage = 'Network error. Please check your internet connection.';
                } else if (result.error === 'API_UNAVAILABLE') {
                    errorMessage = 'GitHub API is currently unavailable. Please try again later.';
                }
                
                showMessage(errorMessage, 'error');
                updateStatusImages(false);
                commitCount.textContent = '?';
                streakCount.textContent = '?';
                
                // Clear status info on error
                methodInfo.textContent = '';
                cacheInfo.textContent = '';
                rateLimitInfo.textContent = '';
            }
        } catch (error) {
            console.error('Error checking commits:', error);
            showMessage('An unexpected error occurred while checking commits', 'error');
            updateStatusImages(false);
            commitCount.textContent = '?';
            streakCount.textContent = '?';
            
            // Clear status info on error
            methodInfo.textContent = '';
            cacheInfo.textContent = '';
            rateLimitInfo.textContent = '';
        } finally {
            setLoading(false);
        }
    }

    // Check now button
    checkNowBtn.addEventListener('click', checkCommits);

    // Enhanced reset settings with confirmation
    resetSettingsBtn.addEventListener('click', async () => {
        const confirmed = confirm(
            'Are you sure you want to reset all settings?\n\n' +
            'This will clear your GitHub credentials and preferences.\n' +
            'You will need to set them up again.'
        );
        
        if (!confirmed) {
            return;
        }
        
        setLoading(true);
        showMessage('Resetting settings...', 'loading');
        
        try {
            const result = await window.electronAPI.resetSettings();
            
            if (result.success) {
                showMessage('Settings reset successfully', 'success');
                setupForm.classList.remove('hidden');
                statusContainer.classList.add('hidden');
                githubInfo.classList.add('hidden');
                
                // Clear form fields
                usernameInput.value = '';
                tokenInput.value = '';
                
                // Reset display values
                updateStatusImages(false);
                commitCount.textContent = '0';
                streakCount.textContent = '0';
                
                // Clear any tooltips
                streakCount.title = '';
            } else {
                showMessage(result.message || 'Failed to reset settings', 'error');
            }
        } catch (error) {
            console.error('Error resetting settings:', error);
            showMessage('An unexpected error occurred while resetting settings', 'error');
        } finally {
            setLoading(false);
        }
    });
});