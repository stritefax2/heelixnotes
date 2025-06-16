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
