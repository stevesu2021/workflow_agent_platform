# Excel Knowledge Base with RAG

这是一个基于Excel数据构建知识库并支持RAG（检索增强生成）功能的Python项目。它允许用户通过自然语言查询Excel中的数据，并利用大语言模型生成准确的回答。

## 项目概述

本项目旨在将静态的Excel数据转化为可交互的知识库系统，利用向量检索技术实现对结构化数据的自然语言查询与智能问答。

### 核心功能

- **Excel知识库构建**: 将Excel文件内容向量化并存储为可检索的知识库
- **自然语言查询**: 用户可通过自然语言提问，系统返回基于Excel内容的答案
- **向量检索**: 使用高质量嵌入模型对Excel数据进行向量化检索
- **多维度检索**: 支持基于特定列的精确检索和全文检索
- **FastAPI服务**: 提供RESTful API接口，方便集成到其他应用

## 技术架构

- **嵌入模型**: 使用Qwen3-Embedding-0.6B模型进行文本向量化
- **数据处理**: 使用pandas处理Excel文件
- **向量存储**: 基于pickle的序列化存储
- **相似度计算**: 余弦相似度计算
- **Web框架**: FastAPI提供RESTful API
- **后端**: Python 3.x

## 项目结构

```
excel-knowledge-base/
├── config.py                    # 配置文件，管理环境变量
├── main.py                      # FastAPI服务入口
├── start_server.py              # 启动服务器脚本
├── start_server.sh              # Linux/Unix启动脚本
├── test_api.py                  # API测试脚本
├── prompt_excel_rag.txt         # 项目需求文档
├── requirements.txt             # 项目依赖
├── README.md                    # 项目说明文档
├── .env                         # 环境变量配置
├── excel_rag/                   # 核心功能模块
│   ├── embedding_model.py       # 嵌入模型封装
│   ├── rag_excel_knowledge_base.py  # 知识库构建模块
│   ├── rag_excel_knowledge_search.py # 知识库检索模块
│   ├── knowledge_base.pkl       # 生成的知识库文件
│   ├── knowledge_multi.pkl      # 生成的多维度知识库文件
│   └── test.xlsx                # 示例Excel文件
```

## 安装和配置

### 1. 环境要求

- Python 3.8+
- PyTorch (推荐CUDA版本)
- HuggingFace Transformers
- pandas
- FastAPI
- uvicorn

### 2. 安装依赖

```bash
pip install -r requirements.txt

# 安装PyTorch (如果尚未安装)
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu126
# 或CPU版本
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### 3. 模型配置

本项目使用Qwen3-Embedding-0.6B作为嵌入模型，您需要确保模型路径正确。默认路径为：

```
/home/steve/models/Qwen3-Embedding-0.6B/
```

如果模型在其他位置，请修改 [embedding_model.py](file:///home/steve/workspace/excel-knowledge-base/excel_rag/embedding_model.py) 中的 `MODEL_NAME` 常量。

### 4. 环境变量配置

创建 `.env` 文件并配置LLM相关参数：

```
MODEL_NAME=gpt-3.5-turbo
LLM_API_KEY=your_api_key
LLM_API_URL=https://api.openai.com/v1
TIMEOUT=30
```

## 使用方法

### 1. 启动FastAPI服务

#### 方法一：直接运行启动脚本

```bash
python start_server.py
```

#### 方法二：使用uvicorn命令

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

#### 方法三：开发模式（自动重载）

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后，您可以通过以下地址访问：
- API服务: http://localhost:8000
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 2. 构建知识库

通过API构建知识库：

```bash
curl -X POST "http://localhost:8000/build_knowledge_base" \
  -H "Content-Type: application/json" \
  -d '{
    "excel_file": "./excel_rag/test.xlsx",
    "tobe_included": ["系统名称", "系统编号"],
    "knowledge_base_file": "knowledge_base.pkl",
    "knowledge_multi_file": "knowledge_multi.pkl"
  }'
```

### 3. 检索知识库

通过API检索知识库：

```bash
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "系统编号: SYS-014",
    "top_k": 5
  }'
```

### 4. 使用Python客户端

```python
import requests

# 构建知识库
build_payload = {
    "excel_file": "./excel_rag/test.xlsx",
    "tobe_included": ["系统名称", "系统编号"],
    "knowledge_base_file": "knowledge_base.pkl",
    "knowledge_multi_file": "knowledge_multi.pkl"
}

response = requests.post("http://localhost:8000/build_knowledge_base", json=build_payload)
print(response.json())

# 搜索知识库
search_payload = {
    "query": "系统编号: SYS-014",
    "top_k": 5
}

response = requests.post("http://localhost:8000/search", json=search_payload)
results = response.json()["results"]
for result in results:
    print(f"相似度: {result['similarity']:.4f}")
    print(f"数据: {result['data']}")
    print(f"元数据: {result['metadata']}")
```

## API端点说明

### `GET /`

获取API基本信息。

### `POST /build_knowledge_base`

构建知识库，参数：
- `excel_file`: Excel文件路径
- `tobe_included`: 需要包含的列名列表
- `knowledge_base_file`: 知识库文件保存路径（可选，默认: knowledge_base.pkl）
- `knowledge_multi_file`: 多维度知识库文件保存路径（可选，默认: knowledge_multi.pkl）

### `POST /search`

搜索知识库，参数：
- `query`: 搜索查询字符串
- `top_k`: 返回结果数量（可选，默认: 5）

### `GET /health`

健康检查端点，返回服务状态。

## 测试服务

### 1. 运行API测试

```bash
python test_api.py
```

这将测试API的所有功能，包括构建知识库和搜索功能。

### 2. 直接测试功能（不通过API）

```bash
python test_api.py --direct
```

这将直接测试底层功能，不经过API层。

## 测试客户端

### 1. 运行API测试

```bash
# 测试API功能
python test_api.py

# 直接测试功能（不通过API）
python test_api.py --direct
```

### 2. 使用Python客户端

```python
import requests

# 构建知识库
build_payload = {
    "excel_file": "./excel_rag/test.xlsx",
    "tobe_included": ["系统名称", "系统编号"],
    "knowledge_base_file": "knowledge_base.pkl",
    "knowledge_multi_file": "knowledge_multi.pkl"
}

response = requests.post("http://localhost:8000/build_knowledge_base", json=build_payload)
print(response.json())

# 搜索知识库
search_payload = {
    "query": "系统编号: SYS-014",
    "top_k": 5
}

response = requests.post("http://localhost:8000/search", json=search_payload)
results = response.json()["results"]
for result in results:
    print(f"相似度: {result['similarity']:.4f}")
    print(f"数据: {result['data']}")
    print(f"元数据: {result['metadata']}")
```

### 3. 使用API文档进行交互测试

启动服务后，访问 http://localhost:8000/docs 可以查看交互式API文档，直接在浏览器中测试API端点。

## 核心模块说明

### embedding_model.py

封装了嵌入模型的功能，使用Qwen3-Embedding-0.6B模型生成文本向量。提供文本嵌入功能和相似度计算。

### rag_excel_knowledge_base.py

实现Excel数据到向量知识库的转换：
- 读取Excel文件
- 将每一行转换为JSON数据
- 选择特定列作为元数据
- 生成嵌入向量
- 保存知识库

### rag_excel_knowledge_search.py

实现向量检索功能：
- 加载已保存的知识库
- 计算查询与知识库条目的相似度
- 返回最相关的top-k结果
- 支持多维度检索

### main.py

FastAPI服务的主入口，提供RESTful API接口：
- 知识库构建API
- 搜索API
- 健康检查API

## 项目特点

1. **灵活的数据支持**: 可以处理任意列数的Excel文件
2. **多维度检索**: 支持按特定列检索和全文检索
3. **高效向量化**: 使用高质量嵌入模型进行语义检索
4. **可扩展性**: 模块化设计，易于扩展新功能
5. **易用性**: 简洁的API，易于集成到其他应用
6. **Web服务**: 通过FastAPI提供RESTful接口

## 应用场景

- 企业数据查询系统
- 课程内容管理
- 文档检索系统
- 数据分析工具
- 知识管理平台

## 注意事项

1. 大文件Excel处理时可能需要更多内存
2. 嵌入模型的性能取决于硬件配置
3. 确保模型路径正确配置
4. 生产环境中应考虑向量数据库的持久化方案
5. API服务需要先构建知识库才能进行搜索

## 扩展建议

- 集成更高效的向量数据库（如Milvus、Pinecone）
- 添加缓存机制提升查询性能
- 支持更多文件格式（CSV、JSON等）
- 添加Web界面方便用户操作
- 集成更多LLM服务