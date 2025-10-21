# Heelix Notes

Open source desktop app for taking notes, organizing them into projects, and interacting with your knowledge using LLMs.

# About Heelix

Heelix is an open-source note-taking and chat app built with Rust and Tauri. Store notes locally, transcribe voice memos, import files, tag content to projects, and query your knowledge with leading LLMs while maintaining full privacy and control.

## Why we built Heelix
We wanted to build an app that makes it lighting fast to create, organize and interact with your knowledge using LLMs. All while maintaining privacy and full user control.

## Key Features

**Lightning-fast note creation and organization**

**Project-based knowledge organization**

**Voice memo transcription**

**Local-first storage for complete privacy**

**Built-in vector DB**

**Multi-provider AI support** - Works with Claude, OpenAI, Gemini, and local models

## Requirements

- Install Node 18 (recommended: https://github.com/nvm-sh/nvm, normal install: https://nodejs.org/en/download/package-manager)
- Install rust https://www.rust-lang.org/tools/install

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
