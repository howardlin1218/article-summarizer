from supabase import create_client, Client
import os 
from dotenv import load_dotenv
from methods import website_urls
import requests
from bs4 import BeautifulSoup
from search import extract_link_preview_metadata
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
        return ensure_preview_in_content(response.data)
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
        return ensure_preview_in_content(response.data)
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
        return ensure_preview_in_content(response.data)
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
            migrated_data = ensure_preview_in_content(response.data)
            for dict in migrated_data: 
                input_tag = f"<input value='{dict['url']}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n"
                for_email_html = dict['content'].replace(input_tag, "")
                email_dict[dict['url']] = for_email_html

                json_dict[dict['url']] = {"website": dict['website'], "title": dict['title'], "author": dict['author'], "published": dict['published'], "keywords": dict['keywords'], "url": dict['url'], "content": dict['content']}           
    except Exception as e:
        print(f"error: {e}")
        return 500

def ensure_preview_in_content(db_rows):
    """
    Checks each database row. If the HTML content does not contain a link preview card,
    it dynamically fetches the preview metadata, injects the preview card,
    and updates the database row.
    """
    if not db_rows:
        return db_rows

    headers = {"User-Agent": "Chrome/114.0.0.0 Safari/537.36"}

    for row in db_rows:
        content_html = row.get("content", "")
        url = row.get("url", "")
        if not content_html or not url:
            continue

        # If it already has the link preview card, skip
        if "link-preview-card" in content_html:
            continue

        try:
            # 1. Fetch the page to extract preview metadata
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                page_soup = BeautifulSoup(response.text, "html.parser")
                thumbnail_url, description = extract_link_preview_metadata(page_soup, url)
                
                # 2. Parse the stored HTML content
                content_soup = BeautifulSoup(content_html, "html.parser")
                
                # Find the "Article Link" table row and replace it
                th_element = content_soup.find(lambda tag: tag.name == "th" and "Article Link" in tag.text)
                if th_element:
                    tr_element = th_element.find_parent("tr")
                    if tr_element:
                        # Find the parent website_url key
                        website_url = "https://www.tomshardware.com/search"
                        for w_url, w_name in website_urls.items():
                            if w_name in content_html:
                                website_url = w_url
                                break
                        
                        # Find title, author, publish date, keywords to reconstruct the row/card
                        title = ""
                        author = ""
                        publish_date = ""
                        keywords = []
                        
                        title_th = content_soup.find(lambda tag: tag.name == "th" and "Title" in tag.text)
                        if title_th and title_th.find_next_sibling("td"):
                            title = title_th.find_next_sibling("td").get_text(strip=True)
                            
                        author_th = content_soup.find(lambda tag: tag.name == "th" and "Author" in tag.text)
                        if author_th and author_th.find_next_sibling("td"):
                            author = author_th.find_next_sibling("td").get_text(strip=True)
                            
                        date_th = content_soup.find(lambda tag: tag.name == "th" and "Publish Date" in tag.text)
                        if date_th and date_th.find_next_sibling("td"):
                            publish_date = date_th.find_next_sibling("td").get_text(strip=True)
                            
                        kw_th = content_soup.find(lambda tag: tag.name == "th" and "Keywords" in tag.text)
                        if kw_th and kw_th.find_next_sibling("td"):
                            kw_text = kw_th.find_next_sibling("td").get_text(strip=True)
                            keywords = [k.strip() for k in kw_text.split(",") if k.strip()]
                        
                        # Re-generate the Article Preview card HTML
                        thumbnail_html = ""
                        if thumbnail_url:
                            thumbnail_html = f"""
                            <div class="link-preview-thumbnail" style="width: 120px; min-width: 120px; height: 90px; border-radius: 4px; overflow: hidden; border: 1px solid #27272a; align-self: center; display: flex;">
                                <img src="{thumbnail_url}" alt="{title}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
                            </div>
                            """
                        
                        preview_card = f"""
                        <div class="link-preview-card" style="display: flex; gap: 1.25rem; background-color: #09090b; border: 1px solid #27272a; border-radius: 6px; padding: 1.25rem; margin-top: 0.5rem; overflow: hidden; align-items: stretch; text-align: left;">
                            <div class="link-preview-details" style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; justify-content: center;">
                                <span class="link-preview-site" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 600;">{website_urls[website_url]}</span>
                                <a href="{url}" target="_blank" class="link-preview-title" style="font-size: 1.1rem; font-weight: 600; color: #f4f4f5; text-decoration: underline; line-height: 1.4;">{title}</a>
                                <p class="link-preview-desc" style="font-size: 0.85rem; color: #a1a1aa; line-height: 1.5; margin: 0;">{description or 'No preview description available.'}</p>
                                <div class="link-preview-meta" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #a1a1aa; margin-top: 0.25rem;">
                                    <span class="link-preview-author">By {author}</span>
                                    <span class="link-preview-divider" style="color: #3f3f46;">•</span>
                                    <span class="link-preview-date">{publish_date}</span>
                                </div>
                            </div>
                            {thumbnail_html}
                        </div>
                        """
                        
                        # Replace the entire row with the new one
                        new_tr_html = f"<tr><th style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; background-color: rgba(255, 255, 255, 0.02); color: #a1a1aa; font-size: 0.85rem;'>Article Preview</th><td style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left;'>{preview_card}</td></tr>"
                        new_tr_soup = BeautifulSoup(new_tr_html, "html.parser").find("tr")
                        if new_tr_soup:
                            tr_element.replace_with(new_tr_soup)
                            
                            # Re-stringify the content HTML
                            new_content_html = str(content_soup)
                            
                            # Update the row dictionary
                            row["content"] = new_content_html
                            
                            # Save back to Supabase
                            supabase.table("articles").update({"content": new_content_html}).eq("url", url).execute()
        except Exception as e:
            print(f"Error migrating preview for url {url}: {e}")

    return db_rows
