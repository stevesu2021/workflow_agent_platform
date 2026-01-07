conda run -n paddleocr_vlm --no-capture-output \
    paddleocr genai_server \
        --model_name PaddleOCR-VL-0.9B \
        --backend vllm \
        --port 8118