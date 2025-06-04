# my_llm_backend/app.py
import os
from flask import Flask, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv
from flask_cors import CORS
import requests # To make HTTP requests to the YouTube Data API

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure the Google Gemini API key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable not set. Please create a .env file.")
genai.configure(api_key=GOOGLE_API_KEY)

# Configure the YouTube Data API key
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
if not YOUTUBE_API_KEY:
    raise ValueError("YOUTUBE_API_KEY environment variable not set. Please create a .env file with your YouTube Data API v3 key.")

# --- Existing Endpoints (analyze_text, get_embedding) ---

@app.route('/analyze_text', methods=['POST'])
def analyze_text():
    """
    Receives text, analyzes sentiment, and summarizes using Google Gemini API (gemini-pro).
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "No 'text' field found in request body"}), 400

    text_to_analyze = data['text']

    try:
        # CORRECTED LINE: Prefix 'gemini-pro' with 'models/'
        model = genai.GenerativeModel('models/gemini-pro')
        prompt = f"""
        Analyze the sentiment of the following text and categorize it as 'good', 'bad', or 'neutral'.
        Then, provide a brief and concise overall summarization of the text, no more than 2-3 sentences.

        Format your response as follows:
        Sentiment: [good/bad/neutral]
        Summary: [Your concise summarization here]

        Text:
        {text_to_analyze}
        """
        print(f"Calling Gemini API (gemini-pro) for analysis of text: '{text_to_analyze[:50]}...'")
        response = model.generate_content(prompt)
        print("Received response from Gemini API for analysis.")

        generated_text = response.text.strip()
        sentiment = "N/A"
        summary = "N/A"

        lines = generated_text.split('\n')
        for line in lines:
            if line.lower().startswith("sentiment:"):
                sentiment = line.split(":", 1)[1].strip()
            elif line.lower().startswith("summary:"):
                summary = line.split(":", 1)[1].strip()
        
        return jsonify({
            "sentiment": sentiment,
            "summary": summary
        }), 200

    except Exception as e:
        print(f"Error calling Gemini API for analysis: {e}")
        return jsonify({"error": f"Internal server error: {e}"}), 500

@app.route('/get_embedding', methods=['POST'])
def get_embedding():
    """
    Receives text and returns its embedding using Google Gemini 'embedding-001' model.
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "No 'text' field found in request body"}), 400

    text_to_embed = data['text']

    try:
        # CORRECTED LINE: Prefix 'embedding-001' with 'models/'
        print(f"Calling Gemini API (embedding-001) for text: '{text_to_embed[:50]}...'")
        response = genai.embed_content(
            model='models/embedding-001', # Prefix with 'models/'
            content=text_to_embed
        )
        print("Received embedding from Gemini API.")
        embedding = response['embedding'] 
        
        return jsonify({"embedding": embedding}), 200

    except Exception as e:
        print(f"Error calling Gemini API for embedding: {e}")
        return jsonify({"error": f"Internal server error: {e}"}), 500

# --- NEW ENDPOINT: Fetch YouTube Comments using YouTube Data API ---

@app.route('/get_youtube_comments', methods=['POST'])
def get_youtube_comments():
    """
    Receives a videoId, fetches comments using the YouTube Data API,
    and returns them.
    """
    data = request.get_json()
    if not data or 'videoId' not in data:
        return jsonify({"error": "No 'videoId' field found in request body"}), 400

    video_id = data['videoId']
    comments_list = []
    
    # Max results per page for YouTube Data API is 100
    # We'll fetch multiple pages to get more comments, up to a total limit
    max_total_comments = 200 # Adjust this limit as needed based on your quota
    
    next_page_token = None
    
    print(f"Fetching comments for video ID: {video_id} using YouTube Data API...")

    try:
        while len(comments_list) < max_total_comments:
            youtube_api_url = "https://www.googleapis.com/youtube/v3/commentThreads"
            params = {
                "part": "snippet",
                "videoId": video_id,
                "key": YOUTUBE_API_KEY,
                "textFormat": "plainText",
                "maxResults": 100 # Max allowed per request
            }
            if next_page_token:
                params["pageToken"] = next_page_token

            response = requests.get(youtube_api_url, params=params)
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            data = response.json()

            for item in data.get('items', []):
                comment_text = item['snippet']['topLevelComment']['snippet']['textDisplay']
                comments_list.append(comment_text)
                if len(comments_list) >= max_total_comments:
                    break
            
            next_page_token = data.get('nextPageToken')
            if not next_page_token:
                break # No more pages

            print(f"Fetched {len(comments_list)} comments so far...")

        print(f"Finished fetching comments. Total: {len(comments_list)}")
        return jsonify({"comments": comments_list}), 200

    except requests.exceptions.RequestException as e:
        print(f"Error calling YouTube Data API: {e}")
        return jsonify({"error": f"Failed to fetch YouTube comments: {e}"}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": f"Internal server error: {e}"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)