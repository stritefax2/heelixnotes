# Heelix Notes

Lighting-fast open source desktop app for rapidly creating, organizing, and interacting with your knowledge using LLMs.

# About Heelix 

Heelix is an open-source note-taking and chat app built with Rust and Tauri that makes organizing and retrieving knowledge faster and more intuitive. Store notes locally, transcribe voice memos, import files, tag content to projects, and query your data with leading LLMs while maintaining full privacy and control.

## Why we built Heelix
- We wanted to build an app that makes it lighting fast to create, organize and interact with your knowledge using LLMs. All while maintaining privacy and full user control. 

## Key features

🚀 Lightning-fast note creation and organization

🧠 Project-based knowledge organization

🎙️ Voice memo transcription

🔒 Local-first storage for complete privacy

🔍 Easily select relevant knowledge to pass through to the LLM using your own API key

🗃️ Built-in local vector database for efficient document embedding and semantic search

📑 File importing 

🤖 **Multi-provider AI support** - Cloud models (Claude, OpenAI, Gemini) and local models (Ollama, llama.cpp, LocalAI)

## Supported AI Models

### 🌩️ Cloud Providers
| Provider | Models | Features |
|----------|--------|----------|
| **Anthropic Claude** | Claude 4 Sonnet, Claude 3.5 Haiku | Advanced reasoning, long context |
| **OpenAI** | GPT-4o, O1, O4-mini | Industry standard, code generation |
| **Google Gemini** | Gemini 2.5 Flash | Fast responses, multimodal |

### 🏠 Local Models (Privacy-First)
| Provider | Description | Setup |
|----------|-------------|-------|
| **Ollama** | Easiest local setup | `ollama serve` |
| **llama.cpp** | High-performance inference | Server mode |
| **LocalAI** | OpenAI-compatible local API | Docker/native |
| **Text Generation WebUI** | Popular community choice | Web interface |
| **LM Studio** | User-friendly model runner | GUI application |
| **Jan** | Privacy-focused desktop AI | Desktop app |

### 🔥 Recommended Local Models
- **Llama 3.2 (8B)** - Best balance of quality and speed
- **Mistral 7B** - Fast and efficient for most tasks  
- **Code Llama** - Specialized for programming tasks
- **Phi-3** - Lightweight but capable
- **Qwen 2.5** - Strong multilingual support

### 🚀 Quick Local Setup
```bash
# Install Ollama (recommended)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.2:latest

# Start server
ollama serve

# Configure in Heelix Notes:
# Settings → General → Local Model Settings
# Endpoint: http://localhost:11434
# Model: llama3.2:latest
```

### 🔒 Privacy Benefits of Local Models
- ✅ **Complete data privacy** - nothing leaves your device
- ✅ **No API costs** - unlimited usage
- ✅ **Offline operation** - works without internet
- ✅ **GDPR/HIPAA friendly** - sensitive data stays local
- ✅ **No rate limits** - process as much as you want

## Requirements

- Install Node 18 (recommended: https://github.com/nvm-sh/nvm, normal install: https://nodejs.org/en/download/package-manager)
- Install rust https://www.rust-lang.org/tools/install
- Install tesseract (optional) https://tesseract-ocr.github.io/tessdoc/Installation.html

## How to run

```
npm install
npm run tauri dev
```

If you have dependencie issues when running the app, try to delete `package-lock.json` & run `npm install` again. Add your API keys before using the app. Heelix currently uses small-3 embeddings. 

## How to build

```
npm install
npm run tauri build
```
