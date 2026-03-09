"""
Configuration module for WealthHub Backend
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # API Settings
    API_TITLE: str = "WealthHub Backend API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # CORS Settings - supports multiple URLs comma-separated
    FRONTEND_URL: str = "http://localhost:3000,http://frontend:5173"
    
    # Database configuration
    DATABASE_URL: str = "postgresql+asyncpg://wealthhub:wealthhub_password@localhost:5432/wealthhub"
    
    # Price Fetcher Settings
    TIMEOUT: int = 30
    RETRIES: int = 3
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
