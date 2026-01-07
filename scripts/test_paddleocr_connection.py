import sys
import os
import json
import argparse

# Try importing, if fails (because running in wrong env), print friendly error
try:
    from paddleocr import PaddleOCRVL
except ImportError:
    print(json.dumps({"status": "error", "message": "paddleocr module not found. Ensure running in paddleocr_vlm environment."}))
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server_url", required=True)
    parser.add_argument("--file_path", required=True)
    args = parser.parse_args()

    try:
        # Initialize pipeline with vllm backend
        pipeline = PaddleOCRVL(vl_rec_backend="vllm-server", vl_rec_server_url=args.server_url)
        
        # Check if file exists
        if not os.path.exists(args.file_path):
             print(json.dumps({"status": "error", "message": f"File not found: {args.file_path}"}))
             sys.exit(1)

        output = pipeline.predict(args.file_path)
        
        markdown_list = []
        for res in output:
             markdown_list.append(res._to_markdown())
        
        total_res = pipeline.concatenate_markdown_pages(markdown_list)
        
        # Print result as JSON to stdout for the caller to parse
        print(json.dumps({
            "status": "success",
            "markdown": total_res
        }))
        
    except Exception as e:
        # Capture any exception and print as JSON
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
