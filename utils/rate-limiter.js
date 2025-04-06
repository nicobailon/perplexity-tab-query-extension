const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Checks if the user has exceeded their rate limit using Chrome storage.
 * @returns {Promise<Object>} Result with allowed flag, message, and remaining count.
 */
async function checkRateLimit() {
  try {
    const defaultLimit = 10;

    // Fetch rate limit from sync storage
    const syncData = await chrome.storage.sync.get({ rateLimit: defaultLimit });
    const limit = syncData.rateLimit || defaultLimit;

    // Fetch request count and last reset time from local storage
    const now = Date.now();
    const localData = await chrome.storage.local.get({
      requestCount: 0,
      lastResetTime: now
    });

    let count = localData.requestCount || 0;
    let lastResetTime = localData.lastResetTime || now;

    // Check if more than an hour has passed since last reset
    if (now - lastResetTime > ONE_HOUR_MS) {
      count = 0;
      lastResetTime = now;
      await chrome.storage.local.set({
        requestCount: 0,
        lastResetTime: now
      });
    }

    const remaining = limit - count;
    const allowed = count < limit;

    return {
      allowed,
      message: allowed ? `${remaining} requests remaining` : 'Rate limit exceeded',
      remaining
    };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    const defaultLimit = 10;
    return {
      allowed: true,
      message: 'Error checking rate limit, allowing request',
      remaining: defaultLimit
    };
  }
}

/**
 * Increments the request counter in local storage for rate limiting.
 */
async function incrementRequestCount() {
   try {
    // Get the current state first to avoid race conditions if possible
    const state = await chrome.storage.local.get({
      requestCount: 0,
      lastResetTime: Date.now() // Should ideally already be set
    });

    // Increment the count, keeping the same lastResetTime
    await chrome.storage.local.set({
      requestCount: state.requestCount + 1,
      lastResetTime: state.lastResetTime // Ensure this doesn't get reset accidentally
    });
   } catch (error) {
       console.error("Error incrementing rate limit count:", error);
       // Decide how to handle error - maybe log and continue?
   }
}

// Export functions if needed for testing (similar note as validation.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkRateLimit, incrementRequestCount };
}