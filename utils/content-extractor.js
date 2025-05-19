// Content script to extract meaningful content from web pages using Mozilla's Readability

// Import Readability library inline since content scripts can't use module imports directly
// We'll inject this via background script

/**
 * Extracts the main content from the page using Readability
 * @returns {Object} Object containing title, description, and main content
 */
function extractPageContent() {
  try {
    // Clone the document to avoid modifying the original page
    const documentClone = document.cloneNode(true);
    
    // Initialize Readability with the cloned document
    const reader = new Readability(documentClone);
    const article = reader.parse();
    
    if (article) {
      return {
        title: article.title || document.title || '',
        description: article.excerpt || '',
        content: article.textContent || '',
        url: window.location.href,
        timestamp: Date.now(),
        readabilityScore: article.length || 0
      };
    } else {
      // Fallback to basic extraction if Readability fails
      return fallbackExtraction();
    }
  } catch (error) {
    console.error('Readability extraction failed:', error);
    return fallbackExtraction();
  }
}

/**
 * Fallback extraction method when Readability fails
 * @returns {Object} Basic content extraction
 */
function fallbackExtraction() {
  const title = document.title || '';
  
  // Try to get meta description
  const metaDescription = document.querySelector('meta[name="description"]')?.content || 
                         document.querySelector('meta[property="og:description"]')?.content || '';
  
  // Get main content - prioritize semantic HTML5 elements
  let mainContent = '';
  
  // Try different selectors for main content
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#main',
    '.main',
    '#content',
    '.content',
    'body'
  ];
  
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      mainContent = extractTextContent(element);
      if (mainContent.length > 200) { // If we found substantial content, use it
        break;
      }
    }
  }
  
  // If no good content found, fall back to body
  if (!mainContent || mainContent.length < 200) {
    mainContent = extractTextContent(document.body);
  }
  
  return {
    title,
    description: metaDescription,
    content: mainContent.slice(0, 5000), // Limit content length
    url: window.location.href,
    timestamp: Date.now(),
    readabilityScore: 0 // Indicate this was a fallback
  };
}

/**
 * Extracts text content from an element, removing scripts and styles
 * @param {Element} element - The element to extract text from
 * @returns {string} The extracted text content
 */
function extractTextContent(element) {
  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true);
  
  // Remove script and style elements
  const scripts = clone.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());
  
  // Also remove elements that typically don't contain main content
  const unwantedSelectors = [
    'nav',
    'header',
    'footer',
    '.sidebar',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '.advertisement',
    '.ad',
    '#cookie-notice'
  ];
  
  unwantedSelectors.forEach(selector => {
    const elements = clone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
  
  // Get text content and clean it up
  let text = clone.textContent || '';
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
    .trim();
  
  return text;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    try {
      const pageContent = extractPageContent();
      sendResponse({ success: true, data: pageContent });
    } catch (error) {
      console.error('Error extracting content:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Will respond asynchronously
});