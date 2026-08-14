import pytest
from unittest.mock import patch, MagicMock
from search import (
    search_toms_hardware,
    search_pc_mag,
    search_the_pc_enthusiast,
    search_hothardware,
    search_pc_perspective,
    search_gamerant,
    search_windows_central,
    search_tech_radar
)

# Shared test search setup
SEARCH_TERMS = ["MSI"]
KEYWORDS = ["MSI"]

# Mock HTML payloads for each website
MOCK_HTML_MAP = {
    "toms_hardware_search": """
    <div class="listingResults">
        <div class="listingResult">
            <span style="white-space:nowrap">John Doe</span>
            <a class="article-link" href="https://www.tomshardware.com/news/msi-article" aria-label="Tom's MSI Desktop Review">Link</a>
            <time class="date-with-prefix">1 May 25</time>
        </div>
    </div>
    """,
    "toms_hardware_article": """
    <div id="article-body">
        <p>This is an in-depth review of the MSI gaming desktop performance and thermals.</p>
    </div>
    """,
    "pc_mag_search": """
    <div class="flex flex-col gap-4">
        <div class="dark:border-gray-600">
            <a x-track-ga-click="true" href="news/msi-review">PCMag MSI Desktop Review</a>
            <span data-content-published-date="true">05/01/2025</span>
            <a data-element="author-name">Jane Smith</a>
        </div>
    </div>
    """,
    "pc_mag_article": """
    <article>
        <p>Reviewing the new MSI desktop computer features and price performance ratio.</p>
    </article>
    """,
    "pc_enthusiast_search": """
    <main class="site-main">
        <div class="inside-article">
            <span class="author-name">Alex Johnson</span>
            <a rel="bookmark" href="https://thepcenthusiast.com/msi-gpu-review">PCE MSI Review</a>
            <time class="published">May 1, 2025</time>
        </div>
    </main>
    """,
    "pc_enthusiast_article": """
    <div class="entry-content">
        <p>Testing MSI GPU benchmark performance and cooling design for PC enthusiasts.</p>
    </div>
    """,
    "hothardware_search": """
    <div class="content-list">
        <div class="cl-item">
            <div class="cli-byline">By Chris Taylor - May 1, 2025</div>
            <a class="black p-name u-url" href="/news/msi-rig">HotHardware MSI Rig</a>
        </div>
    </div>
    """,
    "hothardware_article": """
    <div class="cn-body e-content">
        HotHardware testing of MSI prebuilt gaming desktop tower thermals and fps.
    </div>
    """,
    "pc_perspective_search": """
    <div class="paginated_content">
        <article class="hentry">
            <a rel="author">Ryan Shrout</a>
            <a class="et-accent-color" href="https://pcper.com/msi-motherboard">PCPer MSI Board</a>
            <span class="updated">May 1, 2025</span>
        </article>
    </div>
    """,
    "pc_perspective_article": """
    <div class="et-l et-l--post">
        <p>PC Perspective analysis of the MSI gaming motherboard power delivery and ports.</p>
    </div>
    """,
    "gamerant_search": """
    <section class="listing-content">
        <div class="article">
            <a rel="author">Gamer Editor</a>
            <a href="/news/msi-gaming-laptop">GameRant MSI Laptop</a>
            <span class="display-card-date">May 1, 2025</span>
        </div>
    </section>
    """,
    "gamerant_article": """
    <div class="content-block-regular">
        <p>GameRant review covering the MSI gaming laptop display quality and graphics power.</p>
    </div>
    """,
    "windows_central_search": """
    <div class="listingResults">
        <div class="listingResult">
            <span style="white-space:nowrap">Daniel Rubino</span>
            <a class="article-link" href="https://www.windowscentral.com/msi-claw">
                <h3 class="article-name">Windows Central MSI Claw</h3>
            </a>
            <time class="no-wrap relative-date date-with-prefix">1 May 25</time>
        </div>
    </div>
    """,
    "windows_central_article": """
    <div id="article-body">
        <p>Windows Central breakdown of the MSI handheld gaming PC battery life and performance.</p>
    </div>
    """,
    "tech_radar_search": """
    <div class="listingResults">
        <div class="listingResult">
            <span style="white-space:nowrap">Matt Hanson</span>
            <a class="article-link" href="https://www.techradar.com/msi-stealth">
                <h3 class="article-name">TechRadar MSI Stealth</h3>
            </a>
            <time class="no-wrap relative-date date-with-prefix">1 May 25</time>
        </div>
    </div>
    """,
    "tech_radar_article": """
    <div id="article-body">
        <p>TechRadar verdict on the ultra thin MSI laptop design and gaming performance benchmark.</p>
    </div>
    """
}

def create_mock_requests_get(search_key, article_key):
    """Helper to mock requests.get responses for search page vs article page."""
    def mock_get(url, *args, **kwargs):
        mock_response = MagicMock()
        mock_response.status_code = 200
        if "searchTerm" in kwargs.get("params", {}) or "query" in kwargs.get("params", {}) or "s" in kwargs.get("params", {}) or "a" in kwargs.get("params", {}) or "q" in kwargs.get("params", {}):
            mock_response.text = MOCK_HTML_MAP[search_key]
        else:
            mock_response.text = MOCK_HTML_MAP[article_key]
        return mock_response
    return mock_get


# =====================================================================
# 1. TOM'S HARDWARE SCRAPER TESTS
# =====================================================================

def test_toms_hardware_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("toms_hardware_search", "toms_hardware_article")
    with patch("requests.get", side_effect=mock_get):
        # Past Date Range (Should match: 2025-05-01 is within 2025-01-01 to 2025-12-31)
        res_past = search_toms_hardware(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://www.tomshardware.com/news/msi-article"
        assert url in res_past
        metadata = res_past[url]
        assert "John Doe" in metadata[3]  # Author
        assert metadata[5] == "2025-05-01"  # Formatted ISO date

        # Exact Date (Should match: 2025-05-01)
        res_exact = search_toms_hardware(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        # Future Date Range (Should return 0 articles)
        res_future = search_toms_hardware(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0


# =====================================================================
# 2. PC MAG SCRAPER TESTS
# =====================================================================

def test_pc_mag_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("pc_mag_search", "pc_mag_article")
    with patch("requests.get", side_effect=mock_get):
        res_past = search_pc_mag(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://www.pcmag.com/news/msi-review"
        assert url in res_past
        assert res_past[url][5] == "2025-05-01"

        res_exact = search_pc_mag(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        res_future = search_pc_mag(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0


# =====================================================================
# 3. THE PC ENTHUSIAST SCRAPER TESTS
# =====================================================================

def test_the_pc_enthusiast_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("pc_enthusiast_search", "pc_enthusiast_article")
    with patch("requests.get", side_effect=mock_get):
        res_past = search_the_pc_enthusiast(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://thepcenthusiast.com/msi-gpu-review"
        assert url in res_past
        assert res_past[url][5] == "2025-05-01"

        res_exact = search_the_pc_enthusiast(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        res_future = search_the_pc_enthusiast(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0


# =====================================================================
# 4. HOTHARDWARE SCRAPER TESTS
# =====================================================================

def test_hothardware_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("hothardware_search", "hothardware_article")
    with patch("requests.get", side_effect=mock_get):
        res_past = search_hothardware(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://hothardware.com/news/msi-rig"
        assert url in res_past
        assert res_past[url][5] == "2025-05-01"

        res_exact = search_hothardware(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        res_future = search_hothardware(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0


# =====================================================================
# 5. PC PERSPECTIVE SCRAPER TESTS
# =====================================================================

def test_pc_perspective_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("pc_perspective_search", "pc_perspective_article")
    with patch("requests.get", side_effect=mock_get):
        res_past = search_pc_perspective(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://pcper.com/msi-motherboard"
        assert url in res_past
        assert res_past[url][5] == "2025-05-01"

        res_exact = search_pc_perspective(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        res_future = search_pc_perspective(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0


# =====================================================================
# 6. GAMERANT SCRAPER TESTS
# =====================================================================

def test_gamerant_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("gamerant_search", "gamerant_article")
    with patch("requests.get", side_effect=mock_get):
        res_past = search_gamerant(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://gamerant.com/news/msi-gaming-laptop"
        assert url in res_past

        res_exact = search_gamerant(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        res_future = search_gamerant(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0


# =====================================================================
# 7. WINDOWS CENTRAL SCRAPER TESTS
# =====================================================================

def test_windows_central_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("windows_central_search", "windows_central_article")
    with patch("requests.get", side_effect=mock_get):
        res_past = search_windows_central(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://www.windowscentral.com/msi-claw"
        assert url in res_past
        assert res_past[url][5] == "2025-05-01"

        res_exact = search_windows_central(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        res_future = search_windows_central(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0


# =====================================================================
# 8. TECH RADAR SCRAPER TESTS
# =====================================================================

def test_tech_radar_scraping_and_date_ranges():
    mock_get = create_mock_requests_get("tech_radar_search", "tech_radar_article")
    with patch("requests.get", side_effect=mock_get):
        res_past = search_tech_radar(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=1, day_from=1,
            year_to=2025, month_to=12, day_to=31
        )
        assert len(res_past) == 1
        url = "https://www.techradar.com/msi-stealth"
        assert url in res_past
        assert res_past[url][5] == "2025-05-01"

        res_exact = search_tech_radar(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2025, month_from=5, day_from=1,
            year_to=2025, month_to=5, day_to=1
        )
        assert len(res_exact) == 1

        res_future = search_tech_radar(
            search_terms=SEARCH_TERMS, keywords=KEYWORDS,
            year_from=2030, month_from=1, day_from=1,
            year_to=2030, month_to=12, day_to=31
        )
        assert len(res_future) == 0
