from supabase import create_client, Client
import os 
from dotenv import load_dotenv
from methods import json_dict, email_dict

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") 

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def insert_to_supabase(articles): 
    # Insert all articles into Supabase
    try:
        urls = [a["url"] for a in articles]
        existing = (
            supabase.table("articles")
            .select("url")
            .in_("url", urls)
            .execute()
        )
        existing_urls = set(a["url"] for a in existing.data)
        new_articles = [a for a in articles if a["url"] not in existing_urls]
        if new_articles:
            supabase.table("articles").upsert(new_articles, on_conflict="url").execute()
    except Exception as e:
        print("Unexpected error inserting into Supabase:", e)

def get_recent_10_articles():
    try:
        response = (
            supabase.table("articles")
            .select("content, url")
            .order("created_at", desc=False)
            .limit(10)
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"error: {e}")
        return 500

def get_all_saved():
    try:
        response = (
            supabase.table("articles")
            .select("content, url")
            .order("created_at", desc=False)
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"error: {e}")
        return 500
    
def search_for_articles(websites, search_terms, limit, keywords, urls, start_date, end_date): 
    try: 
        query = supabase.table("articles").select("content, url")

        # website match (exact)
        if websites: 
            query = query.in_("website", websites)
        
        # url match (optional, exact)
        if urls: 
            query = query.in_("url", urls)

        if search_terms: 
            for term in search_terms: 
                query = query.or_(f"title.ilike.%{term}%")

        if keywords: 
            for keyword in keywords: 
                query = query.or_(f"content.ilike.%{keyword}%")

        if start_date != 0 and end_date != 0:
            query = query.gte("published_date", start_date).lte("published_date", end_date)

        if limit != 0: 
            query = query.limit(limit)

        query = query.order("created_at", desc=True)

        response = query.execute()
        return response.data
    except Exception as e: 
        print(f"error {e}")
        return 500
    
def populate_fields():
    try:
        response = (
            supabase.table("articles")
            .select("*")
            .execute()
        )
        if (len(response.data) != 0):
            for dict in response.data: 
                input_tag = f"<input value='{dict['url']}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n"
                for_email_html = dict['content'].replace(input_tag, "")
                email_dict[dict['url']] = for_email_html

                json_dict[dict['url']] = {"website": dict['website'], "title": dict['title'], "author": dict['author'], "published": dict['published'], "keywords": dict['keywords'], "url": dict['url'], "content": dict['content']}           
    except Exception as e:
        print(f"error: {e}")
        return 500
