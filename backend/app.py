from flask import Flask, request, jsonify
from flask_cors import CORS
# import json
from datetime import datetime
import sys
import signal
# import re

# comma_splitter = re.compile(r'\s*\|\\s*')
now = datetime.now()
d_year = now.year 
d_month = now.month
d_day = now.day
# Import your existing modules
try:
    from methods import construct_message, json_dict, send_email, email_dict, is_valid_email # Import your email automation
    from search import search_all_sites  # Import your scraping logic
    from database import insert_to_supabase, get_recent_10_articles, populate_fields, search_for_articles, get_all_saved
except ImportError:
    print("Warning: Could not import some modules. Make sure database.py, search.py, and methods.py exist.")

app = Flask(__name__)
#CORS(app, origins=['https://www.summarizer.howard1218.site/'], supports_credentials=True)  # Enable CORS for frontend communication 
CORS(app, origins=[
    "http://127.0.0.1:5501", 
    "https://www.summarizer.howard1218.site",
    "https://summarizer.howard1218.site"
], supports_credentials=True)
@app.route('/api/email-to-user', methods=['POST'])
def email_to_user():
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({"status": "error", "message": "Invalid JSON"}), 400
        
        article_ids = payload.get("data", [])
        email_address = payload.get("email_address")
        
        # 1. Check if the email field exists or is empty
        if not email_address or email_address.strip() == "":
            return jsonify({
                "status": "error",
                "message": "Email address is required."
            }), 400 # 400 = Bad Request

        # 2. Check if the format is actually an email
        if not is_valid_email(email_address):
            return jsonify({
                "status": "error",
                "message": "Please provide a valid email address."
            }), 400

        # 3. Check if there is actually data to send
        if not article_ids:
            return jsonify({
                "status": "error",
                "message": "No articles selected to summarize."
            }), 400
            
        email_html_content = ""
        
        for article_id in article_ids:
            content = email_dict.get(article_id, "<p>Article content not found.</p>")
            email_html_content += content
        
        success = send_email(email_content_html=email_html_content, recipient_emails=email_address)
        
        if success:
            return jsonify({
                "status": "success", 
                "message": "email successfully sent"
            }), 200
        else:
            # This catches cases where Resend rejected the API key or domain
            return jsonify({
                "status": "sending error",
                "message": "The email provider rejected the request."
            }), 502 # 502 means Bad Gateway (problem with the 3rd party service)
            
    except Exception as e:
        print(f"Server Error: {str(e)}")
        return jsonify({
            'status': 'sending error',
            'message': 'Server error: ' + str(e)
        }), 500
    
@app.route('/api/save-to-database', methods=['POST'])
def save_to_database():
    try:
        payload = request.get_json()
        article_ids = payload.get("data")
        list_of_json_data = [json_dict[article_id] for article_id in article_ids]
        insert_to_supabase(list_of_json_data)
        return jsonify({"status": "success", 
                        "message": "saved successfully to database"
                        }), 200
    except Exception as e:
        print(str(e))
        return jsonify({
            'status': 'saving error',
            'message': str(e)
        }), 500
    
@app.route('/api/search-site', methods=['POST'])
def search_site():
    """Handle site search requests from frontend"""
    try:
        data = request.get_json()
        
        # Extract search parameters
        websites = [int(x) for x in data.get('websites', ["0"])]
        search_terms = data.get('searchTerms', "MSI")
        limit = data.get('limit', 1)
        day_from = data.get('day_from', 1)
        month_from = data.get('month_from', 1)
        year_from = data.get('year_from', 2025)
        day_to = data.get('day_to', d_day)
        month_to = data.get('month_to', d_month)
        year_to = data.get('year_to', d_year)
        keywords = data.get('keywords', "")

        # print("day from: ", day_from)
        # print("month from: ", month_from)
        # print("year from: ", year_from)

        # print("day to: ", day_to)
        # print("month to: ", month_to)
        # print("year to: ", year_to)
        
        if keywords:
            keywords = [kw.strip() for kw in keywords.split(",") if kw.strip()]
        else: 
            keywords = []
        
        if search_terms:
            search_terms = [kw.strip() for kw in search_terms.split("|") if kw.strip()]
        else: 
            search_terms = []

        # Log the search request
        print(f"Site search request: {search_terms} on {len(websites)} websites: {websites}, limit:{limit}")
        results_list = search_all_sites(search_terms=search_terms, article_limit=limit, year_from=year_from, month_from=month_from, day_from=day_from, year_to=year_to, month_to=month_to, day_to=day_to, sites_to_search=websites, keywords=keywords)
                
        return_str = construct_message(results_list=results_list)
        #save_to_file(return_str)
        return jsonify({"status": "success", 
                        "message": "returning json",
                        "html": return_str
                        }), 200
        
    except Exception as e:
        print(str(e))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/recent-saves', methods=['GET'])
def get_recent_articles():
    try:
        response = get_recent_10_articles()
        for dict in response: 
            input_tag = f"<input value='{dict['url']}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n"
            for_email_html = dict['content'].replace(input_tag, "")

            email_dict[dict['url']] = for_email_html

        return jsonify({"status": "success", 
                        "message": "got 10 most recent articles saved",
                        "html": "".join(article.get("content", "") for article in response)
                        }), 200
    except Exception as e:
        print(str(e))
        return jsonify({
            'status': 'error fetching from database',
            'message': str(e)
        }), 500

@app.route('/api/all-saved', methods=['GET'])
def get_all_saved_articles():
    try:
        response = get_all_saved()
        for dict in response: 
            input_tag = f"<input value='{dict['url']}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n"
            for_email_html = dict['content'].replace(input_tag, "")

            email_dict[dict['url']] = for_email_html

        return jsonify({"status": "success", 
                        "message": "got all saved articles",
                        "html": "".join(article.get("content", "") for article in response)
                        }), 200
    except Exception as e:
        print(str(e))
        return jsonify({
            'status': 'error fetching from database',
            'message': str(e)
        }), 500
    
@app.route('/api/search-database', methods=['POST'])
def search_database():
    """Handle database search requests from frontend"""
    try:
        data = request.get_json()
        
        # Extract search parameters
        websites = data.get('websites', ["Tom's Hardware"]) # required
        search_terms = data.get('searchTerms', "MSI")
        limit = data.get('limit', 0) # optional
        keywords = data.get('keywords', "") # optional
        urls = data.get('urls', "") # optional
        day_from = data.get('day_from', 0) # optional
        month_from = data.get('month_from', 0) # optional
        year_from = data.get('year_from', 0) # optional
        day_to = data.get('day_to', 0) # optional
        month_to = data.get('month_to', 0) # optional
        year_to = data.get('year_to', 0) # optional

        # print("day from: ", day_from)
        # print("month from: ", month_from)
        # print("year from: ", year_from)

        # print("day to: ", day_to)
        # print("month to: ", month_to)
        # print("year to: ", year_to)

        start_date = 0
        end_date = 0
        if year_from != 0 and month_from != 0 and day_from != 0:
            start_date = f"{year_from}-{month_from:02}-{day_from:02}"

        if year_to != 0 and month_to != 0 and day_to != 0:  
            end_date = f"{year_to}-{month_to:02}-{day_to:02}"
        
        # print(start_date, end_date)
        if keywords != "":
            keywords = [kw.strip() for kw in keywords.split(",") if kw.strip()]
        else: 
            keywords = []

        if urls != "":
            urls = urls.strip().replace(" ", "").split(",")
        else: 
            urls = []
        
        # print("websites: ", websites)
        # print("search terms: ", search_terms)
        # print("limit: ", limit)
        # print("day: ", day)
        # print("month: ", month)
        # print("year: ", year)
        # print("keywords: ", keywords)
        # print("urls: ", urls)

        # Log the search request
        print(f"Database search request: matching titles with {search_terms} with limit of {limit}")
        response = search_for_articles(websites, search_terms, limit, keywords, urls, start_date, end_date)
        # Here you can integrate with your existing database functions
        return jsonify({"status": "success", 
                        "message": "returning json",
                        "html": "".join(article.get("content", "") for article in response)
                        }), 200
        
    except Exception as e:
        print(str(e))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

def graceful_shutdown(sig, frame):
    insert_to_supabase(list(json_dict.values()))
    sys.exit(0)

signal.signal(signal.SIGINT, graceful_shutdown)  # Ctrl+C
signal.signal(signal.SIGTERM, graceful_shutdown)

if __name__ == '__main__':
    #populate_fields()
    # app.run(debug=False, host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))

    app.run(debug=True, host='127.0.0.1', port=5000) 
