// Settings page functionality
document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const toggleApiKeyBtn = document.getElementById('toggleApiKey');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const deleteApiKeyBtn = document.getElementById('deleteApiKeyBtn');
    
    // Initialize LLM client
    const llmClient = new LLMClient();
    
    // Initialize logging
    const log = (message, data) => MCQUtils.debugLog('Settings', message, data);
    
    log('Settings page loaded');
    
    // Load saved settings
    try {
        // Load API key
        const apiKey = await llmClient.getApiKey();
        if (apiKey) {
            apiKeyInput.value = apiKey;
            log('API key loaded from storage');
        } else {
            log('No saved API key found');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        log('Error loading API key', error);
    }
    
    // Toggle API key visibility
    toggleApiKeyBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleApiKeyBtn.innerHTML = '<i class="bi bi-eye-slash"></i>';
        } else {
            apiKeyInput.type = 'password';
            toggleApiKeyBtn.innerHTML = '<i class="bi bi-eye"></i>';
        }
    });
    
    // Save settings
    saveSettingsBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            alert('Please enter a valid OpenAI API key');
            return;
        }
        
        try {
            log('Saving API key');
            saveSettingsBtn.disabled = true;
            saveSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
            
            // Save API key
            await llmClient.saveApiKey(apiKey);
            
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.className = 'alert alert-success mt-3';
            successMsg.textContent = 'API key saved successfully! Redirecting...';
            saveSettingsBtn.parentNode.appendChild(successMsg);
            
            log('API key saved successfully');
            
            // Redirect back to popup after a short delay
            setTimeout(() => {
                log('Redirecting to popup page');
                window.location.href = 'popup.html';
            }, 1500);
            
        } catch (error) {
            console.error('Error saving settings:', error);
            log('Error saving API key', error);
            alert('Error saving settings: ' + error.message);
            
            saveSettingsBtn.disabled = false;
            saveSettingsBtn.textContent = 'Save Settings';
        }
    });

    // Delete API key
    deleteApiKeyBtn.addEventListener('click', async () => {
        try {
            // Check if API key exists in storage first
            const apiKey = await llmClient.getApiKey();
            
            if (!apiKey) {
                // No API key exists
                const warningMsg = document.createElement('div');
                warningMsg.className = 'alert alert-warning mt-3';
                warningMsg.textContent = 'No API key found to delete.';
                deleteApiKeyBtn.parentNode.parentNode.appendChild(warningMsg);
                
                log('No API key found to delete');
                
                // Remove warning message after a delay
                setTimeout(() => {
                    warningMsg.remove();
                }, 3000);
                
                return;
            }
            
            // If key exists, ask for confirmation
            if (confirm('Are you sure you want to delete the saved API key?')) {
                log('Deleting API key');
                deleteApiKeyBtn.disabled = true;
                deleteApiKeyBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
                
                // Delete API key from storage
                await new Promise((resolve, reject) => {
                    chrome.storage.sync.remove('openaiApiKey', () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });
                
                // Clear input field
                apiKeyInput.value = '';
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'alert alert-success mt-3';
                successMsg.textContent = 'API key deleted successfully!';
                deleteApiKeyBtn.parentNode.parentNode.appendChild(successMsg);
                
                log('API key deleted successfully');
                
                // Reset button state after a short delay
                setTimeout(() => {
                    deleteApiKeyBtn.disabled = false;
                    deleteApiKeyBtn.innerHTML = 'Delete API Key';
                    // Remove success message
                    successMsg.remove();
                }, 3000);
            }
        } catch (error) {
            console.error('Error deleting API key:', error);
            log('Error deleting API key', error);
            alert('Error deleting API key: ' + error.message);
            
            deleteApiKeyBtn.disabled = false;
            deleteApiKeyBtn.textContent = 'Delete API Key';
        }
    });
}); 