# System Specification & Architecture

## System Overview & Architecture Diagram

The system is a full-stack, AI-powered intelligence platform that scrapes articles from 8 premier technology news publications, streams real-time progress updates via Server-Sent Events (SSE), executes high-concurrency LLM analysis via Groq (`llama-3.3-70b-versatile` with `llama-3.1-8b-instant` fallback) and Google Vertex AI, persists structured records to Supabase PostgreSQL, and dispatches email digests via Resend.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND LAYER                                       │
│  [index.html] [main.ts / main.js] [styles.css]                                         │
│  - TypeScript UI controller with LocalStorage state persistence                       │
│  - Real-time Server-Sent Events (SSE) stream reader (ReadableStream & TextDecoder)     │
│  - Glassmorphic progress tracker with smooth button swap & step badges                 │
│  - Standalone HTML export generator & batch selection action bar                       │
└───────────────────────────┬────────────────────────────────────────────────────────────┘
                            │ HTTP & Server-Sent Events (text/event-stream)
┌───────────────────────────▼────────────────────────────────────────────────────────────┐
│                                   FASTAPI BACKEND LAYER                                │
│  [app.py] [schemas.py] (FastAPI ASGI + Pydantic Validation + Lifespan Handlers)       │
└──────────────┬────────────────────────────┬─────────────────────────────┬──────────────┘
               │                            │                             │
┌──────────────▼─────────────┐ ┌────────────▼────────────┐ ┌──────────────▼──────────────┐
│     SCRAPING ENGINE        │ │   AI / INFERENCE ENGINE │ │   PERSISTENCE & EMAIL        │
│ [search.py]                │ │ [methods.py]            │ │ [database.py] [auto_email]   │
│ - 8 Site Scrapers          │ │ - Single Combined Prompt│ │ - Supabase PostgreSQL        │
│ - BeautifulSoup Parsing    │ │ - 50% Token Reduction   │ │ - Resend Email API           │
│ - OpenGraph Metadata       │ │ - Llama-3.3-70B Primary │ │ - Automated Content Migration│
│ - Tuple Date Range Filter  │ │ - Llama-3.1-8B Fallback │ │                              │
│ - Timezone & Base64 Parser │ │ - Exponential Backoff   │ │                              │
└────────────────────────────┘ └─────────────────────────┘ └──────────────────────────────┘
```

---

## Technology Stack

### Backend & Core Services
* **Language & Runtime**: Python 3.11+
* **API Framework**: FastAPI (ASGI)
* **ASGI Server**: Uvicorn (`uvicorn app:app --reload`)
* **Streaming Protocol**: Server-Sent Events (SSE) via `StreamingResponse(event_generator(), media_type="text/event-stream")`
* **Request Validation & Schemas**: Pydantic v2 (`BaseModel`, `Field`, `validator`)
* **Async & Concurrency Engine**: Python `asyncio`, `AsyncGroq`, `asyncio.gather()`, `asyncio.to_thread`
* **Environment & Security**: `python-dotenv`, zero-trust prompt sanitizer (`is_safe_and_relevant_prompt`)

### AI & LLM Inference Pipeline
* **Primary LLM Engine**: Groq Cloud API (`AsyncGroq`, model: `llama-3.3-70b-versatile` with 128,000 token context window)
* **Secondary / Rate-Limit Fallback Engine**: `llama-3.1-8b-instant` (30,000 TPM limit — 2.5x higher token allowance)
* **Token Optimization**: Single combined prompt architecture reducing token consumption by **50%**
* **Resilience**: Automatic retry with exponential backoff (`1.2s`, `2.4s`) handling Groq HTTP 429 TPM burst limits
* **Secondary Cloud Provider**: Google Cloud Vertex AI SDK (`google-genai`, model: `gemini-3.5-flash`)

### Web Scraping & Metadata Extraction
* **HTML Parsing & Traversal**: BeautifulSoup4 (`bs4`), `requests`
* **Supported Publications (8 Live Sites)**: Tom's Hardware, PC Mag, The PC Enthusiast, HotHardware, PC Perspective, GameRant, Windows Central, TechRadar
* **Metadata & Link Previews**: OpenGraph (`og:image`, `og:description`), Twitter Cards (`twitter:image`), `urllib.parse.urljoin`
* **Date Filtering Engine**: Python `(year, month, day)` tuple comparison (`start_date <= article_date <= end_date`) with multi-format month dictionary and weekday token stripping

### Database & Persistence
* **Database Engine**: Supabase PostgreSQL
* **Client SDK**: `supabase-py` (`create_client`)
* **Features**: Table upsert (`on_conflict="url"`), multi-criteria filtering (`.in_()`, `.ilike()`, `.gte()`, `.lte()`), dynamic preview backfill engine (`ensure_preview_in_content`)

### Email Service & Messaging
* **Email API Service**: Resend API (`resend` SDK)
* **Validation**: Strict regex recipient email validator (`is_valid_email`)
* **Domain Authentication**: Verified custom domain sender

### Frontend Architecture
* **Language**: TypeScript (compiled to ES6 JavaScript via `npx tsc`)
* **Markup & Layout**: Semantic HTML5, CSS Grid / Flexbox
* **Design System**: Modern Dark Mode palette (`#09090b`), custom glassmorphic cards, custom dropdowns, responsive controls
* **Real-time UX**: Server-Sent Events stream reader with glowing progress bar, dynamic status messages, and step badges (`.active`, `.completed`)
* **Client State & Export**: Browser `localStorage` caching, dynamic offline HTML Blob exporter (`summaries.html`)

---

## Key File Map

### Backend Directory (`backend/`)
*   [`app.py`](backend/app.py) — FastAPI application instance, Server-Sent Events streaming route (`/api/search-site-stream`), async route handlers, CORS middleware, and cookie session tracking.
*   [`schemas.py`](backend/schemas.py) — Pydantic request models (`SearchSiteRequest`, `SearchDatabaseRequest`, `SaveDatabaseRequest`, `EmailRequest`).
*   [`methods.py`](backend/methods.py) — Async LLM summarization & sentiment analysis pipeline (`AsyncGroq`), single combined prompt builder, retry/fallback handler, security guardrails, and Resend email client.
*   [`search.py`](backend/search.py) — Web scraping engine supporting 8 tech publications, OpenGraph preview extractor, date tuple range comparator, and timezone/date parser.
*   [`database.py`](backend/database.py) — Supabase PostgreSQL integration layer, multi-criteria search queries, article upsert logic, and backfill content migrator.
*   [`auto_email_send.py`](backend/auto_email_send.py) — Standalone automated recurring digest CLI script for hardware monitoring.

### Backend Test Suite (`backend/tests/`)
*   [`conftest.py`](backend/tests/conftest.py) — Pytest fixtures, `TestClient` initialization, and warning filters.
*   [`test_scrapers.py`](backend/tests/test_scrapers.py) — Dedicated test suite for all 8 web scrapers testing HTML DOM parsing and future, past, and exact date ranges.
*   [`test_search_site.py`](backend/tests/test_search_site.py) — Security prompt guardrails, Pydantic validation errors, SSE stream endpoint tests, combined prompt parsing, and 429 retry/fallback tests.
*   [`test_database.py`](backend/tests/test_database.py) — Database save (404 and 200), recent saves, all saved, and search database tests.
*   [`test_email.py`](backend/tests/test_email.py) — Email validation and Resend provider mock tests.
*   [`test_health.py`](backend/tests/test_health.py) — API health check test.

### Frontend Directory (`frontend/`)
*   [`index.html`](frontend/index.html) — Single-page dashboard markup featuring dual search cards, real-time progress card, custom dropdown menus, email modal, and action control bar.
*   [`main.ts`](frontend/main.ts) — TypeScript client logic handling SSE stream reading, LocalStorage caching, dynamic DOM updates, HTML file generation, and smooth button transitions.
*   [`styles.css`](frontend/styles.css) — Modern dark-mode design system with responsive grid/flexbox layouts, progress animations, and glowing step badges.

---

## Feature & Implementation Specifications

### 1. Web Scraping & Date Tuple Comparison Engine
*   **Implementation File**: [`backend/search.py`](backend/search.py)
*   **Supported Publications**: Tom's Hardware, PC Mag, The PC Enthusiast, HotHardware, PC Perspective, GameRant, Windows Central, TechRadar.
*   **Tuple Range Filtering**:
    *   Replaced 25+ nested `if` statements with `is_article_in_date_range(m_year, m_month, m_day, year_from, month_from, day_from, year_to, month_to, day_to)`:
        ```python
        start_date = (year_from, month_from, day_from)
        article_date = (m_year, m_month, m_day)
        end_date = (year_to, month_to, day_to)
        return start_date <= article_date <= end_date
        ```
*   **OpenGraph & Link Preview Extractor**:
    *   Function `extract_link_preview_metadata` extracts `og:image`, `twitter:image`, `og:description`, and `description` meta tags.
    *   Resolves relative media links using `urllib.parse.urljoin` and truncates descriptions at 200 characters for visual uniformity.

### 2. High-Throughput LLM Pipeline & Rate-Limit Resilience
*   **Implementation File**: [`backend/methods.py`](backend/methods.py)
*   **Single Combined Prompt (50% Token Reduction)**:
    *   `build_combined_prompt` combines the 7-point summary and 3-category sentiment analysis into a single LLM request.
    *   `split_combined_llm_response` cleanly separates the sections into structured HTML containers.
*   **Automatic Exponential Backoff**:
    *   `call_groq_with_retry_and_fallback` intercepts `groq.RateLimitError` and sleeps `1.2s` and `2.4s` before retrying.
*   **Dual-Tier Fallback Routing**:
    *   Primary model: `llama-3.3-70b-versatile` (128k context).
    *   Fallback model: `llama-3.1-8b-instant` (30k TPM limit).
*   **Two-Level Concurrency Architecture**:
    *   Level 1: Inter-article concurrency via `asyncio.gather(*all_article_tasks)`.
    *   Level 2: Intra-article execution via single combined prompt parsing.

### 3. Server-Sent Events (SSE) Real-Time Progress Streaming
*   **Implementation Files**: [`backend/app.py`](backend/app.py), [`frontend/main.ts`](frontend/main.ts)
*   **Backend Generator**:
    *   `POST /api/search-site-stream` yields chunked JSON events:
        - Stage 1 (25%): Searching target publications.
        - Stage 2 (50%): Scraping article DOMs & OpenGraph metadata.
        - Stage 3 (75%): Running parallel Groq LLM summarization & sentiment analysis.
        - Stage 4 (100%): Delivering generated HTML payload and updating session memory.
*   **Frontend Stream Reader**:
    *   `makeApiRequest_stream` decodes incoming binary chunks with `ReadableStreamDefaultReader` and `TextDecoder`, updating the progress bar and active step badges dynamically.
    *   Smooth CSS transition swaps the "Search Articles" submit button for the glowing progress tracker when clicked.

### 4. Prompt Guardrails & Security System
*   **Implementation File**: [`backend/methods.py`](backend/methods.py)
*   **Security Function**: `is_safe_and_relevant_prompt`
*   **Mitigation Strategy**:
    *   **Jailbreak Mitigation**: Rejects phrases like "ignore previous instructions", "system prompt", "dan mode", and "developer mode".
    *   **Code Injection Protection**: Rejects prompts asking to generate Python, JavaScript, HTML, SQL queries, or scripts.
    *   **Scope Enforcement**: Ensures prompts remain focused on summarization and sentiment tasks.

### 5. Persistence & Database Search Engine
*   **Implementation File**: [`backend/database.py`](backend/database.py)
*   **Database Stack**: Supabase PostgreSQL managed via Python SDK (`create_client`).
*   **Key Operations**:
    *   `insert_to_supabase`: Performs bulk `upsert` on the `articles` table with `on_conflict="url"`.
    *   `search_for_articles`: Executes complex chained Supabase SQL queries using `.in_()` for sites/URLs, `.or_()` with `.ilike` wildcard matching for titles/keywords, and `.gte()` / `.lte()` for publication date ranges.
    *   `save_to_database`: Raises explicit `HTTPException(status_code=404)` when requested articles are missing from session memory.

---

## 🧪 Comprehensive Pytest Test Suite (25 Tests)

```bash
cd backend
python -m pytest tests/ -v
```

```text
tests/test_database.py::test_save_to_database_not_found PASSED           [  4%]
tests/test_database.py::test_save_to_database_endpoint_success PASSED    [  8%]
tests/test_database.py::test_recent_saves_endpoint PASSED                [ 12%]
tests/test_database.py::test_all_saved_endpoint PASSED                   [ 16%]
tests/test_database.py::test_search_database_endpoint PASSED             [ 20%]
tests/test_email.py::test_email_missing_fields PASSED                    [ 24%]
tests/test_email.py::test_email_invalid_format PASSED                    [ 28%]
tests/test_email.py::test_email_success PASSED                           [ 32%]
tests/test_email.py::test_email_provider_failure PASSED                  [ 36%]
tests/test_health.py::test_health_check PASSED                           [ 40%]
tests/test_scrapers.py::test_toms_hardware_scraping_and_date_ranges PASSED [ 44%]
tests/test_pc_mag_scraping_and_date_ranges PASSED      [ 48%]
tests/test_the_pc_enthusiast_scraping_and_date_ranges PASSED [ 52%]
tests/test_hothardware_scraping_and_date_ranges PASSED [ 56%]
tests/test_pc_perspective_scraping_and_date_ranges PASSED [ 60%]
tests/test_gamerant_scraping_and_date_ranges PASSED    [ 64%]
tests/test_windows_central_scraping_and_date_ranges PASSED [ 68%]
tests/test_tech_radar_scraping_and_date_ranges PASSED  [ 72%]
tests/test_search_site.py::test_search_site_invalid_custom_prompt PASSED [ 76%]
tests/test_search_site.py::test_search_site_validation PASSED            [ 80%]
tests/test_search_site.py::test_parallel_article_processing PASSED       [ 84%]
tests/test_search_site.py::test_search_site_endpoint_integration PASSED  [ 88%]
tests/test_search_site.py::test_search_site_stream_endpoint PASSED       [ 92%]
tests/test_search_site.py::test_combined_prompt_parsing PASSED           [ 96%]
tests/test_search_site.py::test_rate_limit_retry_and_fallback PASSED     [100%]

============================= 25 passed in 2.41s ==============================
```