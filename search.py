import requests 
from bs4 import BeautifulSoup
from urllib.parse import urljoin

from collections import defaultdict

import re

from datetime import datetime
from zoneinfo import ZoneInfo
import base64

def extract_link_preview_metadata(soup, url):
    """
    Extracts thumbnail URL and description from the article's BeautifulSoup object.
    """
    thumbnail_url = None
    description = None

    # 1. Try og:image
    og_image = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
    if og_image and og_image.get("content"):
        thumbnail_url = og_image["content"]

    # 2. Try twitter:image
    if not thumbnail_url:
        twitter_image = soup.find("meta", attrs={"name": "twitter:image"}) or soup.find("meta", attrs={"property": "twitter:image"})
        if twitter_image and twitter_image.get("content"):
            thumbnail_url = twitter_image["content"]

    # 3. Handle relative image URLs
    if thumbnail_url:
        thumbnail_url = urljoin(url, thumbnail_url)

    # 4. Try og:description
    og_desc = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "og:description"})
    if og_desc and og_desc.get("content"):
        description = og_desc["content"]

    # 5. Try meta description
    if not description:
        meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "description"})
        if meta_desc and meta_desc.get("content"):
            description = meta_desc["content"]

    if description:
        description = description.strip()
        if len(description) > 200:
            description = description[:197] + "..."

    return thumbnail_url, description

pacific_tz = ZoneInfo("America/Los_Angeles")

now = datetime.now(pacific_tz)
year = now.year 
month = now.month
day = now.day

# list of websites to search from 
website_urls = [
    "https://www.tomshardware.com/search",
    "https://www.pcmag.com/search/results",
    "https://thepcenthusiast.com/",
    "https://hothardware.com/search",
    "https://pcper.com/",
    "https://gamerant.com/search",
    "https://www.windowscentral.com/search",
    "https://www.techradar.com/search"
]

# search terms 
search_terms = [
    "Desktop", 
    "Gaming Desktop",
    "Pro Desktop"
]

key_words_gaming = [
    "MSI",
    "iBUYPOWER",
    "ASUS", 
    "ACER", 
    "HP", 
    "CYBERPOWER", 
    "ALIENWARE",
    "Gigabyte", 
    "Vision", 
    "Aegis", 
    "Infinite", 
    "Razer"
]

key_words_pro = [
    "MSI",
    "Gigabyte", 
    "BRIX", 
    "Minisforum", 
    "Beelink", 
    "Zotac Zbox", 
    "Apple Mac Mini", 
    "HP Elite Mini", 
    "Cubi", 
    "Pro", 
    "Microsoft Surface",
    "Apple", 
    "Macbook"
]

months = {
    "january" : 1, 
    "jan": 1,
    "february": 2, 
    "feb": 2,
    "march": 3,
    "mar": 3, 
    "april": 4,
    "apr": 4, 
    "may": 5, 
    "june": 6,
    "jun": 6, 
    "july": 7,
    "jul": 7, 
    "august": 8,
    "aug": 8, 
    "september": 9,
    "sep": 9, 
    "october": 10,
    "oct": 10, 
    "november": 11,
    "nov": 11, 
    "december": 12,
    "dec": 12
}

headers = {"User-Agent": "Chrome/114.0.0.0 Safari/537.36"}

# pattern = ""
# kws = []
# def keywords_pattern(keywords):
#     if len(keywords) == 0:
#         return ""
#     pattern = r'\b(' + '|'.join(re.escape(k) for k in keywords) + r')\b'
#     return pattern

#pattern = [pattern_gaming, pattern_pro]

# parse dates
splitter = re.compile(r"[ /,]+")

def parse_to_datetime(element):
    """
    Decodes Base64 if present, otherwise uses text, 
    then converts to a comparable datetime object.
    """
    if not element:
        return None, 'unknown'

    # 1. Prioritize the Base64 attribute
    raw_str = ""
    if element.has_attr("data-b64-ts"):
        try:
            b64_data = element["data-b64-ts"]
            raw_str = base64.b64decode(b64_data).decode("utf-8").lower().strip()
        except Exception:
            raw_str = element.get_text(strip=True).lower()
    else:
        raw_str = element.get_text(strip=True).lower()

    if not raw_str:
        return None, 'unknown'

    # 2. Handle "ago" logic (always included in range)
    if 'ago' in raw_str:
        return datetime.now(ZoneInfo("America/Los_Angeles")), raw_str
    
    # 3. Handle specific date formats
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            dt_obj = datetime.strptime(raw_str, fmt)
            return dt_obj.replace(tzinfo=pacific_tz), raw_str
        except ValueError:
            continue
            
    return None, 'unknown'
    
def match_keywords(article_text, kws):
    if not kws:
        return ["no keywords"]
    
    found = []
    for k in kws: 
        if re.search(rf"\b{re.escape(k)}\b", article_text, flags=re.IGNORECASE):
            found.append(k)
        else: 
            return []
    return found

def is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
    """
    Validates if (m_year, m_month, m_day) falls within [date_from, date_to] using Python tuple comparison.
    """
    article_date = (m_year, m_month, m_day)
    start_date = (year_from, month_from, day_from)
    
    if start_date != (0, 0, 0) and article_date < start_date:
        return False
        
    if (year_to, month_to, day_to) != (0, 0, 0):
        end_date = (year_to, month_to, day_to)
        if article_date > end_date:
            return False
            
    return True

def search_toms_hardware(website_url=website_urls[0], search_terms=search_terms, article_limit=1, word_limit=500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]): 
    matched_article_metadata = defaultdict(list)
    for term in range(len(search_terms)):
        i = 0
        params = {"searchTerm": search_terms[term],
                  "articleType": "all",
                  "sortBy": "relevance"
                  }

        response = requests.get(website_url, params=params, headers=headers)
        # print(search_terms[term])
        # print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # get all the articles in one container
            results_container = soup.find("div", class_="listingResults")
            if results_container is None: 
                #print(f"No results for {search_terms[term]}\n")
                continue

            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("div", class_="listingResult")
            if not articles: 
                print(f"No results for {search_terms[term]}\n")
                continue

            at_least_one_article = False
            for article in articles:
                m_day = day
                m_month = month
                m_year = year

                if i < article_limit:
                    current_article_text = ""
                    author = article.find("span", style ="white-space:nowrap").get_text(strip=True)
                    a_tag = article.find("a", class_="article-link")
                    link = a_tag.get("href")
                    title = a_tag.get("aria-label")
                    publish_date = article.find("time", class_="date-with-prefix").get_text(strip=True)
                    parsed_date = splitter.split(publish_date)

                    if parsed_date[-1] != 'ago': 
                        m_day = int(parsed_date[0])
                        m_month = months[parsed_date[1].lower()]
                        raw_year = parsed_date[-1]
                        m_year = int(raw_year) if len(raw_year) == 4 else int("20" + raw_year)
                        if not is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
                            continue
                    
                    response = requests.get(link, headers=headers)
                    # print(link)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        article_body = opened_article.find("div", id="article-body") or opened_article.find("article") or opened_article
                        article_paragraphs = article_body.find_all("p")
                        for article_paragraph in article_paragraphs:
                            current_article_text += (article_paragraph.get_text(strip=True) + ' ')
                        # print(len(current_article_text.lower().split()))
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{m_year}-{m_month:02}-{m_day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text, 
                                                              matched, 
                                                              title, 
                                                              author, 
                                                              publish_date,
                                                              publish_date_formatted,
                                                              thumbnail_url,
                                                              description]
                            i += 1
                            at_least_one_article = True
                    else:
                        #print(f"link: {link} did not work. (status code: {response.status_code})")
                        pass
                else:
                    # print(f"Limit reached, {article_limit} articles displayed.\n")
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
            pass
    return matched_article_metadata
    
    # search through each article on the page and match keywords (DONE)
    # if an article matches keywords (desktop, pro desktop, gaming desktop, MSI, ASUS, Cyberpower, etc.), summarize using LLM api (LLM to be chosen) (DONE)
    # after summarizing, do sentiment analysis on the article and provide bullet points of positive, neutral, and negative 
    # figure out how to send these as notifications to emails, and how to save to database for future reference 
    # allow user lookup in the database 

def search_pc_mag(website_url=website_urls[1], search_terms=search_terms, article_limit=1, word_limit=500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]):
    matched_article_metadata = {}
    for term in range(len(search_terms)):
        i = 0
        params = {"query": search_terms[term]}

        response = requests.get(website_url, params=params, headers=headers)
        #print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # get all the articles in one container
            results_container = soup.find("div", class_="flex flex-col gap-4")
            if results_container is None: 
                print(f"PC Mag No results for {search_terms[term]}\n")
                continue

            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("div", class_="dark:border-gray-600")
            if not articles: 
                print(f"PC Mag No results for {search_terms[term]}\n")
                continue

           #print("Searching articles and matching keywords...\n")
            at_least_one_article = False
            for article in articles:  
                m_day = day
                m_month = month
                m_year = year
                if i < article_limit:
                    # get the link tag <a>
                    a_tag = article.find("a", attrs={"x-track-ga-click": True})
                    link = "https://www.pcmag.com/"+a_tag.get("href")
                    title = a_tag.get_text(strip=True)
                    publish_date = article.find("span", attrs={"data-content-published-date": True}).get_text(strip=True)
                    parsed_date = splitter.split(publish_date)
                    if parsed_date[-1] != 'ago': 
                        m_day = int(parsed_date[1])
                        m_month = int(parsed_date[0])
                        m_year = int(parsed_date[-1])
                        if not is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
                            continue
                    # synopsis = article.find("p", class_="line-clamp-2").get_text(strip=True)
                    author = article.find_all("a",  attrs={"data-element": "author-name"})
                    author_names = []
                    for a in author: 
                        author_names.append(a.get_text(strip=True))
                    
                    if len(author_names) > 1:
                        author = ", ".join(author_names)
                    elif len(author_names) == 1:
                        author = "".join(author_names)

                    current_article_text = ""
                    response = requests.get(link, headers=headers)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        article_body = opened_article.find("article")
                        if article_body is None: 
                            print(f"Article is empty at Link: {link}")
                            continue
                        article_paragraphs = article_body.find_all("p")
                        for article_paragraph in article_paragraphs:
                            current_article_text += (article_paragraph.get_text(strip=True) + ' ')
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{m_year}-{m_month:02}-{m_day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text, 
                                                            matched, 
                                                            title,
                                                            author,
                                                            publish_date,
                                                            publish_date_formatted,
                                                            thumbnail_url,
                                                            description]
                            i += 1
                            at_least_one_article = True
                    else:
                        print(f"link: {link} did not work. (status code: {response.status_code})")
                else:
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
            pass
    return matched_article_metadata

def search_the_pc_enthusiast(website_url=website_urls[2], search_terms=search_terms, article_limit=1, word_limit=500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]):
    matched_article_metadata = {}
    for term in range(len(search_terms)):
        i = 0
        params = {"s": search_terms[term]}

        response = requests.get(website_url, params=params, headers=headers)
        #print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # get all the articles in one container
            results_container = soup.find("main", class_="site-main")
            no_content = results_container.find("div", class_="no-results")
            if no_content is not None: 
                print(f"PC E No results for {search_terms[term]}\n")
                continue

            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("article") or results_container.find_all("div", class_="inside-article")
            if not articles: 
                print(f"PC E No results for {search_terms[term]}\n")
                continue
            
            at_least_one_article = False
            for article in articles:
                m_day = day
                m_month = month
                m_year = year
                if i < article_limit:  
                    # get the link tag <a>
                    author_elem = article.find("span", class_="author-name") or article.find("span", class_="author") or article.find("a", rel="author")
                    author = author_elem.get_text(strip=True) if author_elem else "Staff"
                    a_tag = article.find("a", rel="bookmark") or article.find("h2").find("a") if article.find("h2") else article.find("a")
                    link = a_tag.get("href")
                    title = a_tag.get_text(strip=True)
                    time_elem = article.find("time", class_="published") or article.find("time")
                    publish_date = time_elem.get_text(strip=True) if time_elem else "Jan 1, 2025"
                    raw_tokens = splitter.split(publish_date)
                    parsed_date = [p for p in raw_tokens if p.lower().rstrip(',') not in ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']]

                    if parsed_date[-1] != 'ago': 
                        m_day = int(parsed_date[1])
                        m_month = months[parsed_date[0].lower()]
                        m_year = int(parsed_date[-1])
                        if not is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
                            continue
                    current_article_text = ""
                    response = requests.get(link, headers=headers)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        article_body = opened_article.find("div", class_="entry-content")
                        if article_body is None: 
                            print(f"Article is empty at Link: {link}")
                            continue
                        article_paragraphs = article_body.find_all("p", class_=False, id=False)
                        for article_paragraph in article_paragraphs:
                            current_article_text += (article_paragraph.get_text(strip=True) + ' ')
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{m_year}-{m_month:02}-{m_day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text,
                                                        matched,
                                                        title,
                                                        author,
                                                        publish_date,
                                                        publish_date_formatted,
                                                        thumbnail_url,
                                                        description]
                            i += 1
                            at_least_one_article = True
                    else:
                        print(f"link: {link} did not work. (status code: {response.status_code})")
                else:
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
    return matched_article_metadata

def search_hothardware(website_url=website_urls[3], search_terms=search_terms, article_limit=1, word_limit=500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]):
    matched_article_metadata = {}
    for term in range(len(search_terms)):
        i = 0
        params = {"a": "all",
                  "s": search_terms[term]}

        response = requests.get(website_url, params=params, headers=headers)
        #print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # get all the articles in one container
            results_container = soup.find("div", class_="content-list")
            if results_container is None: 
                print(f"No results for {search_terms[term]}")
                continue

            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("div", class_="cl-item")
            if not articles: 
                print(f"No results for {search_terms[term]}\n")
                continue
            #print("Searching articles and matching keywords...\n")
            at_least_one_article = False
            for article in articles:  
                m_day = day
                m_month = month
                m_year = year
                if i < article_limit:
                    author = article.find("div", class_="cli-byline").get_text(strip=True).split('-')[0].strip()[3:]
                    title_link_tag = article.find("a", class_="black p-name u-url")
                    link = "https://hothardware.com" + title_link_tag.get("href")
                    title = title_link_tag.get_text(strip=True)
                    publish_date = article.find("div", class_="cli-byline").get_text(strip=True).split('-')[-1].strip()
                    raw_tokens = splitter.split(publish_date)
                    parsed_date = [p for p in raw_tokens if p.lower().rstrip(',') not in ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']]
                    if parsed_date and parsed_date[-1] != 'ago': 
                        m_month = months[parsed_date[0].lower()]
                        m_day = int(parsed_date[1])
                        m_year = int(parsed_date[2])
                        if not is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
                            continue
                    current_article_text = ""
                    response = requests.get(link, headers=headers)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        current_article_text = opened_article.find("div", class_="cn-body e-content").get_text(strip=True)
                        if current_article_text is None: 
                            print(f"Article is empty at Link: {link}")
                            continue
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{m_year}-{m_month:02}-{m_day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text, 
                                                        matched, 
                                                        title, 
                                                        author, 
                                                        publish_date,
                                                        publish_date_formatted,
                                                        thumbnail_url,
                                                        description]
                            i += 1
                            at_least_one_article = True
                    else:
                        print(f"link: {link} did not work. (status code: {response.status_code})")
                else:
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
    return matched_article_metadata

def search_pc_perspective(website_url=website_urls[4], search_terms=search_terms, article_limit=1, word_limit = 500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]):
    matched_article_metadata = {}
    for term in range(len(search_terms)):
        i = 0
        params = {"s": search_terms[term]}

        response = requests.get(website_url, params=params, headers=headers)
        #print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # get all the articles in one container
            results_container = soup.find("div", class_="paginated_content")
            if results_container is None: 
                print(f"No results for {search_terms[term]}")
                continue

            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("article", class_="hentry")
            if not articles: 
                print(f"No results for {search_terms[term]}\n")
                continue
            #print("Searching articles and matching keywords...\n")
            at_least_one_article = False
            for article in articles:  
                m_day = day
                m_month = month
                m_year = year
                if i < article_limit:
                    # get the link tag <a>
                    author = article.find("a", rel="author").get_text(strip=True)
                    a_tag = article.find("a", class_="et-accent-color")
                    link = a_tag.get("href")
                    title = a_tag.get_text(strip=True)
                    publish_date = article.find("span", class_="updated").get_text(strip=True)
                    parsed_date = splitter.split(publish_date)
                    if parsed_date[-1] != 'ago': 
                        m_day = int(parsed_date[1])
                        m_month = months[parsed_date[0].lower()]
                        m_year = int(parsed_date[-1])
                        if not is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
                            continue

                    current_article_text = ""
                    response = requests.get(link, headers=headers)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        article_body = opened_article.find("div", class_="et-l et-l--post")
                        if article_body is None: 
                            print(f"Article is empty at Link: {link}")
                            continue
                        article_paragraphs = article_body.find_all("p", class_=False, id=False)
                        for article_paragraph in article_paragraphs:
                            current_article_text += (article_paragraph.get_text(strip=True) + ' ')
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{m_year}-{m_month:02}-{m_day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text, 
                                                        matched, 
                                                        title, 
                                                        author, 
                                                        publish_date,
                                                        publish_date_formatted,
                                                        thumbnail_url,
                                                        description]
                            i += 1
                            at_least_one_article = True
                    else:
                        print(f"link: {link} did not work. (status code: {response.status_code})")
                else:
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
    return matched_article_metadata

def search_gamerant(website_url=website_urls[5], search_terms=search_terms, article_limit=1, word_limit=500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]):
    matched_article_metadata = {}
    for term in range(len(search_terms)):
        i = 0
        params = {"q": search_terms[term]}

        response = requests.get(website_url, params=params, headers=headers)
        # print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            # print("successful search")
            # get all the articles in one container
            results_container = soup.find("section", class_="listing-content")
            if results_container is None: 
                print(f"GR Results No results for {search_terms[term]}")
                continue
            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("div", class_="article")
            if not articles: 
                print(f"GR Articles No results for {search_terms[term]}\n")
                continue
            # print(articles)
            at_least_one_article = False
            
            for article in articles:  
                # m_day = day
                # m_month = month
                # m_year = year
                
                start_date = datetime(year_from, month_from, day_from, tzinfo=pacific_tz)
                end_date = datetime(year_to, month_to, day_to, 23, 59, 59, tzinfo=pacific_tz)
                
                # print(f"i: {i}, article limit: {article_limit}, articles: {len(articles)}, i < article_limit: {i < article_limit}")
                
                if i < article_limit:
                    # get the title & link
                    title_tag = article.find("h5") or article.find("h3") or article.find("h2") or article.find("h4")
                    title_a = title_tag.find("a") if title_tag else (article.find("a", class_="dc-title-link") or article.find("a", class_="dc-img-link"))
                    if title_a:
                        title = title_a.get_text(strip=True) or title_a.get("title", "").strip()
                        href = title_a.get("href", "")
                        link = urljoin("https://gamerant.com", href)
                    else:
                        title = title_tag.get_text(strip=True) if title_tag else "GameRant Article"
                        a_tag = article.find("a", href=True)
                        link = urljoin("https://gamerant.com", a_tag.get("href", "")) if a_tag else ""
                    
                    author_tag = article.find("a", class_="article-author") or article.find("a", rel="author") or article.find("span", class_="author")
                    author = author_tag.get_text(strip=True) if author_tag else "GameRant Staff"
                    
                    # publish_date = article.find("span", class_="display-card-date").get_text(strip=True)
                    # parsed_date = splitter.split(publish_date)
                    
                    date_element = article.find("span", class_="display-card-date")
                    article_dt, publish_date = parse_to_datetime(date_element)
                    if article_dt:
                        # Range check (start_date and end_date defined earlier)
                        if not (start_date <= article_dt <= end_date):
                            # print(f"start_date: {start_date}, article_dt: {article_dt}, end_date: {end_date}")
                            continue
                    
                    # if parsed_date[-1] != 'ago': 
                    #     if int(parsed_date[-1]) < year_from:
                    #         continue
                    #     if int(parsed_date[-1]) == year_from:
                    #         if months[parsed_date[0].lower()] < month_from:
                    #             continue
                    #     if int(parsed_date[-1]) == year_from:
                    #         if months[parsed_date[0].lower()] == month_from:
                    #             if int(parsed_date[1]) < day_from:
                    #                 continue

                    # if parsed_date[-1] != 'ago': 
                    #     if int(parsed_date[-1]) > year_to and year_to != 0:
                    #         continue
                    #     if int(parsed_date[-1]) == year_to:
                    #         if months[parsed_date[0].lower()] > month_to and month_to != 0:
                    #             continue
                    #     if int(parsed_date[-1]) == year_to:
                    #         if months[parsed_date[0].lower()] == month_to:
                    #             if int(parsed_date[1]) > day_to and day_to != 0:
                    #                 continue
                    #     m_day = int(parsed_date[1])
                    #     m_month = months[parsed_date[0].lower()]
                    #     m_year = int(parsed_date[-1])

                    current_article_text = ""
                    response = requests.get(link, headers=headers)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        article_body = opened_article.find("div", class_="content-block-regular")
                        if article_body is None: 
                            print(f"Article is empty at Link: {link}")
                            continue
                        article_paragraphs = article_body.find_all("p", class_=False, id=False)
                        for article_paragraph in article_paragraphs:
                            current_article_text += (article_paragraph.get_text(strip=True) + ' ')
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{article_dt.year}-{article_dt.month:02}-{article_dt.day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text, 
                                                        matched, 
                                                        title, 
                                                        author, 
                                                        publish_date,
                                                        publish_date_formatted,
                                                        thumbnail_url,
                                                        description]
                            i += 1
                            at_least_one_article = True
                    else:
                        print(f"link: {link} did not work. (status code: {response.status_code})")
                else:
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
    return matched_article_metadata

def search_windows_central(website_url=website_urls[6], search_terms=search_terms, article_limit=1, word_limit=500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]):
    matched_article_metadata = {}
    for term in range(len(search_terms)):
        i = 0
        params = {"searchTerm": search_terms[term],
                  "dateRange": "DATE_RANGE_12_MONTHS"}

        response = requests.get(website_url, params=params, headers=headers)
        #print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # get all the articles in one container
            results_container = soup.find("div", class_="listingResults")
            if results_container is None: 
                print(f"No results for {search_terms[term]}")
                continue

            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("div", class_="listingResult")
            if not articles: 
                print(f"No results for {search_terms[term]}\n")
                continue
            
            at_least_one_article = False
            for article in articles:  
                m_day = day
                m_month = month
                m_year = year
                if i < article_limit:
                # get the link tag <a>
                    author = article.find("span", style="white-space:nowrap").get_text(strip=True)
                    link = article.find("a", class_="article-link").get("href")
                    title = article.find("h3", class_="article-name").get_text(strip=True)
                    publish_date = article.find("time", class_="no-wrap relative-date date-with-prefix").get_text(strip=True)
                    parsed_date = splitter.split(publish_date)

                    if parsed_date[-1] != 'ago': 
                        m_day = int(parsed_date[0])
                        m_month = months[parsed_date[1].lower()]
                        raw_year = parsed_date[-1]
                        m_year = int(raw_year) if len(raw_year) == 4 else int("20" + raw_year)
                        if not is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
                            continue

                    current_article_text = ""   
                    response = requests.get(link, headers=headers)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        article_body = opened_article.find("div", id="article-body")
                        if article_body is None: 
                            print(f"Article is empty at Link: {link}")
                            continue
                        article_paragraphs = article_body.find_all("p", class_=False, id=False)
                        for article_paragraph in article_paragraphs:
                            current_article_text += (article_paragraph.get_text(strip=True) + ' ')
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{m_year}-{m_month:02}-{m_day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text, 
                                                        matched, 
                                                        title, 
                                                        author, 
                                                        publish_date,
                                                        publish_date_formatted,
                                                        thumbnail_url,
                                                        description]
                            i += 1
                            at_least_one_article = True
                    else:
                        print(f"link: {link} did not work. (status code: {response.status_code})")
                else:
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
    return matched_article_metadata

def search_tech_radar(website_url=website_urls[7], search_terms=search_terms, article_limit=1, word_limit=500, year_from=year, month_from=month, day_from=day, year_to=year, month_to=month, day_to=day, keywords=[]):
    matched_article_metadata = {}
    for term in range(len(search_terms)):
        i = 0
        params = {"searchTerm": search_terms[term]}

        response = requests.get(website_url, params=params, headers=headers)
        #print("Search URL:", response.url)
    
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # get all the articles in one container
            results_container = soup.find("div", class_="listingResults")
            if results_container is None: 
                print(f"No results for {search_terms[term]}")
                continue

            # separate the individual articles from the container and store in new container
            articles = results_container.find_all("div", class_="listingResult")
            if not articles: 
                print(f"No results for {search_terms[term]}\n")
                continue

            at_least_one_article = False
            for article in articles:  
                m_day = day
                m_month = month
                m_year = year
                if i < article_limit:
                    # get the link tag <a>
                    author = article.find("span", style="white-space:nowrap").get_text(strip=True)
                    link = article.find("a", class_="article-link").get("href")
                    title = article.find("h3", class_="article-name").get_text(strip=True)
                    publish_date = article.find("time", class_="no-wrap relative-date date-with-prefix").get_text(strip=True)
                    parsed_date = splitter.split(publish_date)

                    if parsed_date[-1] != 'ago': 
                        m_day = int(parsed_date[0])
                        m_month = months[parsed_date[1].lower()]
                        raw_year = parsed_date[-1]
                        m_year = int(raw_year) if len(raw_year) == 4 else int("20" + raw_year)
                        if not is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to):
                            continue
                    current_article_text = ""
                    response = requests.get(link, headers=headers)
                    if response.status_code == 200:
                        opened_article = BeautifulSoup(response.text, "html.parser")
                        article_body = opened_article.find("div", id="article-body") or opened_article.find("article") or opened_article
                        article_paragraphs = article_body.find_all("p")
                        for article_paragraph in article_paragraphs:
                            current_article_text += (article_paragraph.get_text(strip=True) + ' ')
                        if len(current_article_text) > (word_limit * 6) or len(current_article_text.split()) > word_limit:
                            continue
                        matched = match_keywords(current_article_text, keywords)
                        if len(matched) != 0:
                            publish_date_formatted = f"{m_year}-{m_month:02}-{m_day:02}"
                            thumbnail_url, description = extract_link_preview_metadata(opened_article, link)
                            matched_article_metadata[link] = [current_article_text, 
                                                        matched, 
                                                        title, 
                                                        author, 
                                                        publish_date,
                                                        publish_date_formatted,
                                                        thumbnail_url,
                                                        description]
                            i += 1
                            at_least_one_article = True
                    else:
                        print(f"link: {link} did not work. (status code: {response.status_code})")
                else:
                    break
            if not at_least_one_article:
                #print(f"No articles found within {word_limit} word limit.\n")
                pass
        else:
            print(f"Failed to fetch results for {search_terms[term]} (status code: {response.status_code})")
    return matched_article_metadata

search_functions = [search_toms_hardware, 
                    search_pc_mag, 
                    search_the_pc_enthusiast, 
                    search_hothardware, 
                    search_pc_perspective, 
                    search_gamerant, 
                    search_windows_central,
                    search_tech_radar]

def search_all_sites(website_urls=website_urls, search_terms=search_terms, article_limit=1, word_limit=1000, year_from=year, month_from=month, day_from=day, day_to=day, month_to=month, year_to=year, sites_to_search=[0], keywords=[]):
    i = 0
    return_list = {}
    for website_url in website_urls:
        if i in sites_to_search:
            return_list[website_url] = search_functions[i](website_url, search_terms, article_limit, word_limit, year_from, month_from, day_from, year_to, month_to, day_to, keywords=keywords)
        i += 1
    return return_list