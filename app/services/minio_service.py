from minio import Minio
from minio.error import S3Error
from app.core.config import settings
import io
import os

class MinioService:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self.bucket = settings.MINIO_BUCKET
        # We try to create bucket on init, but it might fail if minio is not up yet.
        # So we might want to do it lazily or just log error.
        try:
            self._ensure_bucket()
        except Exception as e:
            print(f"Warning: Could not ensure MinIO bucket exists: {e}")

    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload_stream(self, stream, object_name: str, length: int, content_type: str = "application/octet-stream"):
        self._ensure_bucket()
        self.client.put_object(
            self.bucket,
            object_name,
            stream,
            length,
            content_type=content_type
        )
    
    def upload_file(self, file_path: str, object_name: str, content_type: str = "application/octet-stream"):
        self._ensure_bucket()
        self.client.fput_object(
            self.bucket,
            object_name,
            file_path,
            content_type=content_type
        )

    def download_file(self, object_name: str, file_path: str):
        self.client.fget_object(self.bucket, object_name, file_path)

    def get_object(self, object_name: str):
        return self.client.get_object(self.bucket, object_name)

minio_service = MinioService()
