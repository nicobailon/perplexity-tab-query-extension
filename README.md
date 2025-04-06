# Perplexity Tab Query

Query Perplexity AI with context from your open browser tabs.

## Description

Perplexity Tab Query is a browser extension that allows you to quickly send queries to Perplexity AI, leveraging the content of your currently open tabs to provide richer, more contextual responses.

## Features

- **Inline Interface:** Easily access Perplexity AI directly within the extension UI.
- **Contextual Queries:** Sends information from your open tabs to enhance query relevance.
- **Options Page:** Customize extension settings to suit your preferences.
- **Background Service Worker:** Handles API communication efficiently.
- **Secure:** Only requests necessary permissions (`tabs`, `storage`) and communicates with `https://api.perplexity.ai/*`.

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
- To customize settings, open the **Options** page via the extension menu.

## License

[MIT](LICENSE)

## Acknowledgments

- [Perplexity AI](https://www.perplexity.ai) for their powerful API.
