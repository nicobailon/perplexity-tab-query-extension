# Perplexity Tab Query

Query Perplexity AI with context from your open browser tabs.

## Description

Perplexity Tab Query is a browser extension that allows you to quickly send queries to Perplexity AI, leveraging the content of your currently open tabs to provide richer, more contextual responses. Now with multiple AI summarization options for enhanced privacy and performance.

## Features

- **Inline Interface:** Easily access Perplexity AI directly within the extension UI.
- **Contextual Queries:** Sends information from your open tabs to enhance query relevance.
- **Multiple Summarization Options:**
  - **Chrome AI (Default):** On-device AI using Gemini Nano for privacy-focused summarization
  - **Gemini Flash 2.0:** Google's latest fast AI model for high-quality summaries
  - **Perplexity AI:** Search-optimized AI summaries
- **Advanced Content Extraction:** Uses Mozilla's Readability library for reliable content parsing
- **Save Tab Sessions:** Save all open tabs with summaries for later reference.
- **Session Management:** View, open, or export saved tab sessions anytime.
- **Tab Cleanup:** Option to automatically close tabs after saving them.
- **Options Page:** Customize extension settings, API keys, and summarization preferences.
- **Background Service Worker:** Handles API communication efficiently.
- **Secure:** Only requests necessary permissions and uses secure API communication.

## Setup & Installation

1. **Clone or Download the Repository**

   ```bash
   git clone https://github.com/yourusername/perplexity-tab-query.git
   ```

   Or download the ZIP and extract it.

2. **Open Your Browser's Extensions Page**

   - **Chrome:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
   - **Firefox:** `about:debugging#/runtime/this-firefox` (for temporary add-ons)

3. **Enable Developer Mode**

   - Toggle **Developer mode** (Chrome/Edge) or select **Load Temporary Add-on** (Firefox).

4. **Load Unpacked Extension**

   - Click **Load unpacked** (Chrome/Edge) and select the project directory.
   - In Firefox, click **Load Temporary Add-on** and select the `manifest.json` file.

**Note:** The installation process is the same across macOS, Windows, and Linux.

## Usage

- Click the **Perplexity Tab Query** icon in your browser toolbar.
- Enter your query in the extension interface.
- The extension will send your query along with relevant tab context to Perplexity AI and display the response.
- Choose your preferred summarization method:
  - **Chrome AI**: Uses on-device AI for privacy (requires Chrome AI APIs)
  - **Gemini Flash 2.0**: Fast and high-quality summaries (requires Gemini API key)
  - **Perplexity**: Search-optimized summaries (uses your Perplexity API key)
- Tab summaries will be automatically generated for better context (can be disabled in settings).
- View the list of tabs used by clicking "Show Used Tabs" to see URLs and summaries.
- Use "Save All Tabs" to save your current browser session with summaries.
- Use "View Saved Sessions" to access previously saved tab sessions.
- Enable "Close tabs after saving" to automatically clean up your browser after saving.
- To customize settings, configure your API keys, rate limits, and summary preferences in the settings section.

## Configuration

1. **Perplexity API Key**: Required for the main query functionality
2. **Gemini API Key**: Required only if you choose Gemini Flash 2.0 for summaries (get from [Google AI Studio](https://aistudio.google.com/app/apikey))
3. **Summarization Method**: Choose between Chrome AI (on-device), Gemini, or Perplexity
4. **Rate Limit**: Configure requests per hour (default: 10)
5. **Max Tabs**: Set the maximum number of tabs to include (default: 10)

## License

[MIT](LICENSE)

## Acknowledgments

- [Perplexity AI](https://www.perplexity.ai) for their powerful API.
