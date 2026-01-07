from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./agentflow.db"
    SECRET_KEY: str = "supersecretkey"
    
    # MinIO Settings
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "agentflow-data"
    MINIO_SECURE: bool = False
    
    class Config:
        env_file = ".env"

settings = Settings()
