# Heelix Notes

The open-source note taker making organizing and interacting with your knowledge faster and more intuitive. 

Heelix is a desktop app written in Rust and Tauri, letting you to rapidly create notes, tag them to project and set up LLM queries on project or document specific data. The notes are stored locally and you can use your own API key with Claude or OpenAI's latest models. 

## Why we built Heelix
- We wanted to build an app that makes it lighting fast to create, organize and interact with notes using LLMs. All while maintaining privacy and full user control. 

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
