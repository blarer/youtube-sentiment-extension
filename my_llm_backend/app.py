# my_llm_backend/app.py
import os
from flask import Flask, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv
from flask_cors import CORS
import requests # To make HTTP requests to the YouTube Data API
import json # Import the json module for parsing LLM responses

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app) # Add this line right after app initialization

# Configure the Google Gemini API key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable not set. Please create a .env file.")
genai.configure(api_key=GOOGLE_API_KEY)

# Configure the YouTube Data API key
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
if not YOUTUBE_API_KEY:
    raise ValueError("YOUTUBE_API_KEY environment variable not set. Please create a .env file with your YouTube Data API v3 key.")


@app.route('/analyze_text', methods=['POST'])
def analyze_text():
    """
    Receives text, analyzes sentiment, and summarizes using Google Gemini API.
    Now specifically requests and parses JSON output from Gemini.
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "No 'text' field found in request body"}), 400

    text_to_analyze = data['text'] # This is the variable used in the prompt

    try:
        model = genai.GenerativeModel('models/gemini-1.5-flash') # Or 'models/gemini-pro' if you prefer
        
        # --- REVISED PROMPT TO ASK FOR JSON ---
        prompt = f"""
        You are an AI assistant specialized in analyzing YouTube comments.
        Your explicit purpose is to summarize distinct discussion points and determine their overall sentiment.

        You are being provided with a collection of YouTube comments that belong to a specific, clustered discussion point.
        **These comments come from multiple different users**, not a single individual commenter.

        Your task is to:
        1.  Carefully read and understand the main themes, key opinions, and overall context expressed within this group of comments.
        2.  **Crucially, when summarizing, avoid attributing statements to a single 'commenter' or 'user'.** Instead, use collective terms such as "users," "commenters," "the discussion," "this group of comments," or "the cluster discusses."
        3.  Provide a concise summary of this particular discussion point. The summary should be brief, no more than 2-3 sentences, and clearly reflect the collective sentiment and main ideas.
        4.  Determine the overall sentiment of this discussion point based on the collective comments. Choose one of the following categories: 'Positive', 'Negative', or 'Neutral'.

        The comments from this cluster to analyze are:
        ---
        {text_to_analyze}
        ---

        Your response MUST be a JSON object with exactly two keys: 'sentiment' and 'summary'.
        -   The 'sentiment' key should contain one of 'Positive', 'Negative', or 'Neutral'.
        -   The 'summary' key should contain your concise summary string.

        Example of desired response format:
        {{
            "sentiment": "Positive",
            "summary": "Users in this cluster are highly enthusiastic about the video's production quality and comedic timing, with many expressing a desire for more content."
        }}
        """
        # --- END OF REVISED PROMPT ---
        
        print(f"Calling Gemini API ({model.model_name}) for analysis of text: '{text_to_analyze[:50]}...'")
        response = model.generate_content(prompt)
        print(f"Received response from Gemini API for analysis. Raw text: {response.text[:200]}...")

        # --- NEW JSON PARSING LOGIC ---
        generated_text = response.text.strip()
        
        # Remove potential markdown code block wrappers if Gemini adds them
        if generated_text.startswith('```json'):
            generated_text = generated_text.lstrip('```json').rstrip('```')
        elif generated_text.startswith('```'): # Catch general code blocks
            generated_text = generated_text.lstrip('```').rstrip('```')
            
        response_json = json.loads(generated_text) # Attempt to parse as JSON

        sentiment = response_json.get('sentiment')
        summary = response_json.get('summary')

        # Safeguard: Only allow 'Positive', 'Negative', or 'Neutral' (case-insensitive)
        allowed_sentiments = {'positive', 'negative', 'neutral'}
        if not sentiment or sentiment.strip().lower() not in allowed_sentiments:
            sentiment = 'Neutral'
        else:
            # Normalize to capitalized form for consistency
            sentiment = sentiment.capitalize()

        if sentiment is None or summary is None: # Check if keys are actually present
            raise ValueError("Gemini response missing 'sentiment' or 'summary' key, or format is incorrect.")
        
        return jsonify({
            "sentiment": sentiment,
            "summary": summary
        }), 200

    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response as JSON. Response was: '{generated_text}' - Error: {e}")
        return jsonify({"error": f"Failed to parse Gemini JSON response: {e}. Raw: {generated_text[:200]}"}), 500
    except Exception as e:
        print(f"An unexpected error occurred during analyze_text: {e}")
        return jsonify({"error": f"Internal server error during analysis: {e}"}), 500

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
        print(f"Calling Gemini API (embedding-001) for text: '{text_to_embed[:50]}...'")
        response = genai.embed_content(
            model='models/embedding-001',
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