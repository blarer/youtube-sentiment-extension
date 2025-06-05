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
    } else if (request.action === "setDarkMode") {
        setOverlayDarkMode(request.darkMode);
    }
});

// On popup load, set the toggle state and popup dark mode
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['darkMode'], (result) => {
    const isDark = result.darkMode === true;
    document.getElementById('darkModeToggle').checked = isDark;
    setPopupDarkMode(isDark);
  });

  document.getElementById('darkModeToggle').addEventListener('change', (e) => {
    const isDark = e.target.checked;
    chrome.storage.local.set({ darkMode: isDark });
    setPopupDarkMode(isDark);

    // Send message to active tab to update overlay dark mode
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "setDarkMode", darkMode: isDark });
      }
    });
  });
});

function setPopupDarkMode(isDark) {
  if (isDark) {
    document.body.style.background = "#222";
    document.body.style.color = "#eee";
  } else {
    document.body.style.background = "";
    document.body.style.color = "";
  }
}

function setOverlayDarkMode(isDark) {
  const overlay = document.getElementById('sentiment-analysis-overlay');
  if (overlay) {
    if (isDark) {
      overlay.classList.add('dark-mode');
    } else {
      overlay.classList.remove('dark-mode');
    }
  }
}