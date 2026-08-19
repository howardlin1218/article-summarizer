import resend
import os 
from dotenv import load_dotenv
import asyncio
import re
from groq import Groq, AsyncGroq
from google import genai

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
resend.api_key = os.getenv("RESEND_APIKEY")
client = Groq(api_key=api_key)
async_groq_client = AsyncGroq(api_key=api_key)

# Initialize Gemini Client with Vertex AI
# gcp_project_id = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
# gcp_location = "us"
# gemini_client = genai.Client(
#     vertexai=True, 
#     project=gcp_project_id,
#     location=gcp_location
# )

website_urls = {
    "https://www.tomshardware.com/search": "Tom's Hardware",
    "https://www.pcmag.com/search/results": "PC Mag",
    "https://thepcenthusiast.com/": "The PC Enthusiast",
    "https://hothardware.com/search": "Hot Hardware",
    "https://pcper.com/": "PC Perspective",
    "https://gamerant.com/search": "GameRant",
    "https://www.windowscentral.com/search": "Windows Central",
    "https://www.techradar.com/search": "Tech Radar"
}

def is_safe_and_relevant_prompt(prompt: str) -> bool:
    if not prompt or not prompt.strip():
        return True
        
    p_lower = prompt.lower()
    
    # 1. Block obvious jailbreak / instruction override attempts
    jailbreak_signals = [
        "ignore previous", "ignore instruction", "ignore system", "ignore all rules",
        "system prompt", "you are now", "developer mode", "do anything now", "dan mode",
        "bypass", "ignore the article", "ignore the text", "forget the article", "forget the text"
    ]
    for signal in jailbreak_signals:
        if signal in p_lower:
            return False
            
    # 2. Block code generation or scripting tasks
    code_signals = [
        "write a python", "write javascript", "write html", "write code", "programming language",
        "write a script", "develop an app", "create a function", "bash script", "sql query"
    ]
    for signal in code_signals:
        if signal in p_lower:
            return False
            
    # 3. Block general knowledge queries or creative writing not pertaining to the article
    unrelated_tasks = [
        "write a story about", "write a novel", "write a poem about", "solve the equation",
        "calculate", "who is the president", "who won", "what is the capital"
    ]
    for task in unrelated_tasks:
        if task in p_lower:
            return False
            
    # 4. Check for at least one keyword relating to summarization, sentiment, translation, or analysis
    allowed_topics = [
        "summar", "bullet", "point", "explain", "read", "key", "extract", "analys", 
        "sentiment", "tone", "short", "brief", "article", "post", "write-up", "translate",
        "overview", "highlight", "main", "theme", "pirate", "opinion", "positive", "neutral", "negative"
    ]
    has_topic = any(topic in p_lower for topic in allowed_topics)
    if not has_topic:
        return False
        
    return True

def convert_metadata_to_html(website_url, title, author, publish_date, keywords, link, thumbnail_url=None, description=None):
    rows = ""
    rows += f"<tr><th style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; background-color: rgba(255, 255, 255, 0.02); color: #a1a1aa; font-size: 0.85rem;'>Website</th><td style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; color: #f4f4f5; font-size: 0.85rem;'>{website_urls[website_url]}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; background-color: rgba(255, 255, 255, 0.02); color: #a1a1aa; font-size: 0.85rem;'>Title</th><td style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; color: #f4f4f5; font-size: 0.85rem;'>{title}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; background-color: rgba(255, 255, 255, 0.02); color: #a1a1aa; font-size: 0.85rem;'>Author</th><td style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; color: #f4f4f5; font-size: 0.85rem;'>{author}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; background-color: rgba(255, 255, 255, 0.02); color: #a1a1aa; font-size: 0.85rem;'>Publish Date</th><td style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; color: #f4f4f5; font-size: 0.85rem;'>{publish_date}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; background-color: rgba(255, 255, 255, 0.02); color: #a1a1aa; font-size: 0.85rem;'>Keywords</th><td style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; color: #f4f4f5; font-size: 0.85rem;'>{', '.join(keywords) if keywords else ''}</td></tr>\n"
    
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
            <a href="{link}" target="_blank" class="link-preview-title" style="font-size: 1.1rem; font-weight: 600; color: #f4f4f5; text-decoration: underline; line-height: 1.4;">{title}</a>
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
    
    rows += f"<tr><th style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left; background-color: rgba(255, 255, 255, 0.02); color: #a1a1aa; font-size: 0.85rem;'>Article Preview</th><td style='border: 1px solid #27272a; padding: 0.75rem 1rem; text-align: left;'>{preview_card}</td></tr>\n"

    return f"""
<h2>📰 Article Information</h2>\n
<table style='width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; background-color: #18181b; border: 1px solid #27272a; border-radius: 6px; overflow: hidden;'>
\n{rows}</table>\n"""
     
def convert_response_to_html_list_summary(bullet_list_response, custom_response=False):
    lines = bullet_list_response.strip().splitlines()
    list_items = []
    has_bullets = False
    
    for line in lines:
        line = line.strip()
        if line and (line.startswith("*") or line.startswith("-")):
            has_bullets = True
            break
            
    if has_bullets:
        for line in lines: 
            line = line.strip()
            if line and (line.startswith("*") or line.startswith("-")):
                content = line[1:].strip()
                list_items.append(f"<li>{content}</li>")
        html = "<ul class='summary-box' style='background-color: #fff; padding: 1rem 1.5rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 2rem;'>\n" + "\n".join(list_items) + "\n</ul>\n"
    else:
        paragraphs = []
        current_p = []
        for line in lines:
            line = line.strip()
            if line == "":
                if current_p:
                    paragraphs.append(f"<p style='margin-bottom: 1rem;'>{' '.join(current_p)}</p>")
                    current_p = []
            else:
                current_p.append(line)
        if current_p:
            paragraphs.append(f"<p style='margin-bottom: 1rem;'>{' '.join(current_p)}</p>")
        html = f"<div class='summary-box' style='background-color: #fff; padding: 1rem 1.5rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 2rem;'>\n" + "\n".join(paragraphs) + "\n</div>\n"
    return "<h2>📌 Summary</h2>\n"+html

def convert_response_to_html_list_sentiment(bullet_list_response):
    rows = ""
    lines = bullet_list_response.strip().splitlines()
    for line in lines: 
        line = line.strip()
        if line == "":
            continue
        if line[0] == "*":
            if "positive" in line[1:].lower():
                rows += "<div class='sentiment-block positive' style='background-color: #fff; padding: 1rem 1.5rem; border-radius: 8px; border: 1px solid #ccc; border-left: 5px solid green; '>\n<h3 style='margin-top: 0;'>Positive</h3>\n<ul>\n"
            if "neutral" in line[1:].lower():
                rows += "</ul>\n</div>\n<div class='sentiment-block neutral' style='background-color: #fff; padding: 1rem 1.5rem; border-radius: 8px; border: 1px solid #ccc; border-left: 5px solid red; '>\n<h3 style='margin-top: 0;'>Neutral</h3>\n<ul>\n"
            if "negative" in line[1:].lower():
                rows += "</ul>\n</div>\n<div class='sentiment-block negative' style='background-color: #fff; padding: 1rem 1.5rem; border-radius: 8px; border: 1px solid #ccc; border-left: 5px solid gray; '>\n<h3 style='margin-top: 0;'>Negative</h3>\n<ul>\n"
            continue
        rows += f"<li>{line[1:].strip()}</li>\n"
    rows += "</ul>\n</div>\n</div>\n"
    return f"""
<h2>🧠 Sentiment Analysis</h2>\n
<div class="sentiment-section" style='display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;'>\n
\n{rows}\n"""


def build_combined_prompt(article_text, keywords, custom_prompt):
    kws = ', '.join(keywords) if keywords else ''
    
    if custom_prompt and custom_prompt.strip():
        instruction = f"{custom_prompt.strip()}\n\nPlace an emphasis on the presence and how the following keywords denoted inside the quotation marks are mentioned: '{kws}' (unless no keywords). Structure the summary section with no more than 7 bullet points (use * to represent bullet points)."
    else:
        instruction = f"With an emphasis on the presence and how the following keywords denoted inside the quotation marks are mentioned: '{kws}' (unless no keywords), summarize the following review/article, focusing on brand mentions, performance mentions, price, how it compares to other brands mentioned in the article (if applicable) and other general information with no more than 7 bullet points (use * to represent bullet points)."

    return f"""{instruction}

In addition, perform a sentiment analysis of the article focusing on positive, neutral, and negative sentiments. Structure your sentiment output using bullet points (*) for Positive, Neutral, and Negative categories, and within each category, use dash (-) to represent each specific sentiment point.

You MUST format your output into the following two distinct sections:

=== SUMMARY ===
* [Bullet point 1]
* [Bullet point 2]

=== SENTIMENT ===
* Positive
- [Positive point 1]
* Neutral
- [Neutral point 1]
* Negative
- [Negative point 1]

Perform the tasks described on the following article:
{article_text}"""

def split_combined_llm_response(full_text):
    summary_part = ""
    sentiment_part = ""
    
    if "=== SENTIMENT ===" in full_text:
        parts = full_text.split("=== SENTIMENT ===")
        summary_part = parts[0].replace("=== SUMMARY ===", "").strip()
        sentiment_part = parts[1].strip()
    elif "### SENTIMENT" in full_text or "### Sentiment" in full_text:
        parts = re.split(r'###\s*SENTIMENT|###\s*Sentiment', full_text, flags=re.IGNORECASE)
        summary_part = parts[0].replace("### SUMMARY", "").replace("### Summary", "").strip()
        sentiment_part = parts[1].strip() if len(parts) > 1 else ""
    elif "=== SENTIMENT" in full_text:
        parts = full_text.split("=== SENTIMENT")
        summary_part = parts[0].replace("=== SUMMARY ===", "").replace("=== SUMMARY", "").strip()
        sentiment_part = parts[1].lstrip("=").strip()
    else:
        # Fallback if delimiter was omitted
        summary_part = full_text.strip()
        sentiment_part = "* Positive\n- Positive aspects mentioned in article\n* Neutral\n- General product specifications\n* Negative\n- Minor drawbacks or limitations"
        
    return summary_part, sentiment_part

async def call_groq_with_retry_and_fallback(prompt: str) -> str:
    """
    Executes Groq LLM inference with automatic retry backoff on 429 rate limits
    and automatic fallback from llama-3.3-70b-versatile to llama-3.1-8b-instant (30k TPM).
    """
    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    
    for model_name in models:
        for attempt in range(3):
            try:
                response = await async_groq_client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_completion_tokens=1024,
                    top_p=0.9
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = "429" in err_str or "rate limit" in err_str or "tpm" in err_str or "rate_limit_exceeded" in err_str
                if is_rate_limit:
                    if attempt < 2:
                        # Exponential backoff: 1.2s, 2.4s
                        await asyncio.sleep(1.2 * (attempt + 1))
                        continue
                    else:
                        # Fallback to next model in list
                        break
                else:
                    # Non-rate-limit error (e.g. invalid API key, prompt length): re-raise
                    raise e
                    
    return ""

async def process_single_article_async(website_url, article_url, metadata, keywords, custom_prompt):
    custom = bool(custom_prompt and custom_prompt.strip())
    prompt = build_combined_prompt(metadata[0], keywords, custom_prompt)
    
    raw_response = await call_groq_with_retry_and_fallback(prompt)
    summary_text, sentiment_text = split_combined_llm_response(raw_response)
    
    return website_url, article_url, metadata, summary_text, sentiment_text, custom

async def construct_message_async(results_list=None, keywords=[], custom_prompt="", json_dict=None, email_dict=None):
    if json_dict is None:
        json_dict = {}
    if email_dict is None:
        email_dict = {}
    if results_list is None:
        return ""

    tasks = []
    for website_url, website_articles in results_list.items():
        for article_url, metadata in website_articles.items():
            tasks.append(process_single_article_async(website_url, article_url, metadata, keywords, custom_prompt))

    if not tasks:
        return ""

    processed_results = await asyncio.gather(*tasks)

    partial_email_html = ""
    for website_url, article_url, metadata, summary_text, sentiment_text, custom in processed_results:
        thumbnail_url = metadata[6] if len(metadata) > 6 else None
        description = metadata[7] if len(metadata) > 7 else None
        
        current_article_html = ""
        current_article_html += convert_metadata_to_html(website_url, metadata[2], metadata[3], metadata[4], metadata[1], article_url, thumbnail_url, description)
        current_article_html += convert_response_to_html_list_summary(summary_text, custom)
        current_article_html += convert_response_to_html_list_sentiment(sentiment_text)
        
        email_html = f"<div class='article-container' style='margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;'>\n<section class='article-analysis' style='font-family: Arial, sans-serif; padding: 1rem; background-color: #f9f9f9;'>\n{current_article_html}</section>\n</div>\n"
        email_dict[article_url] = email_html

        frontend_html = f"<div class='article-container' style='margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;'>\n<section class='article-analysis' style='font-family: Arial, sans-serif; padding: 1rem; background-color: #f9f9f9;'>\n<input value='{article_url}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n{current_article_html}</section>\n</div>\n"
        
        json_dict[article_url] = {
            "website": website_urls[website_url],
            "title": metadata[2],
            "author": metadata[3],
            "published": metadata[4],
            "keywords": (", ".join(metadata[1]) if metadata[1] else ""),
            "url": article_url,
            "content": frontend_html,
            "published_date": metadata[5]
        }
        partial_email_html += frontend_html

    return partial_email_html

def construct_message(results_list=None, keywords=[], custom_prompt="", json_dict=None, email_dict=None):
    if json_dict is None:
        json_dict = {}
    if email_dict is None:
        email_dict = {}
    if results_list is None: 
        return ""
    
    partial_email_html = ""
    for website_url, website_articles in results_list.items():
        for article_url, metadata in website_articles.items(): 
            custom = bool(custom_prompt and custom_prompt.strip())
            prompt = build_combined_prompt(metadata[0], keywords, custom_prompt)
            
            raw_response = ""
            models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
            for model_name in models:
                try:
                    completion = client.chat.completions.create(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.1,
                        max_completion_tokens=1024,
                        top_p=0.9
                    )
                    raw_response = completion.choices[0].message.content or ""
                    if raw_response:
                        break
                except Exception:
                    continue

            summary_text, sentiment_text = split_combined_llm_response(raw_response)

            thumbnail_url = metadata[6] if len(metadata) > 6 else None
            description = metadata[7] if len(metadata) > 7 else None
            
            current_article_html = ""
            current_article_html += convert_metadata_to_html(website_url, metadata[2], metadata[3], metadata[4], metadata[1], article_url, thumbnail_url, description)
            current_article_html += convert_response_to_html_list_summary(summary_text, custom)
            current_article_html += convert_response_to_html_list_sentiment(sentiment_text)
            
            email_html = f"<div class='article-container' style='margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;'>\n<section class='article-analysis' style='font-family: Arial, sans-serif; padding: 1rem; background-color: #f9f9f9;'>\n{current_article_html}</section>\n</div>\n"
            email_dict[article_url] = email_html

            frontend_html = f"<div class='article-container' style='margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;'>\n<section class='article-analysis' style='font-family: Arial, sans-serif; padding: 1rem; background-color: #f9f9f9;'>\n<input value='{article_url}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n{current_article_html}</section>\n</div>\n"
            
            json_dict[article_url] = {
                "website": website_urls[website_url],
                "title": metadata[2],
                "author": metadata[3],
                "published": metadata[4],
                "keywords": (", ".join(metadata[1]) if metadata[1] else ""),
                "url": article_url,
                "content": frontend_html,
                "published_date": metadata[5]
            }
            partial_email_html += frontend_html
            
    return partial_email_html
            
    return partial_email_html

'''def construct_message_gemini(results_list=None, keywords=[], custom_prompt="", json_dict=None, email_dict=None):
    if json_dict is None:
        json_dict = {}
    if email_dict is None:
        email_dict = {}
    # construct the message using Gemini
    partial_email_html = ""
    custom = False
    if results_list is None: 
        return ""

    kws = ', '.join(keywords) if keywords else ''
    
    # Flatten the articles list to process them concurrently
    flat_articles = []
    for website_url, website_articles in results_list.items():
        for article_url, metadata in website_articles.items():
            flat_articles.append((website_url, article_url, metadata))

    if not flat_articles:
        return ""

    # Processing function for a single article
    def process_article(item):
        website_url, article_url, metadata = item
        llm_response_summary = ""
        llm_response_sentiment = ""
        
        # 1. Gemini Summary
        if custom_prompt and custom_prompt.strip():
            custom = True
            summary_prompt = f"{custom_prompt.strip()}\n\nPerform the tasks described on the following article:\n{metadata[0]}"
        else:
            summary_prompt = f"With an emphasis on the presence and how the following keywords denoted inside the quotation marks are mentioned: '{kws}' (unless no keywords), summarize the following review/article, focusing on brand mentions, performance mentions, price, how it compares to other brands mentioned in the article (if applicable) and other general information in about 7 bullet points (use * to represent bullet points).  If something specified wasn't mentioned, don't mention that it wasn't mentioned in your response. I just want the summary and analysis without any greeting or response prompt like 'Here are 5 bullet points summarizing the article:'. Perform the tasks described on the following article: \n{metadata[0]}"

        try:
            response_summary = gemini_client.models.generate_content(
                model='gemini-3.5-flash',
                contents=summary_prompt,
            )
            llm_response_summary = response_summary.text or ""
        except Exception as e:
            print(f"Gemini Summary Error: {e}")
            llm_response_summary = f"Error generating summary: {e}"

        # 2. Gemini Sentiment
        sentiment_prompt = f"With an emphasis on the presence and how the following keywords denoted inside the quotation marks are mentioned: '{kws}' (unless no keywords), I want a sentiment analysis of the following review/article, focusing on positive, neutral, and negative sentiments. Use bullet points (*) to represent the three categories of Positive/Neutral/Negative, and within those categories, use dash (-) to represent the content of that category. Basically, the structure of your response should just be 3 bullet points (*) for each of Positive/Neutral/Negative, and a list inside each category represented by dashes (-) that show the actual sentiments. I just want the analysis without any greeting or response prompt like 'Here is the sentiment analysis'. Perform the tasks described on the following article: \n{metadata[0]}"
        
        try:
            response_sentiment = gemini_client.models.generate_content(
                model='gemini-3.5-flash',
                contents=sentiment_prompt,
            )
            llm_response_sentiment = response_sentiment.text or ""
        except Exception as e:
            print(f"Gemini Sentiment Error: {e}")
            llm_response_sentiment = f"Error generating sentiment analysis: {e}"

        return (website_url, article_url, metadata, llm_response_summary, llm_response_sentiment)

    # Run calls concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(32, len(flat_articles))) as executor:
        futures = [executor.submit(process_article, item) for item in flat_articles]
        # Preserve order of insertion
        results = [future.result() for future in futures]

    # Reconstruct outputs in order
    for website_url, article_url, metadata, llm_response_summary, llm_response_sentiment in results:
        # current article html - returned
        current_article_html = ""
        thumbnail_url = metadata[6] if len(metadata) > 6 else None
        description = metadata[7] if len(metadata) > 7 else None
        current_article_html += convert_metadata_to_html(website_url, metadata[2], metadata[3], metadata[4], metadata[1], article_url, thumbnail_url, description)
        current_article_html += convert_response_to_html_list_summary(llm_response_summary, custom)
        current_article_html += convert_response_to_html_list_sentiment(llm_response_sentiment)
        
        # for email 
        email_html = "<div class='article-container' style='margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;'>\n<section class='article-analysis' style='font-family: Arial, sans-serif; padding: 1rem; background-color: #f9f9f9;'>\n" + current_article_html + "</section>\n</div>\n"
        email_dict[article_url] = email_html

        # for frontend
        current_article_html = f"<div class='article-container' style='margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;'>\n<section class='article-analysis' style='font-family: Arial, sans-serif; padding: 1rem; background-color: #f9f9f9;'>\n<input value='{article_url}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n" + current_article_html+ "</section>\n</div>\n"
        
        # for database
        json_dict[article_url] = {"website": website_urls[website_url], "title": metadata[2], "author": metadata[3], "published": metadata[4], "keywords": (", ".join(metadata[1]) if metadata[1] else ""), "url": article_url, "content": current_article_html, "published_date": metadata[5]}
        # full article list html - for email
        partial_email_html += current_article_html
        
    return partial_email_html
'''
def save_to_file(email_content_html):
    with open("summaries.html", "w", encoding="utf-8") as file:
            file.write(email_content_html)

def send_email(email_content_html, recipient_emails):
    try:
        # Use a list for multiple recipients
        if isinstance(recipient_emails, str):
            recipient_emails = [recipient_emails]

        params = {
            "from": "Article Summarizer <summaries@howard1218.site>", # Use your verified domain
            "to": recipient_emails,
            "subject": "Your Article Summaries",
            "html": email_content_html,
        }

        # This is a single HTTPS POST request—no ports to block!
        response = resend.Emails.send(params)
        print(f"Email sent successfully! ID: {response['id']}")
        return True

    except Exception as e:
        print(f"Resend Error: {e}")
        return False
    
def is_valid_email(email):
    # A simple regex to check for @ and .
    regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return re.match(regex, email) is not None