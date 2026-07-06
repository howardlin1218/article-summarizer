import resend
import os 
from dotenv import load_dotenv
from groq import Groq
import re

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
resend.api_key = os.getenv("RESEND_APIKEY")
client = Groq(api_key=api_key)
SEPARATOR = ""

results_list = None
email_content = ""
partial_email_html = ""
final_content_html = []
json_dict = {}
email_dict = {}
keywords = ""
website_urls = {"https://www.tomshardware.com/search": "Tom's Hardware",
                "https://www.pcmag.com/search/results": "PC Mag",
                "https://thepcenthusiast.com/": "The PC Enthusiast",
                "https://hothardware.com/search": "Hot Hardware",
                "https://pcper.com/": "PC Perspective",
                "https://gamerant.com/search": "GameRant",
                "https://www.windowscentral.com/search": "Windows Central",
                "https://www.techradar.com/search": "Tech Radar"
                }

def convert_metadata_to_html(website_url, title, author, publish_date, keywords, link):
    rows = ""
    rows += f"<tr><th style='border: 1px solid #ccc; padding: 0.75rem; text-align: left; background-color: #f0f0f0;'>Website</th><td style='border: 1px solid #ccc; padding: 0.75rem; text-align: left;'>{website_urls[website_url]}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #ccc; padding: 0.75rem; text-align: left; background-color: #f0f0f0;'>Title</th><td style='border: 1px solid #ccc; padding: 0.75rem; text-align: left;'>{title}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #ccc; padding: 0.75rem; text-align: left; background-color: #f0f0f0;'>Author</th><td style='border: 1px solid #ccc; padding: 0.75rem; text-align: left;'>{author}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #ccc; padding: 0.75rem; text-align: left; background-color: #f0f0f0;'>Publish Date</th><td style='border: 1px solid #ccc; padding: 0.75rem; text-align: left;'>{publish_date}</td></tr>\n"
    rows += f"<tr><th style='border: 1px solid #ccc; padding: 0.75rem; text-align: left; background-color: #f0f0f0;'>Keywords</th><td style='border: 1px solid #ccc; padding: 0.75rem; text-align: left;'>{', '.join(keywords) if keywords else ''}</td></tr>\n"
    link = f'<a href="{link}" target="_blank">{link}</a>'
    rows += f"<tr><th style='border: 1px solid #ccc; padding: 0.75rem; text-align: left; background-color: #f0f0f0;'>Article Link</th><td style='border: 1px solid #ccc; padding: 0.75rem; text-align: left;'>{link}</td></tr>\n"

    return f"""
<h2>📰 Article Information</h2>\n
<table style='width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; background-color: #fff;'>
\n{rows}</table>\n"""
     
def convert_response_to_html_list_summary(bullet_list_response):
    lines = bullet_list_response.strip().splitlines()
    list_items = []
    for line in lines: 
        line = line.strip()
        if line[0] == "*":
            content = line[1:].strip()
            list_items.append(f"<li>{content}</li>")
    html = "<ul style='background-color: #fff; padding: 1rem 1.5rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 2rem;'>\n" + "\n".join(list_items) + "\n</ul>\n"
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

def construct_message(email_content=email_content, results_list=results_list, keywords=[]):
    # construct the message 
    partial_email_html = ""
    if results_list is None: 
        return ""
    kws = ', '.join(keywords) if keywords else ''
    for website_url, website_articles in results_list.items():
        for article_url, metadata in website_articles.items(): 
            llm_response_summary = ""
            llm_response_sentiment = ""
            completion_summary = client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                {
                    "role": "user",
                    "content": f"With an emphasis on the presence and how the following keywords denoted inside the quotation marks are mentioned: '{kws}' (unless no keywords), summarize the following review/article, focusing on brand mentions, performance mentions, price, how it compares to other brands mentioned in the article (if applicable) and other general information in about 7 bullet points (use * to represent bullet points).  If something specified wasn't mentioned, don't mention that it wasn't mentioned in your response. I just want the summary and analysis without any greeting or response prompt like 'Here are 5 bullet points summarizing the article:'. Perform the tasks described on the following article: \n{metadata[0]}" 
                }
                ],
                temperature=0.1,
                max_completion_tokens=1024,
                top_p=0.9,
                stream=True,
                stop=None
            )
            
            for chunk in completion_summary:
                llm_response_summary += chunk.choices[0].delta.content or ""
                email_content += chunk.choices[0].delta.content or ""

            completion_analysis = client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                {
                    "role": "user",
                    "content": f"With an emphasis on the presence and how the following keywords denoted inside the quotation marks are mentioned: '{kws}' (unless no keywords), I want a sentiment analysis of the following review/article, focusing on positive, neutral, and negative sentiments. Use bullet points (*) to represent the three categories of Positive/Neutral/Negative, and within those categories, use dash (-) to represent the content of that category. Basically, the structure of your response should just be 3 bullet points (*) for each of Positive/Neutral/Negative, and a list inside each category represented by dashes (-) that show the actual sentiments. I just want the analysis without any greeting or response prompt like 'Here is the sentiment analysis'. Perform the tasks described on the following article: \n{metadata[0]}" 
                }
                ],
                temperature=0.1,
                max_completion_tokens=1024,
                top_p=0.9,
                stream=True,
                stop=None
            )

            for chunk in completion_analysis:
                llm_response_sentiment += chunk.choices[0].delta.content or ""

            # current article html - returned
            current_article_html = ""
            current_article_html += convert_metadata_to_html(website_url, metadata[2], metadata[3], metadata[4], metadata[1], article_url)
            current_article_html += convert_response_to_html_list_summary(llm_response_summary)
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