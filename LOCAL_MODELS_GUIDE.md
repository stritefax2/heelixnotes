# Local Models Support

Run AI models on your hardware for complete privacy and zero API costs.

## Quick Setup (Ollama)

### Install
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows - download from https://ollama.ai
```

### Pull & Run
```bash
ollama pull llama3.3:70b-instruct-q4_K_M    # Best quality (40GB)
ollama pull qwen2.5:32b-instruct-q4_K_M     # Balanced (19GB)
ollama pull phi4:14b-q4_K_M                 # Fast (8.5GB)
ollama serve
```

### Configure
Settings → General → Local Model Settings:
- **Endpoint**: `http://localhost:11434`
- **Model**: `llama3.3:70b-instruct-q4_K_M`
- Select "Custom Local Model" in model picker

## Recommended Models (2025)

### Best Overall
- **Llama 3.3 70B** (40GB) - Best reasoning and accuracy
- **Qwen 2.5 32B** (19GB) - Excellent code and multilingual
- **Phi-4 14B** (8.5GB) - Strong performance, smaller size

### Coding
- **Qwen 2.5 Coder 32B** (19GB) - Top coding model
- **DeepSeek Coder V2** (16GB) - Excellent code generation
- **Codestral 22B** (13GB) - Fast coding assistant

### Lightweight (8GB RAM)
- **Phi-4 14B** (8.5GB) - Punches above weight class
- **Qwen 2.5 7B** (4.7GB) - Strong small model
- **Gemma 2 9B** (5.5GB) - Efficient and capable

## Other Providers

**LM Studio** - GUI app, auto-downloads models
**llama.cpp** - High-performance CLI
**Jan** - Privacy-focused desktop app

## Troubleshooting

**Connection failed?**
- Check server is running: `curl http://localhost:11434/v1/models`
- Verify endpoint URL in settings
- Check firewall/antivirus

**Slow performance?**
- Use smaller models or quantized versions (Q4_K_M)
- Enable GPU acceleration
- Close memory-intensive apps

**Model won't load?**
- Verify model name matches exactly
- Check available RAM/VRAM
- Try smaller quantization (Q4 instead of Q8)
