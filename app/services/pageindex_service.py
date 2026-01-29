"""
PageIndex Service - 处理 PDF 文档的结构化索引和检索
使用公开库实现 PDF 文档的智能索引和搜索
"""

import os
import json
import uuid
import tempfile
import re
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

# 尝试导入 PDF 处理库
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    from PyPDF2 import PdfReader
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False

from app.services.minio_service import minio_service
from sqlalchemy.ext.asyncio import AsyncSession


class PageIndexService:
    """PageIndex 服务 - 处理 PDF 文档的结构化索引"""

    def __init__(self):
        self.index_base_dir = tempfile.gettempdir()

    async def _extract_text_from_pdf_enhanced(self, pdf_path: str, ocr_resource=None) -> List[Dict[str, Any]]:
        """
        提取 PDF 内容，如果提供 OCR 资源则使用 OCR，否则使用标准库
        """
        if ocr_resource:
            from app.services.document_service import document_service
            try:
                # Use document_service parsers
                if ocr_resource.type == "ocr_paddle":
                    text = await document_service._run_paddleocr(pdf_path, ocr_resource.endpoint)
                elif ocr_resource.type == "mineru":
                    text = await document_service._run_mineru(pdf_path, ocr_resource.endpoint)
                elif ocr_resource.type in ["ocr_deepseek", "vision_llm"]:
                    text = await document_service._run_vision_llm_parser(pdf_path, ocr_resource)
                else:
                    text = None
                
                if text:
                    # Simple strategy: treat the whole text as page 1 if we can't easily split
                    # Better: split by common page markers like "--- 第 X 页 ---"
                    pages = []
                    parts = re.split(r'--- 第 \d+ 页 ---', text)
                    if len(parts) > 1:
                        for i, part in enumerate(parts[1:], 1):
                            pages.append({
                                "page_num": i,
                                "text": part.strip(),
                                "char_count": len(part.strip())
                            })
                    else:
                        pages.append({
                            "page_num": 1,
                            "text": text,
                            "char_count": len(text)
                        })
                    return pages
            except Exception as e:
                print(f"[PageIndex] Enhanced extraction failed: {e}, falling back to standard.")

        return self._extract_text_from_pdf(pdf_path)

    def _extract_text_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        从 PDF 提取文本内容，按页返回
        返回: [{"page_num": 1, "text": "..."}, ...]
        """
        pages = []

        # 优先使用 pdfplumber
        if HAS_PDFPLUMBER:
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    for i, page in enumerate(pdf.pages, 1):
                        text = page.extract_text() or ""
                        pages.append({
                            "page_num": i,
                            "text": text,
                            "char_count": len(text)
                        })
                return pages
            except Exception as e:
                print(f"[PageIndex] pdfplumber extraction failed: {e}")

        # 备用：使用 PyPDF2
        if HAS_PYPDF2:
            try:
                reader = PdfReader(pdf_path)
                for i, page in enumerate(reader.pages, 1):
                    text = page.extract_text() or ""
                    pages.append({
                        "page_num": i,
                        "text": text,
                        "char_count": len(text)
                    })
                return pages
            except Exception as e:
                print(f"[PageIndex] PyPDF2 extraction failed: {e}")

        return []

    def _detect_structure(self, pages: List[Dict[str, Any]], filename: str) -> List[Dict[str, Any]]:
        """
        自动检测 PDF 文档结构，生成索引节点

        简单策略：根据字体大小、位置等特征识别章节标题
        """
        if not pages:
            return []

        structure = []
        node_id_counter = 0

        # 分析每页内容，识别可能的标题
        for i, page in enumerate(pages):
            text = page["text"]
            page_num = page["page_num"]

            # 按行分割
            lines = text.split('\n')

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # 简单的标题识别规则
                is_title = self._is_likely_title(line)

                if is_title:
                    # 生成摘要（取标题后几行作为摘要）
                    summary_start = lines.index(line) + 1
                    summary_lines = []
                    for j in range(summary_start, min(summary_start + 5, len(lines))):
                        if lines[j].strip():
                            summary_lines.append(lines[j].strip())

                    # 如果没有后续内容，使用下一页
                    if not summary_lines and i + 1 < len(pages):
                        next_page_text = pages[i + 1]["text"]
                        next_lines = next_page_text.split('\n')[:3]
                        summary_lines = [l.strip() for l in next_lines if l.strip()]

                    summary = " ".join(summary_lines) if summary_lines else line

                    structure.append({
                        "title": line,
                        "start_index": page_num,
                        "end_index": page_num,
                        "node_id": f"{node_id_counter:04d}",
                        "summary": summary[:500]  # 限制摘要长度
                    })
                    node_id_counter += 1

        # 如果没有检测到结构，创建一个包含全部文档的节点
        if not structure and pages:
            first_page = pages[0]["text"]
            summary = first_page[:500] if len(first_page) > 500 else first_page

            structure.append({
                "title": filename,
                "start_index": 1,
                "end_index": len(pages),
                "node_id": "0000",
                "summary": summary
            })

        return structure

    def _is_likely_title(self, line: str) -> bool:
        """判断一行文本是否可能是标题"""
        if not line:
            return False

        # 过短不太可能是标题
        if len(line) < 3:
            return False

        # 过长不太可能是标题
        if len(line) > 100:
            return False

        # 全数字或特殊字符不太可能是标题
        if line.isdigit():
            return False

        # 常见的标题模式
        title_patterns = [
            r'^第.+[章节篇]',  # 第X章/节/篇
            r'^[一二三四五六七八九十]+[、.]\s*\w+',  # 中文序号
            r'^\d+[、.]\s*\w+',  # 数字序号
            r'^[A-Z][A-Z\s]+$',  # 全大写英文
            r'^\d+\.\s+[A-Z]',  # 数字点 + 大写字母
        ]

        for pattern in title_patterns:
            if re.match(pattern, line):
                return True

        # 包含"章"、"节"、"篇"等字
        if any(keyword in line for keyword in ['章', '节', '篇', 'Chapter', 'Section']):
            return True

        # 相对较短且以句号结尾的不太可能是标题
        if line.endswith('。') or line.endswith('.'):
            return False

        # 相对较短的行（可能是标题）
        if len(line) < 50:
            return True

        return False

    async def process_pdf_document(
        self,
        file_path: str,
        filename: str,
        kb_id: str,
        doc_id: str,
        session: Optional[AsyncSession] = None
    ) -> Dict[str, Any]:
        """
        处理 PDF 文档，生成结构化索引
        """
        try:
            print(f"[PageIndex] Processing {filename}...")
            
            # Get parser_type from KB if session provided
            parser_type = "PaddleOCR"
            if session:
                from app.models.knowledge import KnowledgeBase
                kb = await session.get(KnowledgeBase, uuid.UUID(kb_id))
                if kb:
                    parser_type = kb.parser_type
            
            # Check for parser resource
            from app.services.ai_resource_service import AiResourceService
            from app.services.document_service import document_service
            
            ocr_resource = None
            if session:
                ai_service = AiResourceService(session)
                parser_type_map = {
                    "DeepSeek OCR": "ocr_deepseek",
                    "PaddleOCR": "ocr_paddle",
                    "Vision LLM": "vision_llm",
                    "MinerU": "mineru"
                }
                resource_type = parser_type_map.get(parser_type, "ocr_paddle")
                ocr_resources = await ai_service.list_resources(type_filter=resource_type, only_enabled=True)
                ocr_resource = ocr_resources[0] if ocr_resources else None

            # 1. 提取页面内容
            # If ocr_resource is available, we should ideally use it.
            # However, _extract_text_from_pdf currently only uses pdfplumber/PyPDF2.
            # For PageIndex, we need page-by-page text.
            # Let's adapt _extract_text_from_pdf to handle OCR if available.
            
            page_contents = await self._extract_text_from_pdf_enhanced(file_path, ocr_resource)

            if not page_contents:
                return {
                    "success": False,
                    "error": "Failed to extract text from PDF"
                }

            # 2. 生成结构化索引
            structure = self._detect_structure(page_contents, filename)

            # 3. 构建索引数据
            index_data = {
                "doc_name": filename,
                "doc_id": doc_id,
                "total_pages": len(page_contents),
                "structure": structure
            }

            # 4. 构建内容数据
            content_data = {
                "doc_name": filename,
                "doc_id": doc_id,
                "total_pages": len(page_contents),
                "pages": {}
            }

            for page in page_contents:
                content_data["pages"][str(page["page_num"])] = page

            # 5. 保存到 MinIO
            await self._save_to_minio(kb_id, doc_id, filename, index_data, content_data)

            print(f"[PageIndex] Successfully processed {filename}")
            return {
                "success": True,
                "index_data": index_data,
                "content_data": content_data,
                "total_pages": len(page_contents),
                "node_count": len(structure)
            }

        except Exception as e:
            import traceback
            error_detail = f"{str(e)}\n{traceback.format_exc()}"
            print(f"[PageIndex] Error processing {filename}: {error_detail}")
            return {
                "success": False,
                "error": error_detail
            }

    async def _save_to_minio(
        self,
        kb_id: str,
        doc_id: str,
        filename: str,
        index_data: Dict[str, Any],
        content_data: Dict[str, Any]
    ):
        """保存索引和内容数据到 MinIO"""
        import io

        # 保存索引文件
        index_json = json.dumps(index_data, ensure_ascii=False, indent=2)
        index_bytes = index_json.encode('utf-8')
        index_path = f"{kb_id}/pageindex/{doc_id}_index.json"
        minio_service.upload_stream(
            io.BytesIO(index_bytes),
            index_path,
            len(index_bytes),
            content_type="application/json"
        )

        # 保存内容文件
        content_json = json.dumps(content_data, ensure_ascii=False, indent=2)
        content_bytes = content_json.encode('utf-8')
        content_path = f"{kb_id}/pageindex/{doc_id}_content.json"
        minio_service.upload_stream(
            io.BytesIO(content_bytes),
            content_path,
            len(content_bytes),
            content_type="application/json"
        )

        print(f"[PageIndex] Saved index to {index_path}")
        print(f"[PageIndex] Saved content to {content_path}")

    async def load_index_data(
        self,
        kb_id: str,
        doc_id: str
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """从 MinIO 加载索引和内容数据"""
        try:
            # 加载索引文件
            index_path = f"{kb_id}/pageindex/{doc_id}_index.json"
            index_response = minio_service.get_object(index_path)
            index_content = index_response.read().decode('utf-8')
            index_data = json.loads(index_content)
            index_response.close()
            index_response.release_conn()

            # 加载内容文件
            content_path = f"{kb_id}/pageindex/{doc_id}_content.json"
            content_response = minio_service.get_object(content_path)
            content_json = content_response.read().decode('utf-8')
            content_data = json.loads(content_json)
            content_response.close()
            content_response.release_conn()

            return index_data, content_data

        except Exception as e:
            print(f"[PageIndex] Error loading data: {e}")
            return None, None

    def search_nodes(
        self,
        question: str,
        structure: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        基于问题搜索相关节点
        使用标题和摘要进行关键词匹配
        """
        if not structure:
            return []

        # 提取问题中的关键词
        stop_words = {'的', '了', '是', '在', '有', '和', '与', '或', '什么', '怎么', '如何', '吗', '呢', '吧', '啊', '？', '?', '！', '!', '，', ',', '。', '.', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in'}
        keywords = [w for w in question.split() if w not in stop_words and len(w) > 1]

        if not keywords:
            return structure[:top_k]

        # 计算每个节点的相关分数
        scores = []
        for node in structure:
            score = 0
            title = node.get('title', '')
            summary = node.get('summary', '')
            text = f"{title} {summary}".lower()

            for keyword in keywords:
                keyword_lower = keyword.lower()
                if keyword_lower in text:
                    # 标题匹配权重更高
                    if keyword_lower in title.lower():
                        score += 3
                    else:
                        score += 1

            scores.append({
                'node': node,
                'score': score
            })

        # 按分数排序
        scores.sort(key=lambda x: x['score'], reverse=True)

        if scores[0]['score'] == 0:
            return [s['node'] for s in scores[:top_k]]

        return [s['node'] for s in scores[:top_k] if s['score'] > 0]

    def extract_pages_from_nodes(
        self,
        content_data: Dict[str, Any],
        nodes: List[Dict[str, Any]],
        max_tokens: int = 8000
    ) -> List[Dict[str, Any]]:
        """从节点中提取对应的页面内容"""
        if not content_data or not nodes:
            return []

        pages_data = content_data.get("pages", {})
        extracted_pages = []
        total_chars = 0
        char_limit = max_tokens * 2

        # 收集所有需要提取的页码
        page_nums = set()
        for node in nodes:
            start = node.get('start_index', 1)
            end = node.get('end_index', start)
            for p in range(start, end + 1):
                page_nums.add(p)

        # 按页码顺序提取
        for page_num in sorted(page_nums):
            page_key = str(page_num)
            if page_key in pages_data:
                page_info = pages_data[page_key]
                page_text = page_info.get("text", "")

                if total_chars + len(page_text) > char_limit and extracted_pages:
                    break

                extracted_pages.append({
                    "page_num": page_num,
                    "text": page_text
                })
                total_chars += len(page_text)

        return extracted_pages

    def build_rag_prompt(
        self,
        question: str,
        nodes: List[Dict[str, Any]],
        pages: List[Dict[str, Any]]
    ) -> str:
        """构建 RAG 提示词"""
        prompt_parts = []

        # 添加相关章节信息
        prompt_parts.append("# 相关章节信息\n")
        for node in nodes:
            title = node.get('title', '')
            start = node.get('start_index', '')
            end = node.get('end_index', '')
            summary = node.get('summary', '')
            prompt_parts.append(f"## {title}\n")
            prompt_parts.append(f"页码: {start}-{end}\n")
            prompt_parts.append(f"摘要: {summary}\n")

        # 添加原始页面内容
        prompt_parts.append("\n# 原始文档内容\n")
        for page in pages:
            prompt_parts.append(f"\n--- 第 {page['page_num']} 页 ---\n")
            prompt_parts.append(page['text'])

        # 添加用户问题
        prompt_parts.append(f"\n# 用户问题\n{question}")
        prompt_parts.append("\n\n请基于上述文档内容回答问题。如果信息不足，请说明。")

        return "\n".join(prompt_parts)

    async def search(
        self,
        kb_id: str,
        doc_id: str,
        question: str,
        top_k: int = 5,
        use_rag: bool = False
    ) -> Dict[str, Any]:
        """
        搜索文档
        """
        index_data, content_data = await self.load_index_data(kb_id, doc_id)

        if not index_data:
            return {
                "error": "Index data not found. Please process the document first."
            }

        structure = index_data.get("structure", [])

        # 搜索相关节点
        relevant_nodes = self.search_nodes(question, structure, top_k)

        if not relevant_nodes:
            return {
                "nodes": [],
                "pages": [],
                "prompt": None
            }

        # 提取页面内容
        pages = []
        prompt = None
        if content_data:
            pages = self.extract_pages_from_nodes(content_data, relevant_nodes)
            if use_rag:
                prompt = self.build_rag_prompt(question, relevant_nodes, pages)

        return {
            "nodes": relevant_nodes,
            "pages": pages,
            "prompt": prompt
        }


# 全局实例
pageindex_service = PageIndexService()
