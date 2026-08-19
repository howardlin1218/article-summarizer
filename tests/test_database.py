import pytest
from unittest.mock import patch

from app import session_json_dicts

def test_save_to_database_not_found(client):
    """Test /api/save-to-database returns 404 when no matching articles exist in session."""
    payload = {
        "data": ["https://www.tomshardware.com/news/non-existent"]
    }
    response = client.post("/api/save-to-database", json=payload)
    assert response.status_code == 404
    assert "No matching articles found" in response.json()["detail"]

def test_save_to_database_endpoint_success(client):
    """Test /api/save-to-database endpoint succeeds (200 OK) when matching article exists in session."""
    test_url = "https://www.tomshardware.com/news/test"
    with patch("app.get_or_create_session_id", return_value="test_session_id"), \
         patch("app.insert_to_supabase") as mock_upsert:
            
        session_json_dicts["test_session_id"] = {
            test_url: {"url": test_url, "title": "Test Title"}
        }
        
        payload = {
            "data": [test_url]
        }
        response = client.post("/api/save-to-database", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert "Saved 1 article(s)" in response.json()["message"]

def test_recent_saves_endpoint(client):
    """Test /api/recent-saves GET endpoint returns recent articles."""
    mock_db_data = [
        {
            "url": "https://www.tomshardware.com/news/1",
            "content": "<div class='article-container'><input value='https://www.tomshardware.com/news/1' type='checkbox' name='articleCheckBox' />Article 1 Content</div>"
        }
    ]
    with patch("app.get_recent_10_articles", return_value=mock_db_data):
        response = client.get("/api/recent-saves")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Article 1 Content" in data["html"]

def test_all_saved_endpoint(client):
    """Test /api/all-saved GET endpoint returns all saved articles."""
    mock_db_data = [
        {
            "url": "https://www.tomshardware.com/news/1",
            "content": "<div class='article-container'><input value='https://www.tomshardware.com/news/1' type='checkbox' name='articleCheckBox' />Article 1 Content</div>"
        },
        {
            "url": "https://www.pcmag.com/news/2",
            "content": "<div class='article-container'><input value='https://www.pcmag.com/news/2' type='checkbox' name='articleCheckBox' />Article 2 Content</div>"
        }
    ]
    with patch("app.get_all_saved", return_value=mock_db_data):
        response = client.get("/api/all-saved")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Article 1 Content" in data["html"]
        assert "Article 2 Content" in data["html"]

def test_search_database_endpoint(client):
    """Test /api/search-database POST endpoint with filter parameters."""
    mock_db_data = [
        {
            "url": "https://www.tomshardware.com/news/1",
            "content": "<div class='article-container'>Searched Article Content</div>"
        }
    ]
    with patch("app.search_for_articles", return_value=mock_db_data):
        payload = {
            "websites": ["Tom's Hardware"],
            "searchTerms": "MSI",
            "limit": 5,
            "year_from": 2025,
            "month_from": 1,
            "day_from": 1,
            "year_to": 2025,
            "month_to": 12,
            "day_to": 31
        }
        response = client.post("/api/search-database", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Searched Article Content" in data["html"]
