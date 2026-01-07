# # conda env vllm
# /home/steve/anaconda3/envs/vllm/bin/python -m vllm.entrypoints.openai.api_server \
#     --model /home/steve/models/Qwen3-VL-4B-Instruct \
#     --host 0.0.0.0 \
#     --port 8003 \
#     --max-model-len 10240 \
#     --gpu-memory-utilization 0.9 \
#     --served_model_name Qwen3-VL-4B-Instruct \
#     --dtype float16 \
#     --max-num-seqs 8 \
#     --enforce-eager


#!/bin/bash
# 使用 vllm serve（新入口），并极致压缩显存

MODEL_DIR="/home/steve/models/"  # 确保这个目录存在！
MODEL_NAME="Qwen3-VL-4B-Instruct"


#!/bin/bash
# 启动 Qwen3-VL-4B-Instruct（vLLM ≥ 0.6.0）


cd $MODEL_DIR && exec /home/steve/anaconda3/envs/vllm/bin/vllm serve \
    $MODEL_NAME \
    --host 0.0.0.0 \
    --port 8003 \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.7 \
    --dtype float16 \
    --max-num-seqs 2 \
    --enforce-eager \
    --disable-custom-all-reduce \
    --enable-prefix-caching \
    --block-size 16 \
    --max-num-batched-tokens 2048
    # 注意：已移除 --quantization auto