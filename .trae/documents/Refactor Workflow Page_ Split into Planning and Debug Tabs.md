# Knowledge Base Implementation Plan

This plan outlines the steps to implement a comprehensive Knowledge Base system, including document management, parsing, chunking (slicing), and vector search capabilities.

## 1. Backend Implementation

### 1.1 Dependencies

* Add `chromadb` (Vector Store) to `requirements.txt`.

* Add `pypdf` (PDF Parsing) to `requirements.txt`.

* Add `python-docx` (Word Parsing) to `requirements.txt`.

* Add `tiktoken` (Token counting for accurate slicing) to `requirements.txt`.

### 1.2 Data Models (`app/models/knowledge.py`)

* **`KnowledgeBase`**:

  * `id`: UUID

  * `name`: String

  * `description`: String

  * `created_at`: DateTime

  * `updated_at`: DateTime

* **`Document`**:

  * `id`: UUID

  * `knowledge_base_id`: UUID (Foreign Key)

  * `filename`: String

  * `file_path`: String (Local storage path)

  * `status`: String (Enum: pending, processing, completed, error)

  * `error_message`: String

  * `created_at`: DateTime

  * `chunk_count`: Integer

### 1.3 Schemas (`app/schemas/knowledge.py`)

* Define Pydantic models for API Request/Response:

  * `KnowledgeBaseCreate`, `KnowledgeBaseResponse`

  * `DocumentResponse`

  * `SearchRequest` (query, top\_k)

  * `SearchResponse` (results with score and content)

### 1.4 Services

* **`app/services/vector_service.py`**:

  * Initialize `ChromaDB` client (persistent local storage).

  * Method `add_texts(collection_name, texts, metadatas)`: Store chunks.

  * Method `search(collection_name, query, top_k)`: Retrieve relevant chunks.

  * Method `delete_collection(collection_name)`: Cleanup.

* **`app/services/document_service.py`**:

  * **Parsing**: Implement handlers for `.txt`, `.md`, `.pdf`, `.docx`.

  * **Slicing (Chunking)**: Use LangChain's `RecursiveCharacterTextSplitter` with configurable chunk size (default 1000) and overlap (default 200).

  * **Processing Pipeline**:

    1. Load file.
    2. Split text.
    3. Generate Embeddings (using a default `OpenAIEmbeddings` or mock if API key missing).
    4. Store in Vector Service.
    5. Update Document status.

### 1.5 API Endpoints (`app/api/knowledge.py`)

* `GET /knowledge-bases`: List all KBs.

* `POST /knowledge-bases`: Create a new KB.

* `GET /knowledge-bases/{id}`: Get KB details and document list.

* `DELETE /knowledge-bases/{id}`: Delete KB.

* `POST /knowledge-bases/{id}/upload`: Upload a file (multipart/form-data). Saves file and creates `Document` record.

* `POST /knowledge-bases/{id}/documents/{doc_id}/process`: Trigger parsing and slicing pipeline.

* `POST /knowledge-bases/{id}/search`: Perform vector search.

## 2. Frontend Implementation

### 2.1 API Client (`src/api/knowledge.ts`)

* Implement functions to call the new backend endpoints.

### 2.2 Components & Pages

* **`src/pages/KnowledgeBase/index.tsx`**: Main container.

* **`src/pages/KnowledgeBase/KnowledgeBaseList.tsx`**:

  * Table displaying KBs.

  * "Create Knowledge Base" Modal.

* **`src/pages/KnowledgeBase/KnowledgeBaseDetail.tsx`**:

  * **Header**: KB Name, stats.

  * **Upload Section**: File upload drag-and-drop area.

  * **Document List**: Table showing uploaded files, status (with badges), and "Process"/"Delete" actions.

  * **Search Playground**: A simple input box to test retrieval results from the KB.

## 3. Integration & Testing

* Register new router in `app/main.py`.

* Ensure file storage directory exists (e.g., `data/uploads`).

* Verify flow: Create KB -> Upload PDF -> Process (Chunk/Index) -> Search -> Verify Results.

