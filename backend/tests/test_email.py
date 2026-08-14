import pytest
from unittest.mock import patch

def test_email_missing_fields(client):
    """Test /api/email-to-user with empty fields fails validation."""
    payload = {
        "data": [],
        "email_address": ""
    }
    response = client.post("/api/email-to-user", json=payload)
    assert response.status_code == 400
    assert "valid email address" in response.json()["detail"]

def test_email_invalid_format(client):
    """Test /api/email-to-user with invalid email string fails validation."""
    payload = {
        "data": ["https://example.com/article1"],
        "email_address": "invalid-email-address"
    }
    response = client.post("/api/email-to-user", json=payload)
    assert response.status_code == 400
    assert "valid email address" in response.json()["detail"]

def test_email_success(client):
    """Test /api/email-to-user success response when provider accepts email."""
    with patch("app.send_email", return_value=True):
        payload = {
            "data": ["https://example.com/article1"],
            "email_address": "user@example.com"
        }
        response = client.post("/api/email-to-user", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "success"

def test_email_provider_failure(client):
    """Test /api/email-to-user handles 3rd party provider rejection (502 Bad Gateway)."""
    with patch("app.send_email", return_value=False):
        payload = {
            "data": ["https://example.com/article1"],
            "email_address": "user@example.com"
        }
        response = client.post("/api/email-to-user", json=payload)
        assert response.status_code == 502
        assert "provider rejected" in response.json()["detail"]
