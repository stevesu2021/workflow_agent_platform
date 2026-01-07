# conda env vllm
# /home/steve/anaconda3/envs/vllm/bin/python -m vllm.entrypoints.openai.api_server \
#     --model /home/steve/models/Qwen3-Embedding-0.6B/ \
#     --host 0.0.0.0 \
#     --port 8004 \
#     --max-model-len 8192 \
#     --gpu-memory-utilization 0.85 \
#     --served_model_name Qwen3-Embedding-0.6B \
#     --dtype float16 \
#     --max-num-seqs 16 \
#     --enforce-eager



# # conda env vllm
# /home/steve/anaconda3/envs/vllm/bin/python -m vllm.entrypoints.openai.api_server \
#     --model /home/steve/models/Qwen3-Embedding-0.6B/ \
#     --host 0.0.0.0 \
#     --port 8004 \
#     --max-model-len 2048 \          # 👈 降低最大上下文长度（embedding 一般不需要 8k）
#     --gpu-memory-utilization 0.6 \   # 👈 从 0.85 → 0.6，预留更多显存缓冲
#     --served-model-name Qwen3-Embedding-0.6B \
#     --dtype float16 \
#     --max-num-seqs 4 \              # 👈 减少并发序列数（默认 256 太高！）
#     --enforce-eager \
#     --disable-custom-all-reduce     # 👈 单卡可禁用 all-reduce 优化，省显存


# conda env vllm
#!/bin/bash
# 文件名: vllm_qwen3_embd.sh

MODEL_DIR="/home/steve/models/"  # 确保这个目录存在！
MODEL_NAME="Qwen3-Embedding-0.6B"

cd $MODEL_DIR && exec /home/steve/anaconda3/envs/vllm/bin/vllm serve \
    "$MODEL_NAME" \
    --host 0.0.0.0 \
    --port 8004 \
    --max-model-len 2048 \
    --gpu-memory-utilization 0.6 \
    --dtype float16 \
    --max-num-seqs 4 \
    --enforce-eager \
    --disable-custom-all-reduce \
    --runner pooling