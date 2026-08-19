from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class EmailRequest(BaseModel):
    data: List[str] = Field(..., description="List of article URLs")
    email_address: str = Field(..., description="Recipient email address")

class SaveDatabaseRequest(BaseModel):
    data: List[str] = Field(..., description="List of article URLs to save")

class SearchSiteRequest(BaseModel):
    websites: List[int] = Field(default=[0])
    searchTerms: str = Field(default="MSI")
    limit: int = Field(default=1, ge=1, le=100)
    day_from: int = Field(default=1, ge=1, le=31)
    month_from: int = Field(default=1, ge=1, le=12)
    year_from: int = Field(default=2025)
    day_to: Optional[int] = 0
    month_to: Optional[int] = 0
    year_to: Optional[int] = 0
    keywords: Optional[str] = ""
    customPrompt: Optional[str] = ""

class SearchDatabaseRequest(BaseModel):
    websites: List[str] = Field(default=["Tom's Hardware"])
    searchTerms: str = Field(default="MSI")
    limit: int = Field(default=0)
    keywords: Optional[str] = ""
    urls: Optional[str] = ""
    day_from: int = 0
    month_from: int = 0
    year_from: int = 0
    day_to: int = 0
    month_to: int = 0
    year_to: int = 0
