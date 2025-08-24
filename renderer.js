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

    // Debug panel elements
    const debugToggleBtn = document.getElementById('debug-toggle-btn');
    const debugPanel = document.getElementById('debug-panel');
    const refreshDebugBtn = document.getElementById('refresh-debug-btn');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const logLevelSelect = document.getElementById('log-level-select');
    const cacheStats = document.getElementById('cache-stats');
    const rateLimitInfo = document.getElementById('rate-limit-info');
    const apiResults = document.getElementById('api-results');
    const logsContent = document.getElementById('logs-content');

    let debugMode = false;
    let lastCheckResult = null;

    window.electronAPI.onUpdateReady(() => {
        const confirmUpdate = confirm("A new update is ready. Would you like to install it now?");
        if (confirmUpdate) {
          window.electronAPI.installUpdate();
        }
      });
      
    // Helper function to show message with better error details
    function showMessage(message, type = '', details = null) {
        statusMessage.textContent = message;
        statusMessage.className = type;
        
        // If debug mode is on and we have error details, show them
        if (debugMode && details && type === 'error') {
            updateErrorDetails(details);
        }
    }

    // Helper function to show detailed error information
    function showDetailedError(error) {
        let message = error.message || 'An unknown error occurred';
        let solutions = [];
        
        if (error.details && error.details.solutions) {
            solutions = error.details.solutions;
        }
        
        // Create a more informative error message
        let fullMessage = message;
        if (solutions.length > 0) {
            fullMessage += '\n\nSuggested solutions:\n' + solutions.map((s, i) => `${i + 1}. ${s}`).join('\n');
        }
        
        showMessage(fullMessage, 'error', error.details);
    }

    // Helper function to update error details in debug mode
    function updateErrorDetails(details) {
        if (!debugMode) return;
        
        const errorDetailsHtml = `
            <div class="error-details">
                <strong>Error Type:</strong> ${details.type || 'Unknown'}<br>
                <strong>Technical Details:</strong> ${details.technical || 'None'}<br>
                ${details.statusCode ? `<strong>HTTP Status:</strong> ${details.statusCode}<br>` : ''}
                ${details.apiMessage ? `<strong>API Message:</strong> ${details.apiMessage}<br>` : ''}
                ${details.rateLimitRemaining !== undefined ? `<strong>Rate Limit Remaining:</strong> ${details.rateLimitRemaining}<br>` : ''}
                ${details.rateLimitReset ? `<strong>Rate Limit Resets:</strong> ${new Date(details.rateLimitReset).toLocaleString()}<br>` : ''}
            </div>
        `;
        
        // Add to API results in debug panel
        if (apiResults) {
            apiResults.innerHTML = errorDetailsHtml;
        }
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

    // Debug panel functions
    function toggleDebugMode() {
        debugMode = !debugMode;
        debugPanel.classList.toggle('hidden', !debugMode);
        debugToggleBtn.textContent = debugMode ? '🔧 Hide Debug' : '🔧 Debug Mode';
        
        if (debugMode) {
            refreshDebugInfo();
        }
    }

    async function refreshDebugInfo() {
        if (!debugMode) return;
        
        try {
            // Update cache stats
            const cacheStatsData = await window.electronAPI.getCacheStats();
            cacheStats.textContent = JSON.stringify(cacheStatsData, null, 2);
            
            // Update rate limit status
            const rateLimitStatus = await window.electronAPI.getRateLimitStatus();
            rateLimitInfo.textContent = JSON.stringify(rateLimitStatus, null, 2);
            
            // Update logs
            const logs = await window.electronAPI.getLogs(logLevelSelect.value, 50);
            displayLogs(logs);
            
            // Update API results if we have a recent check
            if (lastCheckResult) {
                displayAPIResults(lastCheckResult);
            }
        } catch (error) {
            console.error('Failed to refresh debug info:', error);
        }
    }

    function displayLogs(logs) {
        if (!logs || logs.length === 0) {
            logsContent.textContent = 'No logs available';
            return;
        }
        
        const logEntries = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            return `<div class="log-entry">
                <div class="log-timestamp">${timestamp}</div>
                <span class="log-level ${log.level}">${log.level}</span>
                <span>${log.message}</span>
                ${log.data ? `\n  ${JSON.stringify(log.data, null, 2)}` : ''}
            </div>`;
        }).join('');
        
        logsContent.innerHTML = logEntries;
        logsContent.scrollTop = logsContent.scrollHeight;
    }

    function displayAPIResults(result) {
        if (!result || !result.debug) {
            apiResults.textContent = 'No API debug information available';
            return;
        }
        
        const methods = result.debug.methods;
        let html = '<div class="api-methods">';
        
        for (const [methodName, methodResult] of Object.entries(methods)) {
            if (!methodResult) continue;
            
            const status = methodResult.success ? 'success' : 'error';
            html += `<div class="method-result ${status}">
                <div class="method-name">${methodName}</div>
                <div class="method-details">
                    Status: ${methodResult.success ? 'Success' : 'Failed'}<br>
                    ${methodResult.commitCount !== undefined ? `Commits: ${methodResult.commitCount}<br>` : ''}
                    ${methodResult.error ? `Error: ${methodResult.error}<br>` : ''}
                    ${methodResult.details ? `Details: ${JSON.stringify(methodResult.details, null, 2)}` : ''}
                </div>
            </div>`;
        }
        
        html += '</div>';
        
        if (result.debug.rateLimitStatus) {
            html += `<div class="rate-limit-status">
                <strong>Rate Limit Status:</strong><br>
                ${JSON.stringify(result.debug.rateLimitStatus, null, 2)}
            </div>`;
        }
        
        apiResults.innerHTML = html;
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

        // Basic validation
        if (username.length < 2 || username.includes(' ')) {
            showMessage('Invalid GitHub username format', 'error');
            return;
        }

        if (token.length < 10) {
            showMessage('Invalid token format - token too short', 'error');
            return;
        }

        setLoading(true);
        try {
            const result = await window.electronAPI.saveSettings({ githubUsername: username, githubToken: token });
            
            if (result.success) {
                setupForm.classList.add('hidden');
                statusContainer.classList.remove('hidden');
                updateGitHubInfo(username, `https://github.com/${username}.png`);
                
                // Store the result for debug panel
                lastCheckResult = result;
                
                // Show success and update UI
                showMessage('Settings saved successfully! ✅', 'success');
                await checkCommits();
            } else {
                showDetailedError(result);
            }
        } catch (error) {
            showMessage('Failed to save settings: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    });

    // Check commits
    async function checkCommits() {
        setLoading(true);
        try {
            const result = await window.electronAPI.checkCommits();
            
            // Store result for debug panel
            lastCheckResult = result;
            
            if (result.success) {
                const message = result.hasCommitted ? 'You made a commit today! 🎉' : 'No commits yet today';
                showMessage(message, result.hasCommitted ? 'success' : '');
                updateStatusImages(result.hasCommitted);
                commitCount.textContent = result.commitCount || 0;
                streakCount.textContent = result.streak || 0;
                
                // Show detailed status if debug mode is on
                if (debugMode && result.debug) {
                    displayAPIResults(result);
                }
            } else {
                showDetailedError(result);
                updateStatusImages(false);
            }
        } catch (error) {
            showMessage('Failed to check commits: ' + error.message, 'error');
            updateStatusImages(false);
        } finally {
            setLoading(false);
            
            // Refresh debug info if debug mode is on
            if (debugMode) {
                setTimeout(() => refreshDebugInfo(), 500);
            }
        }
    }

    // Check now button
    checkNowBtn.addEventListener('click', checkCommits);

    // Reset settings
    resetSettingsBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reset all settings? This action cannot be undone.')) {
            return;
        }
        
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
            
            // Clear last check result
            lastCheckResult = null;
            
        } catch (error) {
            showMessage('Failed to reset settings: ' + error.message, 'error');
        }
    });

    // Debug panel event listeners
    debugToggleBtn.addEventListener('click', toggleDebugMode);
    
    refreshDebugBtn.addEventListener('click', refreshDebugInfo);
    
    clearLogsBtn.addEventListener('click', async () => {
        try {
            await window.electronAPI.clearLogs();
            showMessage('Logs cleared', 'success');
            if (debugMode) {
                refreshDebugInfo();
            }
        } catch (error) {
            showMessage('Failed to clear logs', 'error');
        }
    });
    
    clearCacheBtn.addEventListener('click', async () => {
        try {
            await window.electronAPI.clearCache();
            showMessage('Cache cleared', 'success');
            if (debugMode) {
                refreshDebugInfo();
            }
        } catch (error) {
            showMessage('Failed to clear cache', 'error');
        }
    });
    
    logLevelSelect.addEventListener('change', async () => {
        try {
            await window.electronAPI.setLogLevel(logLevelSelect.value);
            if (debugMode) {
                refreshDebugInfo();
            }
        } catch (error) {
            console.error('Failed to set log level:', error);
        }
    });

    // Initialize debug mode state
    if (debugMode) {
        refreshDebugInfo();
    }
});