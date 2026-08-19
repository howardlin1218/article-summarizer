import os
import uuid
import json
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict

from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from schemas import (
    EmailRequest, SaveDatabaseRequest, SearchSiteRequest, SearchDatabaseRequest
)
from methods import (
    construct_message_async, send_email, is_valid_email, is_safe_and_relevant_prompt
)
from search import search_all_sites, search_functions, website_urls as search_website_urls
from database import (
    insert_to_supabase, get_recent_10_articles, search_for_articles, get_all_saved
)

load_dotenv()

# User-specific dictionaries keyed by session ID
session_json_dicts: Dict[str, dict] = {}
session_email_dicts: Dict[str, dict] = {}

def get_or_create_session_id(request: Request, response: Response) -> str:
    session_id = request.cookies.get("user_session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        is_prod = os.getenv("BUILD_ENV") == "prod"
        response.set_cookie(
            key="user_session_id",
            value=session_id,
            httponly=True,
            samesite="lax",
            secure=is_prod
        )
    return session_id

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    yield
    # Graceful Shutdown logic (flushes remaining session memory to database)
    all_articles = []
    for user_dict in session_json_dicts.values():
        all_articles.extend(user_dict.values())
    if all_articles:
        await asyncio.to_thread(insert_to_supabase, all_articles)

app = FastAPI(title="Article Summarizer API", lifespan=lifespan)

# CORS Configuration
origins = [
    "http://127.0.0.1:5501",
    "https://www.summarizer.howard1218.site",
    "https://summarizer.howard1218.site"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/email-to-user")
async def email_to_user(payload: EmailRequest, request: Request, response: Response):
    if not payload.email_address or not is_valid_email(payload.email_address):
        raise HTTPException(status_code=400, detail="Please provide a valid email address.")
    if not payload.data:
        raise HTTPException(status_code=400, detail="No articles selected to summarize.")

    user_id = get_or_create_session_id(request, response)
    user_email_dict = session_email_dicts.setdefault(user_id, {})

    email_html_content = "".join(
        user_email_dict.get(art_id, "<p>Article content not found.</p>") for art_id in payload.data
    )

    success = await asyncio.to_thread(send_email, email_html_content, payload.email_address)
    if not success:
        raise HTTPException(status_code=502, detail="The email provider rejected the request.")

    return {"status": "success", "message": "email successfully sent"}

@app.post("/api/save-to-database")
async def save_to_database(payload: SaveDatabaseRequest, request: Request, response: Response):
    user_id = get_or_create_session_id(request, response)
    user_json_dict = session_json_dicts.setdefault(user_id, {})
    
    list_of_json_data = [user_json_dict[art_id] for art_id in payload.data if art_id in user_json_dict]
    if not list_of_json_data:
        raise HTTPException(
            status_code=404,
            detail="No matching articles found in current session memory to save."
        )
        
    await asyncio.to_thread(insert_to_supabase, list_of_json_data)
    return {"status": "success", "message": f"Saved {len(list_of_json_data)} article(s) successfully to database"}

@app.post("/api/search-site")
async def search_site(payload: SearchSiteRequest, request: Request, response: Response):
    if payload.customPrompt and not is_safe_and_relevant_prompt(payload.customPrompt):
        raise HTTPException(
            status_code=400,
            detail="Inappropriate or irrelevant custom prompt. Your prompt must be strictly related to summarizing, analyzing, or processing text from the articles."
        )

    keywords_list = [kw.strip() for kw in payload.keywords.split(",") if kw.strip()] if payload.keywords else []
    search_terms_list = [kw.strip() for kw in payload.searchTerms.split("|") if kw.strip()] if payload.searchTerms else []

    now = datetime.now()
    year_to = payload.year_to if payload.year_to != 0 else now.year
    month_to = payload.month_to if payload.month_to != 0 else now.month
    day_to = payload.day_to if payload.day_to != 0 else now.day

    # Run blocking scrapers in background thread pool to keep asyncio event loop responsive
    results_list = await asyncio.to_thread(
        search_all_sites,
        search_terms=search_terms_list,
        article_limit=payload.limit,
        year_from=payload.year_from,
        month_from=payload.month_from,
        day_from=payload.day_from,
        year_to=year_to,
        month_to=month_to,
        day_to=day_to,
        sites_to_search=payload.websites,
        keywords=keywords_list
    )

    user_id = get_or_create_session_id(request, response)
    user_json_dict = session_json_dicts.setdefault(user_id, {})
    user_email_dict = session_email_dicts.setdefault(user_id, {})

    return_str = await construct_message_async(
        results_list=results_list,
        keywords=keywords_list,
        custom_prompt=payload.customPrompt,
        json_dict=user_json_dict,
        email_dict=user_email_dict
    )

    return {"status": "success", "message": "returning json", "html": return_str}

@app.post("/api/search-site-stream")
async def search_site_stream(payload: SearchSiteRequest, request: Request, response: Response):
    """
    Search articles across selected websites and stream real-time progress via SSE.
    """
    if payload.customPrompt:
        if not is_safe_and_relevant_prompt(payload.customPrompt):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom prompt is off-topic or contains disallowed instructions."
            )

    user_id = get_or_create_session_id(request, response)

    async def event_generator():
        try:
            keywords_list = [kw.strip() for kw in payload.keywords.split(",") if kw.strip()] if payload.keywords else []
            search_terms_list = [kw.strip() for kw in payload.searchTerms.split("|") if kw.strip()] if payload.searchTerms else []

            now = datetime.now()
            year_to = payload.year_to if payload.year_to != 0 else now.year
            month_to = payload.month_to if payload.month_to != 0 else now.month
            day_to = payload.day_to if payload.day_to != 0 else now.day

            site_names = [
                "Tom's Hardware", "PC Mag", "The PC Enthusiast", "Hot Hardware",
                "PC Perspective", "GameRant", "Windows Central", "Tech Radar"
            ]

            selected_sites = payload.websites or [0]
            total_sites = len(selected_sites)
            results_list = {}

            # Stage 1: Searching & Scraping Target Websites (with live per-publication progress)
            for idx, site_idx in enumerate(selected_sites):
                if 0 <= site_idx < len(search_functions):
                    name = site_names[site_idx] if site_idx < len(site_names) else f"Site #{site_idx+1}"
                    progress_pct = int(10 + (idx / total_sites) * 50)
                    yield f"data: {json.dumps({'stage': 1, 'step': 'searching', 'message': f'Searching & scraping {name} ({idx+1}/{total_sites})...', 'progress': progress_pct})}\n\n"
                    await asyncio.sleep(0.02)

                    target_url = search_website_urls[site_idx]
                    site_res = await asyncio.to_thread(
                        search_functions[site_idx],
                        target_url,
                        search_terms_list,
                        payload.limit,
                        1000,
                        payload.year_from,
                        payload.month_from,
                        payload.day_from,
                        year_to,
                        month_to,
                        day_to,
                        keywords=keywords_list
                    )
                    results_list[target_url] = site_res

            # Stage 2: Scraping & Extracting Article Content
            total_articles = sum(len(res) for res in results_list.values())
            msg = f"Extracted {total_articles} matching article(s). Parsing DOM & metadata..." if total_articles > 0 else "No matching articles found."
            yield f"data: {json.dumps({'stage': 2, 'step': 'scraping', 'message': msg, 'progress': 65, 'article_count': total_articles})}\n\n"
            await asyncio.sleep(0.02)

            # Stage 3: AI Summarization & Sentiment Analysis
            yield f"data: {json.dumps({'stage': 3, 'step': 'summarizing', 'message': f'Running parallel Groq LLM summarization & sentiment analysis for {total_articles} article(s)...', 'progress': 80})}\n\n"
            await asyncio.sleep(0.02)

            user_json_dict = session_json_dicts.setdefault(user_id, {})
            user_email_dict = session_email_dicts.setdefault(user_id, {})

            return_str = await construct_message_async(
                results_list=results_list,
                keywords=keywords_list,
                custom_prompt=payload.customPrompt,
                json_dict=user_json_dict,
                email_dict=user_email_dict
            )

            # Stage 4: Complete & Render Output
            yield f"data: {json.dumps({'stage': 4, 'step': 'complete', 'message': 'Summarization complete!', 'progress': 100, 'status': 'success', 'html': return_str})}\n\n"
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'stage': 4, 'step': 'error', 'message': f'Server Error: {str(e)}', 'status': 'error', 'progress': 100, 'html': ''})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@app.get("/api/recent-saves")
async def get_recent_articles(request: Request, response: Response):
    res_data = await asyncio.to_thread(get_recent_10_articles)
    if isinstance(res_data, int):
        raise HTTPException(status_code=500, detail="Error fetching from database")
        
    user_id = get_or_create_session_id(request, response)
    user_email_dict = session_email_dicts.setdefault(user_id, {})
    
    for item in res_data:
        content = item.get("content") or ""
        url = item.get("url") or ""
        input_tag = f"<input value='{url}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n"
        user_email_dict[url] = content.replace(input_tag, "")

    return {
        "status": "success",
        "message": "got 10 most recent articles saved",
        "html": "".join(art.get("content") or "" for art in res_data)
    }

@app.get("/api/all-saved")
async def get_all_saved_articles(request: Request, response: Response):
    res_data = await asyncio.to_thread(get_all_saved)
    if isinstance(res_data, int):
        raise HTTPException(status_code=500, detail="Error fetching from database")

    user_id = get_or_create_session_id(request, response)
    user_email_dict = session_email_dicts.setdefault(user_id, {})
    
    for item in res_data:
        content = item.get("content") or ""
        url = item.get("url") or ""
        input_tag = f"<input value='{url}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n"
        user_email_dict[url] = content.replace(input_tag, "")

    return {
        "status": "success",
        "message": "got all saved articles",
        "html": "".join(art.get("content") or "" for art in res_data)
    }

@app.post("/api/search-database")
async def search_database(payload: SearchDatabaseRequest, request: Request, response: Response):
    start_date = 0
    end_date = 0
    if payload.year_from != 0 and payload.month_from != 0 and payload.day_from != 0:
        start_date = f"{payload.year_from}-{payload.month_from:02}-{payload.day_from:02}"
    if payload.year_to != 0 and payload.month_to != 0 and payload.day_to != 0:
        end_date = f"{payload.year_to}-{payload.month_to:02}-{payload.day_to:02}"

    keywords_list = [k.strip() for k in payload.keywords.split(",") if k.strip()] if payload.keywords else []
    urls_list = payload.urls.strip().replace(" ", "").split(",") if payload.urls else []

    res_data = await asyncio.to_thread(
        search_for_articles,
        payload.websites,
        payload.searchTerms,
        payload.limit,
        keywords_list,
        urls_list,
        start_date,
        end_date
    )
    if isinstance(res_data, int):
        raise HTTPException(status_code=500, detail="Error searching database")

    user_id = get_or_create_session_id(request, response)
    user_email_dict = session_email_dicts.setdefault(user_id, {})
    for item in res_data:
        content = item.get("content") or ""
        url = item.get("url") or ""
        input_tag = f"<input value='{url}' style='width: auto; transform: scale(1.5);' type='checkbox' name='articleCheckBox' />\n"
        user_email_dict[url] = content.replace(input_tag, "")

    return {
        "status": "success",
        "message": "returning json",
        "html": "".join(art.get("content") or "" for art in res_data)
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=5000, reload=True)
