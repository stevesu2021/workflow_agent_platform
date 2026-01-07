#!/bin/bash
mkdir -p /home/steve/miniIO_data/

if docker inspect minio >/dev/null 2>&1; then
    echo "MinIO container exists. Starting it..."
    docker start minio
else
    echo "Starting new MinIO container..."
    docker run -d \
      -p 9000:9000 \
      -p 9001:9001 \
      -v /home/steve/miniIO_data/:/data \
      -e "MINIO_ROOT_USER=minioadmin" \
      -e "MINIO_ROOT_PASSWORD=minioadmin" \
      --name minio \
      quay.io/minio/minio server /data --console-address ":9001"
fi

echo "MinIO started on port 9000 (API) and 9001 (Console)"
