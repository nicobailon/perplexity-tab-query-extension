// Load Readability library from node_modules
// This script will be injected before content-extractor.js

(async () => {
  try {
    // Import Readability from node_modules (this will be bundled)
    const readabilityScript = await fetch(chrome.runtime.getURL('node_modules/@mozilla/readability/Readability.js'));
    const readabilityCode = await readabilityScript.text();
    
    // Inject Readability into the page context
    const script = document.createElement('script');
    script.textContent = readabilityCode;
    document.documentElement.appendChild(script);
    script.remove();
    
    // Now inject our content extractor that uses Readability
    chrome.runtime.sendMessage({ action: 'readabilityLoaded' });
  } catch (error) {
    console.error('Failed to load Readability:', error);
  }
})();