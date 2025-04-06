// Ensure utility scripts (validation.js, rate-limiter.js) are loaded first

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const queryInput = document.getElementById('queryInput');
  const queryValidation = document.getElementById('queryValidation');
  const submitButton = document.getElementById('submitButton');
  const rateLimitInfo = document.getElementById('rateLimitInfo');
  const statusMessage = document.getElementById('statusMessage');
  const spinner = document.getElementById('spinner');
  const urlListContainer = document.getElementById('urlListContainer');
  const urlListItems = document.getElementById('urlListItems');
  const tabCountEl = document.getElementById('tabCount');
  const resultContainer = document.getElementById('resultContainer');
  const resultContent = document.getElementById('resultContent');
  const copyResponseButton = document.getElementById('copyResponseButton'); // Added
  const toggleUrlsLink = document.getElementById('toggleUrlsLink');

  // Settings form elements
  const apiKeyInput = document.getElementById('apiKey');
  const rateLimitInput = document.getElementById('rateLimit');
  const maxTabsInput = document.getElementById('maxTabs');
  const saveButton = document.getElementById('saveButton');
  const statusElement = document.getElementById('status');
  const apiKeyValidationElement = document.getElementById('apiKeyValidation');

  // --- State Variables ---
  let currentSettings = { apiKey: null, maxTabs: 10 }; // Store loaded settings
  let isRateLimited = false; // Track rate limit status


  // --- Helper Functions ---

  // Show status messages (info, success, warning, error)
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    // Reset classes first
    statusMessage.className = 'status-message';
    if (type !== 'info') { // Add specific class if not default info
        statusMessage.classList.add(type);
    }
  }

  // Show/hide spinner
  function showSpinner(show) {
    spinner.classList.toggle('hidden', !show);
  }

  // Update submit button state based on validation and rate limit
  function updateSubmitButtonState() {
    const queryValidationResult = validateQuery(queryInput.value);
    const isQueryValid = queryValidationResult.valid;
    const isApiKeySet = !!currentSettings.apiKey;

    // Disable if API key missing, query invalid, or rate limited
    submitButton.disabled = !isApiKeySet || !isQueryValid || isRateLimited;
  }

  // Handle query input validation
  function handleQueryValidation() {
    const validationResult = validateQuery(queryInput.value);
    if (!validationResult.valid) {
      queryValidation.textContent = validationResult.message;
      queryValidation.classList.add('error');
    } else {
      queryValidation.textContent = '';
      queryValidation.classList.remove('error');
    }
    updateSubmitButtonState(); // Update button whenever query validity changes
  }

  // Update rate limit display and state
  async function updateRateLimitDisplay() {
      try {
          const rateLimit = await checkRateLimit(); // From rate-limiter.js
          if (rateLimit.allowed) {
              rateLimitInfo.textContent = `${rateLimit.remaining} requests left`;
              rateLimitInfo.className = 'rate-limit-info'; // Reset class
              isRateLimited = false;
          } else {
              rateLimitInfo.textContent = rateLimit.message;
              rateLimitInfo.className = 'rate-limit-info warning'; // Add warning class
              isRateLimited = true;
          }
      } catch (error) {
          console.error("Error updating rate limit display:", error);
          rateLimitInfo.textContent = "Rate limit status unavailable";
          rateLimitInfo.className = 'rate-limit-info warning';
          isRateLimited = false; // Fail open? Or assume limited? Let's fail open for now.
      }
      updateSubmitButtonState(); // Update button state based on new rate limit status
  }


  // --- Initialization ---
  async function initializePopup() {
    showStatus('Initializing...', 'info');
    showSpinner(true);

    try {
      // 1. Load settings (API Key, maxTabs)
      currentSettings = await chrome.storage.sync.get({ apiKey: '', maxTabs: 10 });

      // 2. Check API Key
      if (!currentSettings.apiKey) {
        showStatus('API key not set. Please configure in options.', 'error');
        submitButton.disabled = true; // Keep disabled
        showSpinner(false);
        return; // Stop initialization
      }

      // 3. Check and display initial rate limit
      await updateRateLimitDisplay(); // This also updates button state

      // 4. Add event listeners
      queryInput.addEventListener('input', handleQueryValidation);
      submitButton.addEventListener('click', handleSubmit);
      toggleUrlsLink.addEventListener('click', handleToggleUrls);

      // Keyboard shortcut: Cmd+Enter (Mac) or Ctrl+Enter (Win/Linux) to submit if input is valid
      queryInput.addEventListener('keydown', (event) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCmdEnter = isMac && event.metaKey && event.key === 'Enter';
        const isCtrlEnter = !isMac && event.ctrlKey && event.key === 'Enter';
        if ((isCmdEnter || isCtrlEnter) && queryInput === document.activeElement) {
          const validationResult = validateQuery(queryInput.value.trim());
          if (validationResult.valid) {
            event.preventDefault();
            handleSubmit();
          }
        }
      });

      // 5. Initial validation for query (in case it has pre-filled value, unlikely)
      handleQueryValidation();

      showStatus('Ready.', 'info'); // Clear initializing message

    } catch (error) {
        console.error("Initialization failed:", error);
        showStatus('Error initializing extension.', 'error');
        submitButton.disabled = true;
    } finally {
        showSpinner(false);
    }
  }

  // --- Event Handlers ---

  // Handle query submission
  async function handleSubmit() {
    // Final validation checks before proceeding
    const query = queryInput.value.trim();
    const queryValidationResult = validateQuery(query);
    if (!queryValidationResult.valid) {
      showStatus(queryValidationResult.message, 'error');
      queryInput.focus();
      return;
    }
    if (!currentSettings.apiKey) {
        showStatus('API key is missing. Configure in options.', 'error');
        return;
    }

    // Check rate limit again right before sending
    const rateLimitCheck = await checkRateLimit();
    if (!rateLimitCheck.allowed) {
        showStatus(rateLimitCheck.message, 'error'); // Show specific rate limit message
        isRateLimited = true;
        updateSubmitButtonState();
        return;
    }

    // --- Start processing ---
    showSpinner(true);
    submitButton.disabled = true; // Disable during processing
    resultContainer.classList.add('hidden'); // Hide previous results
    urlListContainer.classList.add('hidden'); // Hide previous URL list
    copyResponseButton.style.display = 'none'; // Hide copy button
    showStatus('Gathering tab information...', 'info');

    try {
      // 1. Get Tabs
      const allTabs = await chrome.tabs.query({});
      let relevantTabs = allTabs
        .filter(tab => tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:')))
        .map(tab => ({ url: tab.url, title: tab.title || tab.url })); // Use URL as title if missing

      // 2. Limit Tabs
      const originalTabCount = relevantTabs.length;
      if (relevantTabs.length > currentSettings.maxTabs) {
        relevantTabs = relevantTabs.slice(0, currentSettings.maxTabs);
        showStatus(`Using ${relevantTabs.length} of ${originalTabCount} tabs (limit applied)...`, 'warning');
      } else {
        showStatus(`Using ${relevantTabs.length} tabs...`, 'info');
      }

      // 3. Display Used Tabs (update UI list)
      tabCountEl.textContent = relevantTabs.length;
      urlListItems.innerHTML = ''; // Clear previous list
      if (relevantTabs.length > 0) {
          relevantTabs.forEach(tab => {
            const li = document.createElement('li');
            li.textContent = `${tab.title} (${tab.url})`;
            li.title = `${tab.title}\n${tab.url}`; // Tooltip for full URL/title
            urlListItems.appendChild(li);
          });
          // Don't show the list yet, wait for toggle click
      } else {
          urlListItems.innerHTML = '<li>No relevant tabs found or used.</li>';
      }


      // 4. Send to Background Script
      showStatus('Sending query to Perplexity...', 'info');
      const response = await chrome.runtime.sendMessage({
        action: 'processQuery',
        query: query,
        tabUrls: relevantTabs // Send the filtered/limited list
      });

      // 5. Handle Response
      if (response && response.error) {
        throw new Error(response.error); // Throw error to be caught below
      } else if (response && response.result) {
        resultContent.textContent = response.result;
        resultContainer.classList.remove('hidden');
        copyResponseButton.style.display = 'inline-block'; // Show copy button
        // Add listener only once after button is shown
        copyResponseButton.removeEventListener('click', handleCopyResponse); // Remove previous if any
        copyResponseButton.addEventListener('click', handleCopyResponse);
        showStatus('Query successful!', 'success');

        // Increment rate limit count AFTER successful request
        await incrementRequestCount();
        await updateRateLimitDisplay(); // Update display immediately

      } else {
        // Handle unexpected response format
        throw new Error('Invalid response received from background script.');
      }

    } catch (error) {
      console.error("Error during query submission:", error);
      showStatus(`Error: ${error.message}`, 'error');
      // Ensure result container is hidden on error
      resultContainer.classList.add('hidden');
      copyResponseButton.style.display = 'none'; // Hide copy button on error
    } finally {
      // --- Cleanup ---
      showSpinner(false);
      // Re-enable button based on current state (rate limit might have changed)
      await updateRateLimitDisplay(); // Ensure button state is correct after potential rate limit change
    }
  }


  // Handle Toggle URLs link click
  function handleToggleUrls(event) {
    event.preventDefault();
    const isHidden = urlListContainer.classList.toggle('hidden');
    toggleUrlsLink.textContent = isHidden ? 'Show Used Tabs' : 'Hide Used Tabs';
    toggleUrlsLink.title = isHidden ? 'Show the list of tabs used in the last query' : 'Hide the list of tabs used';
  }

  // Handle Copy Response button click
  async function handleCopyResponse() {
    const textToCopy = resultContent.textContent;
    if (!textToCopy) return; // Nothing to copy

    try {
      await navigator.clipboard.writeText(textToCopy);
      // Provide feedback
      const originalText = copyResponseButton.textContent;
      copyResponseButton.textContent = 'Copied!';
      copyResponseButton.disabled = true; // Briefly disable
      setTimeout(() => {
        copyResponseButton.textContent = originalText;
        copyResponseButton.disabled = false;
      }, 1500); // Reset after 1.5 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showStatus('Failed to copy response.', 'error'); // Use main status area
    }
  }



  // --- Initialize UI ---
  initializePopup();

  // --- Settings Logic ---
  let statusTimeout;
  function showSettingsStatus(message, type = 'status', duration = 3000) {
    clearTimeout(statusTimeout);
    statusElement.textContent = message;
    statusElement.className = 'status-message';
    if (type === 'success') {
      statusElement.classList.add('success');
    } else if (type === 'error') {
      statusElement.classList.add('error');
    }
    if (duration > 0) {
      statusTimeout = setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status-message';
      }, duration);
    }
  }

  function handleApiKeyValidation() {
    const apiKey = apiKeyInput.value;
    const validationResult = validateApiKey(apiKey);
    if (!validationResult.valid) {
      apiKeyValidationElement.textContent = validationResult.message;
      apiKeyValidationElement.classList.add('error');
      saveButton.disabled = true;
    } else {
      apiKeyValidationElement.textContent = '';
      apiKeyValidationElement.classList.remove('error');
      saveButton.disabled = false;
    }
    return validationResult.valid;
  }

  function loadSettings() {
    chrome.storage.sync.get({
      apiKey: '',
      rateLimit: 10,
      maxTabs: 10
    }, (items) => {
      if (chrome.runtime.lastError) {
        console.error("Error loading settings:", chrome.runtime.lastError);
        showSettingsStatus('Error loading settings', 'error');
        return;
      }
      apiKeyInput.value = items.apiKey;
      rateLimitInput.value = items.rateLimit;
      maxTabsInput.value = items.maxTabs;
      handleApiKeyValidation();
    });
  }

  function saveSettings() {
    if (!handleApiKeyValidation()) {
      showSettingsStatus('Cannot save: Invalid API key format', 'error');
      apiKeyInput.focus();
      return;
    }

    const apiKey = apiKeyInput.value.trim();
    const rateLimit = Math.min(Math.max(parseInt(rateLimitInput.value, 10) || 10, 1), 100);
    const maxTabs = Math.min(Math.max(parseInt(maxTabsInput.value, 10) || 10, 1), 50);

    rateLimitInput.value = rateLimit;
    maxTabsInput.value = maxTabs;

    chrome.storage.sync.set({
      apiKey,
      rateLimit,
      maxTabs
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving settings:", chrome.runtime.lastError);
        showSettingsStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        showSettingsStatus('Settings saved successfully!', 'success');

        chrome.storage.local.set({
          requestCount: 0,
          lastResetTime: Date.now()
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error resetting rate limit state:", chrome.runtime.lastError);
          }
        });
      }
    });
  }

  apiKeyInput.addEventListener('input', handleApiKeyValidation);
  saveButton.addEventListener('click', saveSettings);
  loadSettings();

});