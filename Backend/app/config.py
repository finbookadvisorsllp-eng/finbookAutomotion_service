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
    
    # Default Database Name to fetch data for Friends Grafix FY 2024-25
    DEFAULT_DB_NAME: str = "sf_tenant_6a182ee36efd32db3c490a6c"

settings = Settings()
