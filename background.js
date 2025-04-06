// --- Constants ---
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MAX_RETRIES = 3; // Max retries for network errors or rate limits
const INITIAL_BACKOFF_MS = 1000; // Initial delay for exponential backoff

// --- Helper: Exponential Backoff Delay ---
function getBackoffDelay(retryCount) {
  // Exponential backoff: 1s, 2s, 4s, ...
  return Math.pow(2, retryCount) * INITIAL_BACKOFF_MS;
}

// --- Main API Call Function ---
async function callPerplexityApi(apiKey, requestBody) {
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      console.log(`Attempt ${retries + 1}: Sending request to Perplexity API.`);
      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      // --- Handle Response Status ---

      // Rate Limited (429)
      if (response.status === 429) {
        if (retries >= MAX_RETRIES) {
          throw new Error('Perplexity API rate limit exceeded after maximum retries.');
        }
        retries++;
        const retryAfterHeader = response.headers.get('Retry-After');
        let delayMs = getBackoffDelay(retries -1); // Calculate backoff based on previous attempt

        if (retryAfterHeader) {
            const retryAfterSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(retryAfterSeconds)) {
                // Use header value if valid, ensuring it's reasonable (e.g., max 60s)
                delayMs = Math.min(Math.max(retryAfterSeconds * 1000, delayMs), 60000);
            }
        }
        console.warn(`Rate limited. Retrying attempt ${retries + 1} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue; // Go to next iteration of the while loop
      }

      // Other Client/Server Errors (4xx, 5xx)
      if (!response.ok) {
        let errorBodyText = `HTTP error ${response.status}`;
        try {
          // Try to parse more detailed error from response body
          const errorJson = await response.json();
          errorBodyText = errorJson.error?.message || JSON.stringify(errorJson);
        } catch (e) {
          // If parsing fails, try getting raw text
          try {
              errorBodyText = await response.text();
          } catch (e2) { /* Ignore further errors */ }
        }
        // Do not retry on most client/server errors other than 429
        throw new Error(`API request failed: ${errorBodyText} (Status: ${response.status})`);
      }

      // --- Successful Response (2xx) ---
      const data = await response.json();
      console.log("Received successful response from Perplexity API.");
      // Validate expected structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
          throw new Error('Invalid response structure received from Perplexity API.');
      }
      return {
        result: data.choices[0].message.content.trim(),
        model: data.model,
        usage: data.usage
      };

    } catch (error) {
      console.error(`Error during API call (Attempt ${retries + 1}):`, error);

      // Check if it's a network error or potentially retryable error
      // TypeError often indicates network issues (fetch failed)
      const isNetworkError = error instanceof TypeError;

      if (isNetworkError && retries < MAX_RETRIES) {
        retries++;
        const delayMs = getBackoffDelay(retries - 1);
        console.warn(`Network error detected. Retrying attempt ${retries + 1} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        // Continue to next iteration
      } else {
        // Non-retryable error or max retries reached
        throw error; // Re-throw the caught error
      }
    }
  }
  // Should not be reached if MAX_RETRIES >= 0, but acts as a safeguard
  throw new Error('Exceeded maximum attempts to call Perplexity API.');
}


// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'processQuery') {
    console.log("Background script received 'processQuery' message.");
    const { query, tabUrls } = message;

    // Use an async IIFE to handle the promise chain and sendResponse
    (async () => {
      try {
        // 1. Get API Key
        const settings = await chrome.storage.sync.get({ apiKey: '' });
        if (!settings.apiKey) {
          throw new Error('API key not set. Please configure in options.');
        }

        // 2. Format Context from Tabs
        const urlsFormatted = tabUrls.map((tab, index) =>
          `Source ${index + 1}:\nTitle: ${tab.title || 'N/A'}\nURL: ${tab.url}`
        ).join('\n\n');

        // 3. Construct System Message (Prompt Engineering)
        const systemMessage = `You are an AI assistant. Answer the user's query based *only* on the context provided below from their browser tabs.
If the answer cannot be found in the provided context, state that clearly. Do not use external knowledge. Cite the source number(s) (e.g., [Source 1], [Source 1, 2]) where the information was found.

Context from Tabs:
--- START CONTEXT ---
${urlsFormatted || "No tab context provided."}
--- END CONTEXT ---

User Query: ${query}`; // Include user query here for clarity, though it goes in user message too

        // 4. Prepare API Request Body
        const requestBody = {
          // Model selection - check Perplexity docs for current best options
          // "sonar-medium-online" or "sonar-large-online" might be suitable if internet access is desired *within* Perplexity's processing (but our prompt restricts it)
          // "sonar-medium-chat" or "sonar-large-chat" if no external access needed by the model itself. Let's use chat.
          model: "sonar",
          messages: [
            // System message sets the context and rules
            { role: "system", content: systemMessage },
            // User message contains the actual query
            { role: "user", content: query }
          ],
          // Optional parameters (adjust as needed)
          max_tokens: 1024, // Max length of the response
          temperature: 0.5, // Lower temperature for more factual, less creative answers based on context
          // top_p: 0.9, // Alternative to temperature
        };

        // 5. Call the API
        const apiResult = await callPerplexityApi(settings.apiKey, requestBody);

        // 6. Send Success Response
        console.log("Sending successful result back to popup.");
        sendResponse({
            result: apiResult.result,
            model: apiResult.model,
            usage: apiResult.usage
        });

      } catch (error) {
        // 7. Send Error Response
        console.error("Error processing query in background:", error);
        sendResponse({ error: error.message || 'An unknown error occurred.' });
      }
    })(); // End async IIFE

    // Return true to indicate that sendResponse will be called asynchronously
    return true;
  }
  // Handle other potential message types if needed in the future
  // else { console.log("Background received unhandled message:", message); }

  // Return false or undefined for synchronous messages or unhandled ones
  return false;
});

// --- Optional: Lifecycle Events ---
chrome.runtime.onInstalled.addListener(() => {
  console.log('Perplexity Tab Query extension installed/updated.');
  // Could set default settings here if needed, but options page handles defaults on load.
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Browser startup detected.');
    // Could perform actions on browser start if necessary
});