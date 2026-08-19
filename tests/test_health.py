def test_health_check(client):
    """Test /api/health endpoint returns 200 OK and valid JSON structure."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
