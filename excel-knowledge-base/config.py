# config.py
import os
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv(r"D:\PyProjects\.env")

# 读取配置
LLM_API_URL = os.getenv("LLM_API_URL")
LLM_API_KEY = os.getenv("LLM_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-3.5-turbo")  # 提供默认值
TIMEOUT = int(os.getenv("TIMEOUT", "10"))  # 转换为整数，默认 10

# 可选：验证必要字段是否存在
if not LLM_API_URL or not LLM_API_KEY:
    raise ValueError("缺少必要的环境变量：LLM_API_URL 或 LLM_API_KEY")

# 打印示例（实际使用时可删除）
if __name__ == "__main__":
    print("配置加载成功：")
    print(f"API URL: {LLM_API_URL}")
    print(f"Model: {MODEL_NAME}")
    print(f"Timeout: {TIMEOUT}")