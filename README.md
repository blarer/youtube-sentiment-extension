# YouTube Comment Sentiment Analysis Chrome Extension

## Overview

The YouTube Comment Sentiment Analysis Chrome Extension is a powerful tool designed to help users quickly understand the collective sentiment and key discussion points within a YouTube video's comment section. By leveraging Google's Gemini AI for natural language processing and embeddings, the extension fetches comments, clusters them into distinct discussion topics, and provides an overall sentiment breakdown, along with sentiment and a concise summary for each major discussion point.

**WIP Notice:** This extension is currently a **Work in Progress (WIP)** and is under active development. Our goal is to evolve this into a fully-featured Chrome Extension with enhanced capabilities.

## Features

* **Comment Fetching:** Automatically retrieves top-level comments from any YouTube video using the YouTube Data API.
* **AI-Powered Sentiment Analysis:** Utilizes Google Gemini to determine the sentiment (Positive, Negative, Neutral) of individual discussion clusters.
* **Discussion Point Summarization:** Gemini AI generates concise summaries for each identified discussion point, capturing the main collective sentiment and ideas.
* **Advanced Comment Clustering:** Employs **HDBSCAN** (Hierarchical Density-Based Spatial Clustering of Applications with Noise) for more robust clustering, capable of discovering clusters of varying shapes and densities. It uses **UMAP** dimensionality reduction to preprocess comment embeddings to 10 components, improving clustering efficiency and quality, and automatically determines the optimal number of clusters without needing a predefined `k`. Noise points (comments not assigned to any cluster) are also explicitly handled.
* **Overall Sentiment Breakdown:** Provides a quick overview of the total positive, negative, and neutral comments analyzed.
* **Interactive UI Overlay:** Displays analysis results directly on the YouTube video page in a clear, interactive overlay, now with **improved Chart.js loading** for reliable rendering of the sentiment distribution pie chart.

## How it Works

1.  **Comment Retrieval:** When activated on a YouTube video page, the extension fetches top-level comments using the YouTube Data API.
2.  **Embedding Generation:** Each fetched comment is sent to a Flask backend, which uses Google Gemini's `embedding-001` model to generate a numerical vector (embedding) representing its semantic meaning.
3.  **Clustering & Dimensionality Reduction (Backend):** Comments and their embeddings are sent to the backend Python server (`my_llm_backend/app.py`). Here, **UMAP** is applied to reduce the dimensionality of the embeddings, followed by **HDBSCAN** to group similar comments into coherent discussion points. This process automatically identifies different discussion topics and handles noise, leveraging Python's data science libraries.
4.  **Sentiment and Summary Analysis:** For each identified cluster, a representative set of comments is sent to the Flask backend. The backend uses Google Gemini's `gemini-1.5-flash` model to analyze these comments, determine the overall sentiment (Positive, Negative, Neutral) of the cluster, and generate a concise summary.
5.  **Display Results:** The analyzed data, including overall sentiment counts and detailed discussion points with their sentiments and summaries, is displayed in an overlay on the YouTube page. The Chart.js library is now dynamically loaded into the page's head to ensure charts render correctly, destroying any previous instances to prevent conflicts.

## Setup and Installation

To get this extension running, you need to set up both the Flask backend and the Chrome extension.

### Prerequisites

* **Python 3.8+**
* **Node.js (for npm/yarn, though not strictly required for this project if you manually manage files)**
* **Google Cloud Project & API Keys:**
    * **Google Gemini API Key:** For text analysis and embeddings. Enable the Gemini API in your Google Cloud Project.
    * **YouTube Data API v3 Key:** For fetching YouTube comments. Enable the YouTube Data API v3 in your Google Cloud Project.

### Part 1: Backend Setup (Flask Application)

1.  **Clone the repository (or create the files):**
    If you haven't already, ensure you have a directory for your backend, e.g., `my_llm_backend`.

2.  **Create a Virtual Environment (Recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install Flask google-generativeai python-dotenv Flask-Cors requests umap-learn hdbscan scikit-learn
    ```
    *(Note: `umap-learn`, `hdbscan`, `scikit-learn` are new dependencies for the advanced clustering)*

4.  **Create a `.env` file:**
    In the `my_llm_backend` directory (where your `app.py` is located), create a file named `.env` and add your API keys:
    ```
    GOOGLE_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    YOUTUBE_API_KEY="YOUR_YOUTUBE_DATA_API_KEY_HERE"
    ```
    Replace `"YOUR_GEMINI_API_KEY_HERE"` and `"YOUR_YOUTUBE_DATA_API_KEY_HERE"` with your actual API keys.

5.  **Run the Flask Backend:**
    ```bash
    python app.py
    ```
    The backend server will start on `http://127.0.0.1:5000`. Keep this terminal window open and running while using the extension.

### Part 2: Chrome Extension Setup

1.  **Locate Extension Files:**
    Ensure you have the `youtube-sentiment-extension` directory containing:
    * `manifest.json`
    * `content.js`
    * `sentiment_overlay.html`
    * `sentiment_overlay.css`
    * `background.js` (if you have one)
    * `icons/` (if you have them)

2.  **Load the Extension in Chrome:**
    * Open Chrome and navigate to `chrome://extensions/`.
    * Enable **"Developer mode"** by toggling the switch in the top right corner.
    * Click on **"Load unpacked"** in the top left.
    * Select the `youtube-sentiment-extension` directory.

3.  **Pin the Extension (Optional but Recommended):**
    * Click the puzzle piece icon (Extensions) in your Chrome toolbar.
    * Click the pin icon next to "YouTube Comment Sentiment Analysis" to pin it to your toolbar for easy access.

## Usage

1.  **Start the Backend:** Ensure your Flask backend (`app.py`) is running in a terminal.
2.  **Navigate to a YouTube Video:** Go to any YouTube video page in your Chrome browser.
3.  **Activate the Extension:** The extension is designed to automatically inject its UI and start analysis when you land on a YouTube video page.
4.  **View Analysis:**
    * An overlay will appear on the right side of the video.
    * It will show status messages as it fetches comments, gets embeddings, performs clustering, and analyzes sentiment.
    * Once complete, it will display:
        * Overall Sentiment of Key Discussions (Positive, Negative, Neutral counts).
        * A list of "Key Discussion Points," each with its sentiment, a summary, and the number of comments in that point.
        * Clicking "View All Comments in this Point" will expand to show the actual comments contributing to that discussion.
5.  **Close Overlay:** Click the "X" button in the top right of the overlay to close it.

## Troubleshooting

* **"Failed to fetch comments. Check backend server and YouTube API key."**:
    * Ensure your Flask backend (`app.py`) is running and accessible at `http://127.0.0.1:5000`.
    * Verify that your `YOUTUBE_API_KEY` in the `.env` file is correct and has access to the YouTube Data API v3. Check your Google Cloud Project to ensure the API is enabled and quotas are not exceeded.
* **"Internal server error" or "Failed to parse Gemini JSON response"**:
    * Check the terminal where your `app.py` backend is running for detailed error messages.
    * Ensure your `GOOGLE_API_KEY` in the `.env` file is correct and has access to the Gemini API.
    * Sometimes, the LLM might return malformed JSON. The backend has error handling for this, but consistent errors might indicate a deeper issue with the API key or model access.
* **No sentiment colors, or incorrect counts**:
    * Ensure you have the latest versions of `content.js` and `sentiment_overlay.css` as provided in the most recent updates.
    * Perform a **hard refresh** (`Ctrl + Shift + R` or `Cmd + Shift + R`) on the YouTube page after reloading the extension.
    * Verify that the CSS classes `sentiment-positive`, `sentiment-negative`, `sentiment-neutral` are correctly defined in `sentiment_overlay.css` with the desired colors.
* **Extension not appearing on YouTube pages**:
    * Ensure "Developer mode" is enabled on `chrome://extensions/`.
    * Check your `manifest.json` for correct `matches` patterns (`"https://www.youtube.com/watch?v=*"`).
    * Verify that the `window.location.hostname.includes('youtube.com')` check in `content.js` is correct for your specific YouTube environment (it might vary slightly based on regional domains or browser versions). For most cases, `window.location.hostname.includes('youtube.com')` might be a more robust check.

## Future Enhancements

* **Full Extension Integration:** Transition from a basic content script overlay to a more robust, full Chrome Extension architecture with a dedicated popup and background scripting for improved performance and features.
* **Reply Analysis:** Extend comment fetching to include replies and analyze sentiment within threaded discussions.
* **User Customization:** Allow users to adjust the number of clusters or comments analyzed.
* **Performance Improvements:** Optimize API calls and processing for faster analysis.
* **Error Handling UI:** Provide more user-friendly error messages directly in the overlay.
* **Visualizations:** Add more advanced charts or graphs for a more engaging display of sentiment distribution.
* **Custom Prompts:** Allow users to input custom prompts for specialized analysis.

---
