from minio import Minio
from minio.error import S3Error
from app.core.config import settings
import io
import os

class MinioService:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        """Lazy initialization of Minio client to pick up config changes"""
        if self._client is None:
            self._client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )
        return self._client

    @property
    def bucket(self):
        """Read bucket from settings dynamically"""
        return settings.MINIO_BUCKET

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
