import os
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "y", "on"}


class Settings:
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "coursemap_ai")

    GEMINI_API_KEY: str = (
        os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
    )
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_USE_VERTEX: bool = _bool("GEMINI_USE_VERTEX", "false")
    GEMINI_PROJECT: str = os.getenv("GEMINI_PROJECT", "")
    GEMINI_LOCATION: str = os.getenv("GEMINI_LOCATION", "global")

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-only-change-me-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRATION_HOURS: int = int(os.getenv("JWT_EXPIRATION_HOURS", "168"))


settings = Settings()