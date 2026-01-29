import asyncio
import os
import sys
import json
import argparse
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.pageindex_service import pageindex_service

async def test_pageindex(file_path, use_ocr=False, ocr_endpoint=None, ocr_type="ocr_paddle"):
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return

    print(f"[*] Testing PageIndex for: {file_path}")
    filename = os.path.basename(file_path)

    # 1. Extract text
    print("[*] Extracting text...")
    ocr_resource = None
    if use_ocr and ocr_endpoint:
        class MockResource:
            def __init__(self, endpoint, rtype):
                self.endpoint = endpoint
                self.type = rtype
        ocr_resource = MockResource(ocr_endpoint, ocr_type)
        print(f"[*] Using OCR ({ocr_type}) at {ocr_endpoint}")

    page_contents = await pageindex_service._extract_text_from_pdf_enhanced(file_path, ocr_resource)
    
    if not page_contents:
        print("[!] Failed to extract text content.")
        return

    print(f"[*] Successfully extracted {len(page_contents)} pages.")

    # 2. Detect structure
    print("[*] Detecting structure...")
    structure = pageindex_service._detect_structure(page_contents, filename)

    print("\n" + "="*50)
    print(f"STRUCTURE DETECTED ({len(structure)} nodes):")
    print("="*50)
    
    for node in structure:
        print(f"ID: {node['node_id']}")
        print(f"Title: {node['title']}")
        print(f"Pages: {node['start_index']} - {node['end_index']}")
        print(f"Summary: {node['summary'][:200]}...")
        print("-" * 30)

    # Output to JSON file for further inspection
    output_file = f"{filename}_pageindex_result.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "filename": filename,
            "total_pages": len(page_contents),
            "structure": structure,
            "pages": page_contents
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n[*] Full results saved to: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test PageIndex PDF processing")
    parser.add_argument("file", help="Path to the PDF file")
    parser.add_argument("--ocr", action="store_true", help="Use OCR for extraction")
    parser.add_argument("--endpoint", help="OCR server endpoint")
    parser.add_argument("--type", default="ocr_paddle", help="OCR type (ocr_paddle, mineru, vision_llm)")

    args = parser.parse_args()
    
    asyncio.run(test_pageindex(args.file, args.ocr, args.endpoint, args.type))
