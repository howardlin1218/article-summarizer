import pytest
import html
from pydantic import ValidationError
from cachetools import TTLCache
from methods import (
    convert_metadata_to_html,
    convert_response_to_html_list_summary,
    convert_response_to_html_list_sentiment,
)
from unittest.mock import patch, MagicMock
from database import sanitize_postgrest_term, is_safe_external_url, ensure_preview_in_content
from search import (
    search_toms_hardware,
    search_pc_mag,
    search_the_pc_enthusiast,
    search_hothardware,
    search_pc_perspective,
    search_gamerant,
    search_windows_central,
    search_tech_radar,
)
from schemas import SearchSiteRequest, SearchDatabaseRequest
from app import session_json_dicts, session_email_dicts, app


class TestHtmlEscapingAndSanitization:
    """Tests verifying defenses against XSS and link injection in methods.py."""

    def test_convert_metadata_to_html_escapes_script_tags(self):
        malicious_input = "<script>alert('xss')</script>"
        result = convert_metadata_to_html(
            website_url="https://www.tomshardware.com",
            title=malicious_input,
            author=malicious_input,
            publish_date=malicious_input,
            keywords=[malicious_input],
            link="https://www.tomshardware.com/article",
            description=malicious_input,
        )
        assert "<script>" not in result
        assert "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;" in result
        assert "noopener noreferrer" in result

    def test_convert_metadata_to_html_rejects_javascript_scheme_in_link(self):
        result = convert_metadata_to_html(
            website_url="https://www.tomshardware.com",
            title="Safe Title",
            author="Safe Author",
            publish_date="2026-09-14",
            keywords=["safe"],
            link="javascript:alert(document.cookie)",
        )
        assert 'href="javascript:' not in result
        assert 'href="#"' in result

    def test_convert_metadata_to_html_rejects_javascript_scheme_in_thumbnail(self):
        result = convert_metadata_to_html(
            website_url="https://www.tomshardware.com",
            title="Safe Title",
            author="Safe Author",
            publish_date="2026-09-14",
            keywords=["safe"],
            link="https://www.tomshardware.com/safe",
            thumbnail_url="javascript:alert(1)",
        )
        assert 'javascript:alert(1)' not in result
        assert '<img src="javascript:' not in result

    def test_convert_metadata_to_html_allows_valid_http_https_links(self):
        result = convert_metadata_to_html(
            website_url="https://www.tomshardware.com",
            title="Safe Title",
            author="Safe Author",
            publish_date="2026-09-14",
            keywords=["safe"],
            link="https://www.tomshardware.com/news/safe-article",
            thumbnail_url="https://www.tomshardware.com/images/thumb.jpg",
        )
        assert 'href="https://www.tomshardware.com/news/safe-article"' in result
        assert 'src="https://www.tomshardware.com/images/thumb.jpg"' in result

    def test_convert_response_to_html_list_summary_escapes_html(self):
        bullet_text = """
        * Safe bullet point
        * <img src=x onerror=alert('xss')>
        * Normal point with <b>bold</b> text
        """
        result = convert_response_to_html_list_summary(bullet_text)
        assert "<img" not in result
        assert "&lt;img src=x onerror=alert(&#x27;xss&#x27;)&gt;" in result
        assert "&lt;b&gt;bold&lt;/b&gt;" in result
        assert "<li>Safe bullet point</li>" in result

    def test_convert_response_to_html_list_summary_caps_bullets_at_seven(self):
        ten_bullets = "\n".join([f"* Bullet point {i}" for i in range(1, 11)])
        result = convert_response_to_html_list_summary(ten_bullets)
        assert "Bullet point 7" in result
        assert "Bullet point 8" not in result

    def test_convert_response_to_html_list_sentiment_escapes_html(self):
        sentiment_text = """
        [POSITIVE]
        * Great achievement with <script>evil()</script>
        [NEUTRAL]
        * Regular update with <iframe>frame</iframe>
        [NEGATIVE]
        * Concern with <svg onload=alert(1)>
        """
        result = convert_response_to_html_list_sentiment(sentiment_text)
        assert "<script>" not in result
        assert "<iframe>" not in result
        assert "<svg" not in result
        assert "&lt;script&gt;evil()&lt;/script&gt;" in result
        assert "&lt;iframe&gt;frame&lt;/iframe&gt;" in result
        assert "&lt;svg onload=alert(1)&gt;" in result


class TestPostgrestInjectionPrevention:
    """Tests verifying PostgREST query parameter sanitization."""

    def test_sanitize_postgrest_term_removes_syntax_characters(self):
        malicious_query = 'gpu,or(id.gt.0):%bad"(term)'
        sanitized = sanitize_postgrest_term(malicious_query)
        assert "," not in sanitized
        assert ":" not in sanitized
        assert "(" not in sanitized
        assert ")" not in sanitized
        assert "%" not in sanitized
        assert '"' not in sanitized
        assert "[" not in sanitized
        assert "]" not in sanitized
        assert "gpu" in sanitized
        assert "bad" in sanitized

    def test_sanitize_postgrest_term_preserves_safe_terms(self):
        safe_query = "Nvidia RTX 5090 & AI chips"
        sanitized = sanitize_postgrest_term(safe_query)
        assert sanitized == "Nvidia RTX 5090 & AI chips"


class TestPydanticInputBoundaries:
    """Tests ensuring schema boundaries prevent parameter abuse."""

    def test_search_site_request_enforces_limit_max_15(self):
        with pytest.raises(ValidationError):
            SearchSiteRequest(
                websites=["https://www.tomshardware.com"],
                searchTerms="hardware",
                limit=16,  # Exceeds le=15
                day_from=1,
                month_from=1,
                year_from=2026,
                day_to=14,
                month_to=9,
                year_to=2026,
            )

    def test_search_database_request_enforces_limit_bounds(self):
        # Exceeds max 50
        with pytest.raises(ValidationError):
            SearchDatabaseRequest(limit=51)

        # Below min 1
        with pytest.raises(ValidationError):
            SearchDatabaseRequest(limit=0)

        # Valid limit within bounds
        req = SearchDatabaseRequest(limit=25)
        assert req.limit == 25


class TestBoundedSessionMemory:
    """Tests confirming in-memory session caches are bounded to prevent memory exhaustion."""

    def test_session_caches_are_ttl_caches(self):
        assert isinstance(session_json_dicts, TTLCache)
        assert isinstance(session_email_dicts, TTLCache)
        assert session_json_dicts.maxsize == 1000
        assert session_email_dicts.maxsize == 1000
        assert session_json_dicts.ttl == 3600
        assert session_email_dicts.ttl == 3600

    def test_session_cache_evicts_at_capacity(self):
        test_cache = TTLCache(maxsize=3, ttl=300)
        test_cache["key1"] = "val1"
        test_cache["key2"] = "val2"
        test_cache["key3"] = "val3"
        test_cache["key4"] = "val4"
        assert len(test_cache) == 3
        assert "key1" not in test_cache
        assert "key4" in test_cache


class TestRateLimiterConfiguration:
    """Tests verifying rate limiter setup on the FastAPI application."""

    def test_limiter_is_attached_to_app_state(self):
        assert hasattr(app.state, "limiter")
        assert app.state.limiter is not None


class TestSsrfProtection:
    """Tests ensuring SSRF protection rejects private, link-local, and loopback IPs."""

    @pytest.mark.parametrize("blocked_url", [
        "http://127.0.0.1:8000/internal",
        "http://localhost:5000/admin",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/sensitive",
        "http://192.168.1.1/router",
        "http://172.16.0.1/dashboard",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "http://0.0.0.0/internal",
    ])
    def test_is_safe_external_url_blocks_internal_and_unsafe_targets(self, blocked_url):
        assert is_safe_external_url(blocked_url) is False

    def test_is_safe_external_url_allows_valid_public_domain(self):
        # Public internet domain should resolve safely
        assert is_safe_external_url("https://www.google.com") is True

    def test_ensure_preview_in_content_does_not_fetch_private_ips(self):
        rows = [
            {"content": "<div>Some article without preview</div>", "url": "http://127.0.0.1:8000/admin"},
            {"content": "<div>Another article</div>", "url": "http://169.254.169.254/metadata"},
            {"content": "<div>Private class A</div>", "url": "http://10.0.0.5/secret"},
        ]
        with patch("requests.get") as mock_get:
            result = ensure_preview_in_content(rows)
            # Ensure requests.get was NEVER invoked for loopback/link-local/private URLs
            mock_get.assert_not_called()
            assert len(result) == 3

    @pytest.mark.parametrize("scraper_fn", [
        search_toms_hardware,
        search_pc_mag,
        search_the_pc_enthusiast,
        search_hothardware,
        search_pc_perspective,
        search_gamerant,
        search_windows_central,
        search_tech_radar,
    ])
    def test_scrapers_reject_internal_website_urls(self, scraper_fn):
        with patch("requests.get") as mock_get:
            result = scraper_fn(website_url="http://127.0.0.1:8000/internal", search_terms=["MSI"])
            mock_get.assert_not_called()
            assert len(result) == 0

    def test_scraper_skips_internal_article_links(self):
        malicious_search_html = """
        <div class="listingResults">
            <div class="listingResult">
                <span style="white-space:nowrap">Attacker</span>
                <a class="article-link" href="http://169.254.169.254/latest/meta-data/" aria-label="Cloud Meta">Link</a>
                <time class="date-with-prefix">1 May 25</time>
            </div>
            <div class="listingResult">
                <span style="white-space:nowrap">Attacker 2</span>
                <a class="article-link" href="http://10.0.0.1/admin" aria-label="Internal Admin">Link</a>
                <time class="date-with-prefix">1 May 25</time>
            </div>
        </div>
        """
        def mock_get(url, *args, **kwargs):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = malicious_search_html
            return mock_resp

        with patch("requests.get", side_effect=mock_get) as mock_get_spy:
            result = search_toms_hardware(
                website_url="https://www.tomshardware.com/search",
                search_terms=["MSI"],
                keywords=["MSI"],
                article_limit=5
            )
            # Only the initial search request should have been made;
            # the two malicious article links (169.254.169.254 and 10.0.0.1) must be rejected
            assert mock_get_spy.call_count == 1
            assert len(result) == 0

