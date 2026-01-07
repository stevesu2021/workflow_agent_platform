import sys
import os
sys.path.append(os.getcwd())

from app.services.minio_service import minio_service
import io

def test_minio():
    print("Testing MinIO integration...")
    
    # 1. Upload
    content = b"Hello MinIO!"
    object_name = "test/hello.txt"
    print(f"Uploading to {object_name}...")
    minio_service.upload_stream(io.BytesIO(content), object_name, len(content))
    
    # 2. Check existence (by getting object)
    print("Verifying upload...")
    try:
        data = minio_service.get_object(object_name)
        downloaded = data.read()
        print(f"Downloaded content: {downloaded}")
        assert downloaded == content
        print("Verification successful!")
    except Exception as e:
        print(f"Verification failed: {e}")
        return

    # 3. Test file download to path
    tmp_path = "temp_hello.txt"
    print(f"Testing download to {tmp_path}...")
    minio_service.download_file(object_name, tmp_path)
    with open(tmp_path, "rb") as f:
        assert f.read() == content
    os.remove(tmp_path)
    print("Download to file successful!")

if __name__ == "__main__":
    test_minio()
