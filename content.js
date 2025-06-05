// youtube-sentiment-extension/content.js

// Backend server URL
const BACKEND_URL = "http://127.0.0.1:5000";

// --- UI Injection and Update Functions ---

// Function to get the YouTube video ID from the current URL
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    console.log("getVideoId called. Found video ID:", videoId);
    return videoId;
}

// Function to inject the HTML overlay
async function injectOverlay() {
    console.log("injectOverlay called.");
    // Check if the overlay already exists to prevent duplicates
    if (document.getElementById('sentiment-analysis-overlay')) {
        console.log("Overlay already exists. Skipping injection.");
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

        // After overlay is injected, apply dark mode (Chart.js is already loaded)
        
        chrome.runtime.sendMessage(
            { action: "getDarkMode" },
            (response) => {
                setOverlayDarkMode(response && response.darkMode === true);
            }
        );
    } catch (error) {
        console.error("Failed to inject overlay:", error);
    }
}

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
    const clustersDiv = document.getElementById('overlay-clusters-results');
    if (clustersDiv) {
        clustersDiv.innerHTML = ''; // Clear previous cluster results
        clustersDiv.style.display = 'none';
    }
}

// CORRECTED: Updated to use 'positive', 'negative', 'neutral' keys for counts
function displayOverallSentiment(sentimentCounts) {
    const statusDiv = document.getElementById('overlay-status');
    const resultsDiv = document.getElementById('overlay-results');
    const positiveSpan = document.getElementById('overlay-positive');
    const negativeSpan = document.getElementById('overlay-negative');
    const neutralSpan = document.getElementById('overlay-neutral');
    const totalAnalyzedSpan = document.getElementById('overlay-total-analyzed');

    if (statusDiv) statusDiv.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';

    // Update text content using the new keys ('positive', 'negative', 'neutral')
    if (positiveSpan) positiveSpan.textContent = sentimentCounts.positive || 0;
    if (negativeSpan) negativeSpan.textContent = sentimentCounts.negative || 0;
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
        // The sentiment class should already be correctly formed from result.sentiment.toLowerCase()
        // e.g., 'sentiment-positive', 'sentiment-negative', 'sentiment-neutral'
        li.innerHTML = `
            <strong>Point ${index + 1}</strong> (Sentiment: <span class="sentiment-${result.sentiment.toLowerCase()}">${result.sentiment}</span>, Comments: ${result.clusterSize}):<br>
            <p class="summary-text">${result.summary}</p>
        `;

        // Create the <details> and <summary> elements dynamically for the comments list
        const detailsElement = document.createElement('details');
        const summaryElement = document.createElement('summary');
        summaryElement.textContent = 'View All Comments in this Point'; // More descriptive text for the dropdown
        detailsElement.appendChild(summaryElement);

        const commentsListUl = document.createElement('ul');
        commentsListUl.style.paddingLeft = '20px'; // Add some padding for nested list
        commentsListUl.style.marginTop = '5px';

        // Iterate over the stored 'clusterComments' array and create a list item for each
        if (result.clusterComments && result.clusterComments.length > 0) {
            result.clusterComments.forEach(commentText => {
                const commentLi = document.createElement('li');
                commentLi.textContent = commentText;
                commentsListUl.appendChild(commentLi);
            });
        } else {
            const noCommentsLi = document.createElement('li');
            noCommentsLi.textContent = "No comments found for this point.";
            commentsListUl.appendChild(noCommentsLi);
        }
        detailsElement.appendChild(commentsListUl);

        li.appendChild(detailsElement); // Append the new details structure to the list item
        ul.appendChild(li); // Append the whole list item to the main ul
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
    console.log("Calling getEmbedding for text:", text.substring(0, 30) + "...");
    try {
        const response = await fetch(`${BACKEND_URL}/get_embedding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }
        const data = await response.json();
        console.log("Received embedding.");
        return data.embedding;
    } catch (error) {
        console.error("Error getting embedding:", error);
        return null;
    }
}

// Function to perform basic clustering (K-Means simplified for demonstration)
async function performClustering(commentsWithEmbeddings, k = 5, maxIterations = 50) {
    console.log("performClustering called with", commentsWithEmbeddings.length, "comments.");
    if (commentsWithEmbeddings.length === 0) return [];
    if (commentsWithEmbeddings.length < k) {
        // If fewer comments than clusters, treat each comment as its own cluster
        return commentsWithEmbeddings.map(c => [c]);
    }
    
    let centroids = [];
    const shuffled = [...commentsWithEmbeddings].sort(() => 0.5 - Math.random());
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
                // Reinitialize empty clusters with a random comment's embedding
                newCentroids.push(commentsWithEmbeddings[Math.floor(Math.random() * commentsWithEmbeddings.length)].embedding);
                changed = true;
            }
        }
        centroids = newCentroids;
        if (!changed) break; // Stop if centroids haven't changed significantly
    }
    return clusters.filter(c => c.length > 0); // Return only non-empty clusters
}

// Function to analyze text (sentiment and summary) from the backend
async function analyzeText(text) {
    console.log("Calling analyzeText for text:", text.substring(0, 30) + "...");
    try {
        const response = await fetch(`${BACKEND_URL}/analyze_text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }
        const data = await response.json();
        console.log("Received sentiment/summary.");
        return data;
    } catch (error) {
        console.error("Error analyzing text:", error);
        return null;
    }
}

// NEW Function: Fetch YouTube Comments from backend
async function fetchYouTubeComments(videoId) {
    console.log("Sending POST to /get_youtube_comments with videoId:", videoId);
    console.log("fetchYouTubeComments called for video ID:", videoId);
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
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }
        const data = await response.json();
        console.log(`Received ${data.comments ? data.comments.length : 0} comments from backend.`);
        return data.comments || [];
    } catch (error) {
        console.error("Error fetching YouTube comments from backend:", error);
        updateOverlayStatus("Failed to fetch comments. Check backend server and YouTube API key.");
        return [];
    }
}

// Main function to orchestrate the process
async function processYouTubeComments() {
    const myToken = Symbol();
    currentAnalysisToken = myToken;

    console.log("processYouTubeComments called. Starting analysis workflow.");
    updateOverlayStatus("YouTube Sentiment Extension: Initializing...");
    if (currentAnalysisToken !== myToken) return;

    const videoId = getVideoId();
    if (!videoId) {
        updateOverlayStatus("Not a YouTube video page or could not find video ID.");
        console.log("processYouTubeComments: No video ID found.");
        return;
    }
    if (currentAnalysisToken !== myToken) return;

    const comments = await fetchYouTubeComments(videoId);
    if (currentAnalysisToken !== myToken) return;

    if (comments.length === 0) {
        updateOverlayStatus("No comments found via YouTube Data API. Try reloading or check API quotas.");
        console.log("No comments fetched from backend.");
        return;
    }
    if (currentAnalysisToken !== myToken) return;

    updateOverlayStatus(`Found ${comments.length} comments. Getting embeddings...`);
    const embeddingLimit = Math.min(comments.length, 100);
    // Only process up to embeddingLimit comments
    const commentsToEmbed = comments.slice(0, embeddingLimit);
    let processedEmbeddingCount = 0;

    // Map each comment to a fetch promise
    const embeddingPromises = commentsToEmbed.map((comment, idx) =>
        fetch(`${BACKEND_URL}/get_embedding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: comment })
        })
        .then(res => res.json())
        .then(data => {
            processedEmbeddingCount++;
            if (processedEmbeddingCount % 10 === 0 || processedEmbeddingCount === embeddingLimit) {
                updateOverlayStatus(`Getting embeddings (${processedEmbeddingCount}/${embeddingLimit})...`);
            }
            return { text: comment, embedding: data.embedding };
        })
        .catch(err => {
            console.error('Error getting embedding:', err);
            return null;
        })
    );

    // Wait for all embedding fetches to complete
    const commentsWithEmbeddings = (await Promise.all(embeddingPromises))
        .filter(obj => obj && Array.isArray(obj.embedding) && obj.embedding.length > 0);
    if (currentAnalysisToken !== myToken) return;

    if (commentsWithEmbeddings.length === 0) {
        updateOverlayStatus("Failed to get embeddings for any comments. Check backend server and API key.");
        console.error("Failed to get embeddings for any comments.");
        return;
    }
    if (currentAnalysisToken !== myToken) return;

    if (commentsWithEmbeddings.length < commentsToEmbed.length) {
        console.warn(`Filtered out ${commentsToEmbed.length - commentsWithEmbeddings.length} comments due to missing embeddings.`);
    }

    updateOverlayStatus(`Received embeddings for ${commentsWithEmbeddings.length} comments. Performing clustering...`);
    const numClusters = Math.min(
        Math.max(3, Math.floor(commentsWithEmbeddings.length / 10)),
        10
    );
    const clusters = await performClustering(commentsWithEmbeddings, numClusters);
    if (currentAnalysisToken !== myToken) return;

    updateOverlayStatus(`Clustering complete. Found ${clusters.length} distinct discussion points. Analyzing...`);

    const analysisResults = [];
    let overallSentimentCounts = { positive: 0, negative: 0, neutral: 0, total: 0 };

    for (const cluster of clusters) {
        if (currentAnalysisToken !== myToken) return;
        if (cluster.length > 0) {
            const commentsToSummarize = cluster.slice(0, 5).map(c => c.text).join('\n\n'); 
            const allCommentsInCluster = cluster.map(c => c.text);
            const displayRepresentativeText = cluster[0].text; 
            const analysis = await analyzeText(commentsToSummarize); 
            if (currentAnalysisToken !== myToken) return;
            if (analysis) {
                analysisResults.push({
                    representativeText: displayRepresentativeText,
                    clusterComments: allCommentsInCluster,
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
    if (currentAnalysisToken !== myToken) return;

    if (analysisResults.length > 0) {
        console.log("--- Sentiment & Summary by Cluster ---");
        displayOverallSentiment(overallSentimentCounts);
        displayClusterResults(analysisResults);
        renderSentimentPieChart(overallSentimentCounts);
        chrome.runtime.sendMessage({
            action: "analysisComplete",
            success: true,
            results: {
                overallSentiment: overallSentimentCounts,
                clusterAnalysis: analysisResults
            }
        });
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

let currentVideoId = null;
let currentAnalysisToken = null;

function handleNavigation() {
    const isVideoPage = window.location.hostname.includes('youtube.com') && window.location.pathname.startsWith('/watch');
    const videoId = getVideoId();

    if (isVideoPage && videoId !== currentVideoId) {
        currentVideoId = videoId;
        const existingOverlay = document.getElementById('sentiment-analysis-overlay');
        if (existingOverlay) existingOverlay.remove();
        injectOverlay().then(() => {
            processYouTubeComments();
        });
    } else if (!isVideoPage && document.getElementById('sentiment-analysis-overlay')) {
        document.getElementById('sentiment-analysis-overlay').remove();
        currentVideoId = null;
        currentAnalysisToken = null; // Invalidate any running analysis
    }
}

// Listen for YouTube navigation events (works for most modern YouTube navigation)
window.addEventListener('yt-navigate-finish', handleNavigation);

// Fallback: Poll for URL changes every 500ms (for browsers/extensions where the event doesn't fire)
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        handleNavigation();
    }
}, 500);

// Initial check on script load
handleNavigation();

// --- Listen for messages from the background script ---
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Message received in content.js:", request.action);
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
    } else if (request.action === "setDarkMode") {
        setOverlayDarkMode(request.darkMode);
    }
});

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

function renderSentimentPieChart(sentimentCounts) {
    console.log("renderSentimentPieChart called with data:", sentimentCounts);

    const canvas = document.getElementById('sentimentPieChart');
    if (!canvas) {
        console.error("Canvas element with ID 'sentimentPieChart' not found!");
        return; // Exit if canvas is not found
    }
    const ctx = canvas.getContext('2d');
    console.log("Canvas context obtained:", ctx);

    // --- Add these new logs ---
    console.log("Type of window.Chart:", typeof window.Chart);
    console.log("Value of window.sentimentPieChart BEFORE destroy:", window.sentimentPieChart);
    // --- End new logs ---

    // Destroy previous chart if it exists and is a Chart instance
    if (window.sentimentPieChart && typeof window.sentimentPieChart.destroy === 'function') {
        window.sentimentPieChart.destroy();
        console.log("Destroyed previous chart.");
    } else {
        console.log("No previous chart instance to destroy or it's not a valid Chart instance.");
    }

    console.log("Attempting to create new Chart instance.");
    // --- Add this new log ---
    console.log("Type of window.Chart BEFORE new Chart():", typeof window.Chart);
    // --- End new log ---

    if (typeof window.Chart !== 'function') {
         console.error("Chart.js is not available (window.Chart is not a function). Cannot render chart.");
         return; // Exit if Chart.js is not available
    }

    window.sentimentPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Positive', 'Negative', 'Neutral'],
            datasets: [{
                data: [
                    sentimentCounts.positive || 0,
                    sentimentCounts.negative || 0,
                    sentimentCounts.neutral || 0
                ],
                backgroundColor: [
                    'rgba(40, 200, 40, 0.7)',
                    'rgba(220, 50, 50, 0.7)',
                    'rgba(255, 180, 50, 0.7)'
                ],
                borderColor: [
                    'rgba(40, 200, 40, 1)',
                    'rgba(220, 50, 50, 1)',
                    'rgba(255, 180, 50, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: { display: true, position: 'bottom' }
            }
        }
    });
}