// youtube-sentiment-extension/background.js
chrome.action.onClicked.addListener((tab) => {
    // Check if the current tab is a YouTube video page
    if (tab.url.includes("youtube.com/watch")) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        // The function to execute in the content script's isolated world
        // This sends a message to the content script.
        function: () => {
          chrome.runtime.sendMessage({ action: "startAnalysis" });
        }
      });
    } else {
      console.log("YouTube Sentiment Extension: Not a YouTube video page. Analysis not triggered.");
      // Optionally, you could send a message to popup.js to display this status
      // or use chrome.notifications API to show a message to the user.
    }
  });
  
  // Listener for messages coming from content.js (e.g., when analysis is complete)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "analysisComplete") {
          console.log("Background script received analysis complete message:", request.results);
          // Here you could add logic to:
          // - Cache results in chrome.storage.local
          // - Update the popup UI
          // - Show a browser notification
      }
      if (request.action === "getDarkMode") {
        chrome.storage.local.get(['darkMode'], (result) => {
          sendResponse({ darkMode: result.darkMode });
        });
        return true; // Required to indicate async response
      }
      // No 'return true' needed here as this listener is not sending an async response.
  });