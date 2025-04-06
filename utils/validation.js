/**
 * Validates the Perplexity API key format
 * @param {string} apiKey - The API key to validate
 * @returns {Object} Validation result with valid flag and message
 */
function validateApiKey(apiKey) {
  // Check for null, undefined, or empty string
  if (!apiKey || apiKey.trim() === '') {
    return {
      valid: false,
      message: 'API key is required'
    };
  }

  // Trim whitespace
  apiKey = apiKey.trim();

  // Perplexity API keys are typically 32+ characters
  // Adjust this validation based on actual Perplexity API key format
  if (apiKey.length < 32) {
    return {
      valid: false,
      message: 'API key seems too short (should be at least 32 characters)'
    };
  }

  // More specific validation if Perplexity API has a specific format
  // For example, if it starts with "pplx-" (hypothetical)
  // NOTE: This is a hypothetical check. Adjust if the actual format is known.
  if (!apiKey.startsWith('pplx-')) {
    return {
      valid: false,
      message: 'API key should start with "pplx-"'
    };
  }

  return {
    valid: true,
    message: ''
  };
}

/**
 * Validates a user query
 * @param {string} query - The user query to validate
 * @returns {Object} Validation result with valid flag and message
 */
function validateQuery(query) {
  if (!query || !query.trim()) {
    return {
      valid: false,
      message: 'Query cannot be empty'
    };
  }

  if (query.length > 1000) {
    return {
      valid: false,
      message: 'Query is too long (maximum 1000 characters)'
    };
  }

  return {
    valid: true,
    message: ''
  };
}

// Export functions for testing and module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateApiKey, validateQuery };
} else if (typeof window !== 'undefined') {
  // Make functions available globally for browser environment
  window.validateApiKey = validateApiKey;
  window.validateQuery = validateQuery;
}

// Export functions if needed for testing (CommonJS style for Jest compatibility if not using ES modules in tests)
// If using ES Modules for tests, ensure Jest is configured for it.
// For simplicity with basic Jest setup, we might need to adjust tests or use require.
// Let's assume for now these are global functions or imported directly in scripts where needed.
// If tests require explicit exports, add:
/*
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateApiKey, validateQuery };
}
*/
// For now, leave it without explicit exports for browser environment. Tests will need to handle this.