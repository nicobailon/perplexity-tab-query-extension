// Offscreen document for using Chrome's Summarization API
// This runs in a full DOM context where window.ai is available

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    const { content, title } = request;
    
    try {
      // Check if the Summarization API is available
      if (!window.ai || !window.ai.summarizer) {
        console.warn('Chrome Summarization API not available');
        sendResponse({ 
          success: false, 
          summary: 'Summary not available (API not supported)' 
        });
        return;
      }
      
      // Check capabilities
      const canSummarize = await window.ai.summarizer.capabilities();
      if (canSummarize.available === 'no') {
        sendResponse({ 
          success: false, 
          summary: 'Summary not available (not supported on this device)' 
        });
        return;
      }
      
      // Wait for the model to be ready if needed
      if (canSummarize.available === 'after-download') {
        console.log('Downloading summarization model...');
        // The model will be downloaded automatically
        await canSummarize.ready;
      }
      
      // Create the summarizer
      const summarizer = await window.ai.summarizer.create();
      
      // Combine title and content for better context
      const textToSummarize = `${title}\n\n${content}`;
      
      // Generate the summary
      const summary = await summarizer.summarize(textToSummarize, {
        context: 'This is a web page that needs to be summarized concisely.',
        type: 'key-points',
        format: 'plain-text',
        length: 'short'
      });
      
      sendResponse({ success: true, summary });
      
    } catch (error) {
      console.error('Failed to generate summary with Chrome AI:', error);
      sendResponse({ 
        success: false, 
        summary: 'Failed to generate summary',
        error: error.message 
      });
    }
  }
  
  return true; // Keep message channel open for async response
});