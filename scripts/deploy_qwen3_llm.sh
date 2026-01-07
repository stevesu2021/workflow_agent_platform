# conda env vllm
/home/steve/anaconda3/envs/vllm/bin/python -m vllm.entrypoints.openai.api_server \
    --model /home/steve/models/Qwen3-4B \
    --served_model_name Qwen/Qwen3-4B \
    --host 0.0.0.0 \
    --port 8002 \
    --max-model-len 40960 \
    --gpu-memory-utilization 0.9 \
    --dtype float16 \
    --max-num-seqs 8 \
    --enforce-eager
