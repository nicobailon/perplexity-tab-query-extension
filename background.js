// --- Constants ---
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MAX_RETRIES = 3; // Max retries for network errors or rate limits
const INITIAL_BACKOFF_MS = 1000; // Initial delay for exponential backoff

// Import Gemini SDK
import { GoogleGenerativeAI } from '@google/generative-ai';

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


// --- Helper Functions for Content Extraction ---

/**
 * Extracts content from a specific tab
 * @param {Object} tab - The tab object
 * @returns {Promise<Object>} The extracted content
 */
async function extractTabContent(tab) {
  try {
    // First try to inject Readability library
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectReadability,
      world: 'MAIN'
    });
    
    // Then inject our content extractor
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['utils/content-extractor.js']
    });
    
    // Now get the content
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
    if (response.success) {
      return response.data;
    }
  } catch (error) {
    console.error(`Failed to extract content from tab ${tab.id}:`, error);
  }
  
  // Fallback: return basic info without content
  return {
    title: tab.title || 'Untitled',
    url: tab.url,
    description: '',
    content: '',
    extractionFailed: true
  };
}

/**
 * Function to inject Readability into the page
 * This runs in the page context (MAIN world)
 */
function injectReadability() {
  if (window.Readability) {
    return; // Already loaded
  }
  
  // Load Readability library from Mozilla CDN
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@mozilla/readability@0.5.0/Readability.js';
  document.head.appendChild(script);
}

/**
 * Generates a summary using Chrome's built-in Summarization API
 * @param {string} content - The content to summarize
 * @param {string} title - The page title
 * @returns {Promise<string>} The summary
 */
async function generateSummary(content, title) {
  if (!content || content.length < 100) {
    return 'Content too short to summarize';
  }
  
  try {
    // Create or get the offscreen document for summarization
    // Chrome AI APIs are only available in full DOM contexts, not service workers
    await chrome.offscreen.createDocument({
      url: 'offscreen/summarizer.html',
      reasons: ['DOM_PARSER'], // Using DOM_PARSER as the closest available reason
      justification: 'Using Chrome AI Summarization API which requires DOM access'
    }).catch(() => {
      // Document might already exist, that's okay
    });
    
    // Send message to offscreen document
    const response = await chrome.runtime.sendMessage({
      action: 'summarize',
      content: content,
      title: title
    });
    
    if (response.success) {
      return response.summary;
    } else {
      console.warn('Chrome AI summarization failed:', response.error);
      return response.summary || 'Failed to generate summary';
    }
    
  } catch (error) {
    console.error('Failed to generate summary with Chrome AI:', error);
    return 'Failed to generate summary';
  }
}

/**
 * Generates a summary using Perplexity API (fallback for when Chrome AI is not available)
 * @param {string} content - The content to summarize
 * @param {string} title - The page title
 * @param {string} apiKey - The API key
 * @returns {Promise<string>} The summary
 */
async function generatePerplexitySummary(content, title, apiKey) {
  if (!content || content.length < 100) {
    return 'Content too short to summarize';
  }
  
  const summaryRequest = {
    model: "sonar",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that creates concise summaries of web page content. Provide a brief 2-3 sentence summary that captures the main points."
      },
      {
        role: "user",
        content: `Summarize this web page:\n\nTitle: ${title}\n\nContent: ${content.slice(0, 2000)}` // Limit content for summary
      }
    ],
    max_tokens: 150,
    temperature: 0.3
  };
  
  try {
    const result = await callPerplexityApi(apiKey, summaryRequest);
    return result.result;
  } catch (error) {
    console.error('Failed to generate summary:', error);
    return 'Failed to generate summary';
  }
}

/**
 * Generates a summary using Gemini Flash 2.0 API
 * @param {string} content - The content to summarize
 * @param {string} title - The page title
 * @param {string} apiKey - The Gemini API key
 * @returns {Promise<string>} The summary
 */
async function generateGeminiSummary(content, title, apiKey) {
  if (!content || content.length < 100) {
    return 'Content too short to summarize';
  }
  
  try {
    // Initialize the Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 150,
      }
    });
    
    const prompt = `Please provide a concise 2-3 sentence summary of this web page content that captures the main points:

Title: ${title}

Content: ${content.slice(0, 4000)}`; // Gemini can handle longer content
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    
    return summary.trim();
  } catch (error) {
    console.error('Failed to generate Gemini summary:', error);
    return 'Failed to generate summary';
  }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'processQuery') {
    console.log("Background script received 'processQuery' message.");
    const { query, tabUrls } = message;

    // Use an async IIFE to handle the promise chain and sendResponse
    (async () => {
      try {
        // 1. Get settings
        const settings = await chrome.storage.sync.get({ 
          apiKey: '',
          geminiApiKey: '', 
          summaryMethod: 'chrome',
          enableSummaries: true 
        });
        
        if (!settings.apiKey) {
          throw new Error('Perplexity API key not set. Please configure in options.');
        }

        // 2. Extract content and generate summaries for tabs
        const tabsWithContent = [];
        for (const tab of tabUrls) {
          const content = await extractTabContent(tab);
          let summary = tab.summary; // Use existing summary if available
          
          // Generate summary if not already present and content is available
          if (!summary && content.content && !content.extractionFailed && tab.enableSummaries && settings.enableSummaries) {
            // Use the selected summarization method
            switch (settings.summaryMethod) {
              case 'chrome':
                summary = await generateSummary(content.content, content.title);
                if (summary.includes('not available') || summary.includes('Failed')) {
                  // Fall back to Perplexity if Chrome AI fails
                  summary = await generatePerplexitySummary(content.content, content.title, settings.apiKey);
                }
                break;
              
              case 'gemini':
                if (settings.geminiApiKey) {
                  summary = await generateGeminiSummary(content.content, content.title, settings.geminiApiKey);
                } else {
                  summary = 'Gemini API key not configured';
                }
                break;
              
              case 'perplexity':
                summary = await generatePerplexitySummary(content.content, content.title, settings.apiKey);
                break;
              
              default:
                summary = await generateSummary(content.content, content.title);
            }
          }
          
          tabsWithContent.push({
            ...tab,
            content: content.content,
            summary: summary || 'No summary available',
            extractionFailed: content.extractionFailed
          });
        }
        
        // 3. Format Context from Tabs with summaries
        const urlsFormatted = tabsWithContent.map((tab, index) =>
          `Source ${index + 1}:\nTitle: ${tab.title || 'N/A'}\nURL: ${tab.url}\nSummary: ${tab.summary}`
        ).join('\n\n');

        // 4. Construct System Message (Prompt Engineering)
        const systemMessage = `You are an AI assistant. Answer the user's query based *only* on the context provided below from their browser tabs.
If the answer cannot be found in the provided context, state that clearly. Do not use external knowledge. Cite the source number(s) (e.g., [Source 1], [Source 1, 2]) where the information was found.

Context from Tabs (with summaries):
--- START CONTEXT ---
${urlsFormatted || "No tab context provided."}
--- END CONTEXT ---

User Query: ${query}`; // Include user query here for clarity, though it goes in user message too

        // 5. Prepare API Request Body
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

        // 6. Call the API
        const apiResult = await callPerplexityApi(settings.apiKey, requestBody);

        // 7. Send Success Response
        console.log("Sending successful result back to popup.");
        sendResponse({
            result: apiResult.result,
            model: apiResult.model,
            usage: apiResult.usage,
            processedTabs: tabsWithContent // Include the tabs with summaries
        });

      } catch (error) {
        // 8. Send Error Response
        console.error("Error processing query in background:", error);
        sendResponse({ error: error.message || 'An unknown error occurred.' });
      }
    })(); // End async IIFE

    // Return true to indicate that sendResponse will be called asynchronously
    return true;
  } else if (message.action === 'extractAndSummarize') {
    console.log("Background script received 'extractAndSummarize' message.");
    const { tab } = message;
    
    (async () => {
      try {
        // Get settings
        const settings = await chrome.storage.sync.get({ 
          apiKey: '', 
          geminiApiKey: '',
          enableSummaries: true,
          summaryMethod: 'chrome'
        });
        
        if (!settings.enableSummaries) {
          sendResponse({ summary: null });
          return;
        }
        
        // Extract content
        const content = await extractTabContent(tab);
        
        // Generate summary
        let summary = null;
        if (content.content && !content.extractionFailed) {
          // Use the selected summarization method
          switch (settings.summaryMethod) {
            case 'chrome':
              summary = await generateSummary(content.content, content.title);
              if (summary.includes('not available') || summary.includes('Failed')) {
                // Fall back to Perplexity if Chrome AI fails
                summary = await generatePerplexitySummary(content.content, content.title, settings.apiKey);
              }
              break;
            
            case 'gemini':
              if (settings.geminiApiKey) {
                summary = await generateGeminiSummary(content.content, content.title, settings.geminiApiKey);
              } else {
                summary = 'Gemini API key not configured';
              }
              break;
            
            case 'perplexity':
              if (settings.apiKey) {
                summary = await generatePerplexitySummary(content.content, content.title, settings.apiKey);
              } else {
                summary = 'Perplexity API key not configured';
              }
              break;
            
            default:
              summary = await generateSummary(content.content, content.title);
          }
        }
        
        sendResponse({ summary: summary });
      } catch (error) {
        console.error("Error in extractAndSummarize:", error);
        sendResponse({ error: error.message });
      }
    })();
    
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