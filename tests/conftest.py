import pytest
import sys
import os

# Add backend directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", message=".*httpx.*")

# Set dummy env vars for CI/testing if not already set in environment
os.environ.setdefault("GROQ_API_KEY", "mock_groq_api_key_for_testing")
os.environ.setdefault("RESEND_APIKEY", "mock_resend_api_key_for_testing")
os.environ.setdefault("SUPABASE_URL", "https://mock.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "mock_supabase_key_for_testing")
os.environ.setdefault("BUILD_ENV", "test")

from fastapi.testclient import TestClient
from app import app

@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client
