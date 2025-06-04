// youtube-sentiment-extension/content.js

// Backend server URL
const BACKEND_URL = "http://127.0.0.1:5000";

// --- UI Injection and Update Functions ---

// Function to get the YouTube video ID from the current URL
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    console.log("getVideoId called. Found video ID:", videoId); // ADDED LOG
    return videoId;
}

// Function to inject the HTML overlay
async function injectOverlay() {
    console.log("injectOverlay called."); // ADDED LOG
    // Check if the overlay already exists to prevent duplicates
    if (document.getElementById('sentiment-analysis-overlay')) {
        console.log("Overlay already exists. Skipping injection."); // ADDED LOG
        return;
    }

    const overlayHtmlUrl = chrome.runtime.getURL('sentiment_overlay.html');
    const overlayCssUrl = chrome.runtime.getURL('sentiment_overlay.css');

    try {
        const responseHtml = await fetch(overlayHtmlUrl);
        const overlayHtml = await responseHtml.text();
        const overlayContainer = document.createElement('div');
        overlayContainer.innerHTML = overlayHtml;
        document.body.appendChild(overlayContainer);

        const styleElement = document.createElement('link');
        styleElement.rel = 'stylesheet';
        styleElement.type = 'text/css';
        styleElement.href = overlayCssUrl;
        document.head.appendChild(styleElement);

        document.getElementById('overlay-close-button').addEventListener('click', function() {
            const overlay = document.getElementById('sentiment-analysis-overlay');
            if (overlay) {
                overlay.remove();
            }
        });
        console.log("Overlay injected successfully.");
    } catch (error) {
        console.error("Failed to inject overlay:", error);
    }
}

// ... (keep updateOverlayStatus, displayOverallSentiment, displayClusterResults as is) ...
function updateOverlayStatus(message) {
    const statusDiv = document.getElementById('overlay-status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block'; // Ensure status is visible
    }
    const resultsDiv = document.getElementById('overlay-results');
    if (resultsDiv) {
        resultsDiv.style.display = 'none'; // Hide results when status is updated
    }
    const clustersDiv = document.getElementById('overlay-clusters-results'); // Hide clusters for now
    if (clustersDiv) {
        clustersDiv.innerHTML = ''; // Clear previous cluster results
        clustersDiv.style.display = 'none';
    }
}
function displayOverallSentiment(sentimentCounts) {
    const statusDiv = document.getElementById('overlay-status');
    const resultsDiv = document.getElementById('overlay-results');
    const positiveSpan = document.getElementById('overlay-positive');
    const negativeSpan = document.getElementById('overlay-negative');
    const neutralSpan = document.getElementById('overlay-neutral');
    const totalAnalyzedSpan = document.getElementById('overlay-total-analyzed');

    if (statusDiv) statusDiv.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';

    if (positiveSpan) positiveSpan.textContent = sentimentCounts.good || 0;
    if (negativeSpan) negativeSpan.textContent = sentimentCounts.bad || 0;
    if (neutralSpan) neutralSpan.textContent = sentimentCounts.neutral || 0;
    if (totalAnalyzedSpan) totalAnalyzedSpan.textContent = sentimentCounts.total || 0;
}
function displayClusterResults(analysisResults) {
    const clustersResultsDiv = document.getElementById('overlay-clusters-results');
    if (!clustersResultsDiv) {
        console.error("Overlay element #overlay-clusters-results not found.");
        return;
    }
    clustersResultsDiv.innerHTML = '<h3>Key Discussion Points:</h3>';
    clustersResultsDiv.style.display = 'block';

    if (analysisResults.length === 0) {
        clustersResultsDiv.innerHTML += '<p>No distinct discussion points found or analyzed.</p>';
        return;
    }

    const ul = document.createElement('ul');
    analysisResults.forEach((result, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>Point ${index + 1}</strong> (Sentiment: <span class="sentiment-${result.sentiment.toLowerCase()}">${result.sentiment}</span>, Comments: ${result.clusterSize}):<br>
            <p class="summary-text">${result.summary}</p>
            <details>
                <summary>Representative Text</summary>
                <p class="representative-text">${result.representativeText}</p>
            </details>
        `;
        ul.appendChild(li);
    });
    clustersResultsDiv.appendChild(ul);
}


// --- Core LLM/Clustering Functions ---

// Utility function to calculate Euclidean distance between two vectors
function euclideanDistance(vec1, vec2) {
    if (vec1.length !== vec2.length) {
        throw new Error("Vectors must be of the same length");
    }
    let sumSquares = 0;
    for (let i = 0; i < vec1.length; i++) {
        sumSquares += (vec1[i] - vec2[i]) ** 2;
    }
    return Math.sqrt(sumSquares);
}

// Function to get embeddings from the backend
async function getEmbedding(text) {
    console.log("Calling getEmbedding for text:", text.substring(0, 30) + "..."); // ADDED LOG
    try {
        const response = await fetch(`${BACKEND_URL}/get_embedding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`); // Enhanced error
        }
        const data = await response.json();
        console.log("Received embedding."); // ADDED LOG
        return data.embedding;
    } catch (error) {
        console.error("Error getting embedding:", error);
        return null;
    }
}

// Function to perform basic clustering (K-Means simplified for demonstration)
async function performClustering(commentsWithEmbeddings, k = 5, maxIterations = 50) {
    console.log("performClustering called with", commentsWithEmbeddings.length, "comments."); // ADDED LOG
    if (commentsWithEmbeddings.length === 0) return [];
    if (commentsWithEmbeddings.length < k) {
        return commentsWithEmbeddings.map(c => [c]);
    }
    // ... (rest of clustering logic remains the same) ...
    let centroids = [];
    const shuffled = [...commentsWithEmbedEmbeddings].sort(() => 0.5 - Math.random());
    for (let i = 0; i < k; i++) {
        centroids.push(shuffled[i].embedding);
    }
    let clusters = [];
    for (let iter = 0; iter < maxIterations; iter++) {
        clusters = Array.from({ length: k }, () => []);
        for (const comment of commentsWithEmbeddings) {
            let minDistance = Infinity;
            let closestCentroidIndex = -1;
            for (let i = 0; i < k; i++) {
                const dist = euclideanDistance(comment.embedding, centroids[i]);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestCentroidIndex = i;
                }
            }
            if (closestCentroidIndex !== -1) {
                clusters[closestCentroidIndex].push(comment);
            }
        }
        let newCentroids = [];
        let changed = false;
        for (let i = 0; i < k; i++) {
            if (clusters[i].length > 0) {
                const sumVector = Array(centroids[i].length).fill(0);
                for (const comment of clusters[i]) {
                    for (let j = 0; j < comment.embedding.length; j++) {
                        sumVector[j] += comment.embedding[j];
                    }
                }
                const newCentroid = sumVector.map(val => val / clusters[i].length);
                
                if (euclideanDistance(newCentroid, centroids[i]) > 1e-6) {
                    changed = true;
                }
                newCentroids.push(newCentroid);
            } else {
                newCentroids.push(commentsWithEmbeddings[Math.floor(Math.random() * commentsWithEmbeddings.length)].embedding);
                changed = true;
            }
        }
        centroids = newCentroids;
        if (!changed) break;
    }
    return clusters.filter(c => c.length > 0);
}


// Function to analyze text (sentiment and summary) from the backend
async function analyzeText(text) {
    console.log("Calling analyzeText for text:", text.substring(0, 30) + "..."); // ADDED LOG
    try {
        const response = await fetch(`${BACKEND_URL}/analyze_text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`); // Enhanced error
        }
        const data = await response.json();
        console.log("Received sentiment/summary."); // ADDED LOG
        return data;
    } catch (error) {
        console.error("Error analyzing text:", error);
        return null;
    }
}

// NEW Function: Fetch YouTube Comments from backend
async function fetchYouTubeComments(videoId) {
    console.log("fetchYouTubeComments called for video ID:", videoId); // ADDED LOG
    updateOverlayStatus("Fetching comments via YouTube Data API...");
    try {
        const response = await fetch(`${BACKEND_URL}/get_youtube_comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videoId: videoId })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`); // Enhanced error
        }
        const data = await response.json();
        console.log(`Received ${data.comments ? data.comments.length : 0} comments from backend.`); // ADDED LOG
        return data.comments || [];
    } catch (error) {
        console.error("Error fetching YouTube comments from backend:", error);
        updateOverlayStatus("Failed to fetch comments. Check backend server and YouTube API key.");
        return [];
    }
}


// Main function to orchestrate the process
async function processYouTubeComments() {
    console.log("processYouTubeComments called. Starting analysis workflow."); // ADDED LOG
    updateOverlayStatus("YouTube Sentiment Extension: Initializing...");

    const videoId = getVideoId(); // Get video ID at the start
    if (!videoId) {
        updateOverlayStatus("Not a YouTube video page or could not find video ID.");
        console.log("processYouTubeComments: No video ID found."); // ADDED LOG
        return; // Stop if no video ID
    }

    // Now, fetch comments from the backend
    const comments = await fetchYouTubeComments(videoId);

    if (comments.length === 0) {
        updateOverlayStatus("No comments found via YouTube Data API. Try reloading or check API quotas.");
        console.log("No comments fetched from backend."); // ADDED LOG
        return;
    }

    updateOverlayStatus(`Found ${comments.length} comments. Getting embeddings...`);
    const commentsWithEmbeddings = [];
    let processedEmbeddingCount = 0;
    // Limit to 100 embeddings for efficiency/quota management in development
    const embeddingLimit = Math.min(comments.length, 100); 

    for (let i = 0; i < embeddingLimit; i++) {
        const commentText = comments[i];
        const embedding = await getEmbedding(commentText);
        if (embedding) {
            commentsWithEmbeddings.push({ text: commentText, embedding: embedding });
        }
        processedEmbeddingCount++;
        // Update status only periodically or for large sets to avoid too many DOM updates
        if (processedEmbeddingCount % 10 === 0 || processedEmbeddingCount === embeddingLimit) {
            updateOverlayStatus(`Getting embeddings (${processedEmbeddingCount}/${embeddingLimit})...`); 
        }
    }

    if (commentsWithEmbeddings.length === 0) {
        updateOverlayStatus("Failed to get embeddings for any comments. Check backend server and API key.");
        console.error("Failed to get embeddings for any comments.");
        return;
    }

    updateOverlayStatus(`Received embeddings for ${commentsWithEmbeddings.length} comments. Performing clustering...`);
    const numClusters = Math.min(
        Math.max(3, Math.floor(commentsWithEmbeddings.length / 10)), // At least 3 clusters, or 1 per 10 comments
        10 // Max 10 clusters to keep analysis manageable
    );
    const clusters = await performClustering(commentsWithEmbeddings, numClusters);

    updateOverlayStatus(`Clustering complete. Found ${clusters.length} distinct discussion points. Analyzing...`);

    const analysisResults = [];
    let overallSentimentCounts = { good: 0, bad: 0, neutral: 0, total: 0 };

    for (const cluster of clusters) {
        if (cluster.length > 0) {
            const representativeText = cluster[0].text; // Simple representative
            const analysis = await analyzeText(representativeText);
            
            if (analysis) {
                analysisResults.push({
                    representativeText: representativeText,
                    sentiment: analysis.sentiment,
                    summary: analysis.summary,
                    clusterSize: cluster.length
                });
                const sentimentCategory = analysis.sentiment.toLowerCase();
                if (overallSentimentCounts[sentimentCategory] !== undefined) {
                    overallSentimentCounts[sentimentCategory]++;
                }
                overallSentimentCounts.total++;
            }
        }
    }

    if (analysisResults.length > 0) {
        console.log("--- Sentiment & Summary by Cluster ---");
        displayOverallSentiment(overallSentimentCounts);
        displayClusterResults(analysisResults);

        chrome.runtime.sendMessage({
            action: "analysisComplete",
            success: true,
            results: {
                overallSentiment: overallSentimentCounts,
                clusterAnalysis: analysisResults
            }
        });
        updateOverlayStatus("Analysis complete!"); // Final status update
    } else {
        updateOverlayStatus("No distinct discussion points could be analyzed. Check console for errors.");
        console.error("No analysis results were obtained from clusters.");
        chrome.runtime.sendMessage({
            action: "analysisComplete",
            success: false,
            error: "No analysis results from clusters."
        });
    }
}

// --- Main logic when content script runs (initial injection and auto-start) ---
(async function() {
    console.log("Content script initiated.");
    // Check if it's a YouTube video page
    // CORRECTED LINE: Use 'youtube.com' to check the actual hostname
    if (window.location.hostname.includes('youtube.com') && window.location.pathname.startsWith('/watch')) {
        console.log("On a YouTube video page. Injecting overlay...");
        await injectOverlay(); // Inject the UI as soon as possible
        // Automatically start the analysis after overlay injection
        processYouTubeComments();
    } else {
        console.log("Not on a YouTube video page. Extension will not activate automatically.");
    }
})();

// --- Listen for messages from the background script ---
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Message received in content.js:", request.action); // ADDED LOG
    if (request.action === "startAnalysis") {
        const videoId = getVideoId();
        if (videoId) {
            updateOverlayStatus("Starting sentiment analysis for video: " + videoId);
            processYouTubeComments();
            sendResponse({ status: "Processing started" });
        } else {
            updateOverlayStatus("Could not find video ID. Please ensure you are on a YouTube video page.");
            sendResponse({ status: "Error: No video ID" });
        }
        return true;
    } else if (request.action === "analysisComplete") {
        if (request.success) {
            // Handled by processYouTubeComments already
        } else {
            updateOverlayStatus("Analysis failed: " + (request.error || "Unknown error."));
        }
    } else if (request.action === "analysisUpdate") {
        updateOverlayStatus(request.message);
    }
});