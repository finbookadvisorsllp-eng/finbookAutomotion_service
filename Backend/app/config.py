import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file inside Automation_Backend/
dotenv_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=dotenv_path)

class Settings:
    # Use MONGO_URI, default to local if not specified
    MONGO_URI: str = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017"
    
    # Default Database Name to fetch data locally
    DEFAULT_DB_NAME: str = "finbook_23aafff9731l1z7"

    # Shared IAM Authentication settings
    IAM_DB_NAME: str = os.getenv("IAM_DB_NAME") or "iam"
    JWT_SECRET: str = os.getenv("JWT_SECRET") or "finbook-shared-secret-key-39281a8b3d0"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES") or "60")
    JWT_REFRESH_EXPIRE_MINUTES: int = int(os.getenv("JWT_REFRESH_EXPIRE_MINUTES") or "10080")

    # AI LLM settings
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY")
    NVIDIA_BASE_URL: str = os.getenv("NVIDIA_BASE_URL") or "https://integrate.api.nvidia.com/v1"
    LLM_MODEL: str = os.getenv("LLM_MODEL") or "meta/llama-3.1-70b-instruct"
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY")

settings = Settings()


