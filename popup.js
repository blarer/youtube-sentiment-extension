// youtube-sentiment-extension/popup.js
document.getElementById('analyzeButton').addEventListener('click', () => {
    document.getElementById('status').textContent = "Checking tab...";
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        // Ensure we are on a YouTube video page before sending message
        if (activeTab.url && activeTab.url.includes("youtube.com/watch")) {
            document.getElementById('status').textContent = "Starting analysis...";
            chrome.tabs.sendMessage(activeTab.id, { action: "startAnalysis" }, (response) => {
                if (response && response.status) {
                    document.getElementById('status').textContent = response.status;
                } else {
                    document.getElementById('status').textContent = "Failed to start analysis (no response from content script).";
                }
            });
        } else {
            document.getElementById('status').textContent = "Please navigate to a YouTube video page to analyze comments.";
        }
    });
});

// Listen for messages from content.js (e.g., when analysis is complete or for updates)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const statusDiv = document.getElementById('status');
    if (request.action === "analysisComplete") {
        if (request.success) {
            statusDiv.textContent = "Analysis complete! See overlay on YouTube page.";
            // You could further process request.results to display summary in the popup here if desired.
        } else {
            statusDiv.textContent = "Analysis failed: " + (request.error || "Unknown error.");
        }
    } else if (request.action === "analysisUpdate") {
        statusDiv.textContent = request.message;
    }
});