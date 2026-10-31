# ⚡ AI Context Switcher

> **Switch your AI chat context between ChatGPT, Claude, Gemini, DeepSeek, Perplexity & Copilot in one click.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-brightgreen?logo=google-chrome)](https://chrome.google.com/webstore)
[![Edge Add-ons](https://img.shields.io/badge/Edge%20Add--ons-Install-blue?logo=microsoft-edge)](https://microsoftedge.microsoft.com/addons)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🤔 The Problem

You're chatting with ChatGPT and hit a rate limit. Or you want to see how Claude answers the same question. Or you need Gemini's latest data.

**Every time you switch AI platforms, you lose your entire conversation context.** You have to re-explain everything from scratch. It wastes time and breaks your flow.

## ⚡ The Solution

**AI Context Switcher** captures your entire conversation from any AI chat and lets you continue it seamlessly on any other AI platform.

1. 📋 **Capture** — One click to extract your full chat
2. 🔄 **Switch** — Choose ChatGPT, Claude, Gemini, DeepSeek, Perplexity, or Copilot
3. ✅ **Continue** — Context auto-pasted, just press Enter!

---

## 🤖 Supported Platforms

| Platform | Status | URL |
|---|---|---|
| 🟢 ChatGPT (OpenAI) | ✅ Supported | chatgpt.com |
| 🟠 Claude (Anthropic) | ✅ Supported | claude.ai |
| 🔵 Gemini (Google) | ✅ Supported | gemini.google.com |
| 🟣 DeepSeek | ✅ Supported | chat.deepseek.com |
| 🔷 Perplexity AI | ✅ Supported | perplexity.ai |
| 🟦 Microsoft Copilot | ✅ Supported | copilot.microsoft.com |

---

## ✨ Features

- **⚡ One-Click Capture** — Extract entire chat history instantly
- **🔄 Instant Switch** — Jump between 6 AI platforms
- **📋 Smart Context Paste** — Auto-formats conversation for the target AI
- **📜 Switch History** — Full log of all your context switches
- **📤 Export Options** — Copy as text or download as JSON
- **🔒 Privacy First** — Zero cloud. All data stays on your device.
- **🎨 Premium UI** — Dark glassmorphism design
- **🛡️ Manifest V3** — Latest Chrome security standards

---

## 📦 Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store listing](#)
2. Click **"Add to Chrome"**
3. Pin the extension to your toolbar

### From Source (Developer Mode)
1. Clone this repo:
   ```bash
   git clone https://github.com/your-username/ai-context-switcher.git
   ```
2. Open Chrome → `chrome://extensions/`
3. Enable **"Developer mode"** (top right)
4. Click **"Load unpacked"**
5. Select the extension folder

---

## 🚀 How to Use

### Step 1: Capture Context
1. Go to any AI chat (e.g., ChatGPT)
2. Click the ⚡ AI Context Switcher icon in your toolbar
3. Click **"Capture Current Chat"**

### Step 2: Switch Platform
1. In the popup, click any platform button (e.g., Claude, Gemini)
2. A new tab opens with your chosen AI
3. A banner appears: **"X messages ready to paste"**

### Step 3: Continue Your Chat
1. Click **"Paste Context"** on the banner
2. Your conversation is auto-formatted and inserted
3. Press Enter — the AI continues exactly where you left off!

---

## 🏗️ Project Structure

```
ai-context-switcher/
├── manifest.json              # Extension config (Manifest V3)
├── background.js              # Service worker — context storage & switching
├── popup.html                 # Extension popup UI
├── popup.css                  # Premium dark theme styles
├── popup.js                   # Popup controller logic
├── content-scripts/
│   ├── shared.js              # Common utilities for all platforms
│   ├── overlay.css            # In-page overlay styles
│   ├── chatgpt.js             # ChatGPT extractor & injector
│   ├── claude.js              # Claude extractor & injector
│   ├── gemini.js              # Gemini extractor & injector
│   ├── deepseek.js            # DeepSeek extractor & injector
│   ├── perplexity.js          # Perplexity extractor & injector
│   └── copilot.js             # Copilot extractor & injector
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── CHROME_STORE_SEO_LISTING.md  # Chrome Web Store listing copy
```

---

## 🔒 Privacy

This extension:
- ❌ Does NOT send any data to external servers
- ❌ Does NOT use analytics or tracking
- ❌ Does NOT inject ads
- ✅ Stores all data locally using Chrome's `storage.local` API
- ✅ Only accesses AI chat websites you explicitly visit
- ✅ Uses minimum required permissions

---

## 🛠️ Tech Stack

- **Manifest V3** — Chrome's latest extension platform
- **Vanilla JavaScript** — No frameworks, zero dependencies
- **Chrome Storage API** — Local data persistence
- **Content Scripts** — Platform-specific DOM extraction
- **Service Worker** — Background context management

---

## 📝 License

MIT License — Free for personal and commercial use.

---

## ⭐ Support

If you find this useful, please:
- ⭐ Star this repo on GitHub
- 📝 Leave a review on the Chrome Web Store
- 🐛 Report bugs via GitHub Issues
- 💡 Suggest features via GitHub Discussions

---

**Made with ⚡ by [Your Name]**
