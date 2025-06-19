# Local Models Support in Heelix Notes

Heelix Notes now supports local AI models! This means you can run powerful language models on your own hardware, ensuring complete privacy and eliminating API costs.

## Supported Local Model Providers

- **Ollama** - The easiest way to run models locally
- **llama.cpp** - High-performance inference engine
- **LocalAI** - OpenAI-compatible API for local models
- **Text Generation WebUI (oobabooga)** - Popular WebUI with OpenAI API compatibility
- **Jan** - Privacy-focused desktop AI assistant
- **LM Studio** - User-friendly local model runner

## Quick Setup with Ollama (Recommended)

### 1. Install Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### 2. Pull a Model
```bash
# Popular models (choose based on your hardware)
ollama pull llama3.2:latest          # 4.3GB - Good for most users
ollama pull llama3.2:13b             # 7.3GB - Better quality
ollama pull codellama:latest         # 3.8GB - Great for coding
ollama pull mistral:latest           # 4.1GB - Fast and efficient
ollama pull phi3:latest              # 2.3GB - Lightweight option
```

### 3. Start Ollama Server
```bash
ollama serve
```

### 4. Configure Heelix Notes
1. Open Heelix Notes
2. Go to Settings → General
3. In the "Local Model Settings" section:
   - **Endpoint URL**: `http://localhost:11434` (default for Ollama)
   - **Model Name**: `llama3.2:latest` (or your preferred model)
4. Save settings
5. In the model selector, choose "Custom Local Model"

## Alternative Setups

### llama.cpp with Server Mode
```bash
# Start llama.cpp server
./server -m path/to/model.gguf --port 8080 --host 0.0.0.0

# In Heelix Notes settings:
# Endpoint URL: http://localhost:8080
# Model Name: any-name-you-prefer
```

### LocalAI
```bash
# Docker setup
docker run -p 8080:8080 quay.io/go-skynet/local-ai:latest

# In Heelix Notes settings:
# Endpoint URL: http://localhost:8080
# Model Name: your-model-name
```

### Text Generation WebUI
```bash
# Start with OpenAI API extension
python server.py --extensions openai --listen

# In Heelix Notes settings:
# Endpoint URL: http://localhost:5000
# Model Name: your-loaded-model
```

## Features

### ✅ What Works
- **Chat conversations** with full streaming support
- **Document context** integration with your notes
- **Conversation naming** using local models
- **Model switching** between local and cloud providers
- **Privacy-first** - all processing happens locally
- **No API costs** - unlimited usage
- **Offline capable** - works without internet

### 🔧 Configuration Options
- **Custom endpoints** - any OpenAI-compatible API
- **Model selection** - use any model name from your provider
- **Fallback support** - seamlessly switch between local and cloud models

## Recommended Models by Use Case

### General Chat & Writing
- **Llama 3.2 (8B)** - Excellent balance of quality and speed
- **Mistral 7B** - Fast and efficient for most tasks
- **Phi-3** - Lightweight but capable

### Coding & Technical Tasks
- **Code Llama** - Specialized for programming tasks
- **DeepSeek Coder** - Excellent code generation
- **Llama 3.2 (13B+)** - Better reasoning for complex problems

### Document Analysis
- **Llama 3.2 (13B+)** - Better context understanding
- **Mistral 7B** - Good balance for document Q&A
- **Qwen 2.5** - Strong multilingual support

## Hardware Requirements

### Minimum (4GB+ RAM)
- **Phi-3 (3.8B)** - 2.3GB VRAM
- **Llama 3.2 (3B)** - 2.0GB VRAM

### Recommended (8GB+ RAM)
- **Llama 3.2 (8B)** - 4.3GB VRAM
- **Mistral 7B** - 4.1GB VRAM
- **Code Llama 7B** - 3.8GB VRAM

### High-end (16GB+ RAM)
- **Llama 3.2 (13B)** - 7.3GB VRAM
- **Mixtral 8x7B** - 26GB VRAM
- **Llama 3.1 (70B)** - 40GB+ VRAM

## Troubleshooting

### Connection Issues
- Ensure your local model server is running
- Check the endpoint URL is correct
- Verify firewall settings allow local connections
- Try `curl http://localhost:11434/v1/models` to test Ollama

### Performance Issues
- Use smaller models if experiencing slowdowns
- Enable GPU acceleration in your model runner
- Adjust context length settings
- Consider using quantized models (Q4, Q8)

### Model Not Responding
- Check model is loaded in your local server
- Verify model name matches exactly
- Look at server logs for error messages
- Try a different model to isolate issues

## Privacy Benefits

- **Complete data privacy** - nothing leaves your device
- **No API key required** - no account needed with third parties
- **Offline operation** - works without internet connection
- **GDPR/HIPAA friendly** - sensitive data stays local
- **No usage limits** - unlimited conversations and processing

## Community & Support

Join the conversation:
- **r/LocalLLaMA** - Reddit community for local AI
- **Ollama GitHub** - https://github.com/ollama/ollama
- **Heelix Discord** - Get help with setup and configuration

## Performance Tips

1. **Use SSD storage** for faster model loading
2. **Enable GPU acceleration** when available
3. **Adjust context length** based on your use case
4. **Use quantized models** for better performance
5. **Close other memory-intensive apps** while running large models

## Coming Soon

- **Model management** - Download and manage models from within Heelix
- **Performance metrics** - Monitor token generation speed and memory usage
- **Auto-detection** - Automatically discover local model servers
- **Batch processing** - Process multiple documents efficiently

---

*Experience the future of private AI with Heelix Notes and local models!* 