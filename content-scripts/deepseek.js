// ============================================
// AI Context Switcher — DeepSeek Content Script
// Extracts & injects chat on chat.deepseek.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'deepseek';
  const PLATFORM_NAME = 'DeepSeek';

  // ── Extract conversation messages ──
  function extractMessages() {
    const messages = [];

    // DeepSeek uses specific class patterns
    const msgElements = document.querySelectorAll('[class*="message-"], [class*="chat-message"]');

    if (msgElements.length > 0) {
      msgElements.forEach(el => {
        const text = el.innerText.trim();
        if (text.length > 2) {
          const isUser = el.classList.toString().includes('user') ||
                        el.classList.toString().includes('human') ||
                        el.querySelector('[class*="user"]') !== null;
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 5000)
          });
        }
      });
    }

    // Fallback: look for markdown rendered blocks
    if (messages.length === 0) {
      const container = document.querySelector('#chat-container, [class*="chat"], main');
      if (container) {
        const blocks = container.querySelectorAll('.markdown-body, [class*="content"]');
        blocks.forEach((block, i) => {
          const text = block.innerText.trim();
          if (text.length > 5) {
            messages.push({
              role: i % 2 === 0 ? 'user' : 'assistant',
              content: text.substring(0, 5000)
            });
          }
        });
      }
    }

    return messages;
  }

  function getChatTitle() {
    const titleEl = document.querySelector('[class*="title"], h1, .chat-title');
    if (titleEl) return titleEl.textContent.trim();
    return 'DeepSeek Conversation';
  }

  function getInputElement() {
    return document.querySelector('textarea#chat-input') ||
           document.querySelector('textarea') ||
           document.querySelector('[contenteditable="true"]');
  }

  async function injectContext(context) {
    const prompt = AICS.buildContextPrompt(context);
    const input = getInputElement();

    if (!input) {
      AICS.showToast('Could not find DeepSeek input field');
      return;
    }

    await AICS.typeIntoElement(input, prompt);
    AICS.showToast('✅ Context pasted! Press Enter or click Send.');
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_CHAT') {
      const messages = extractMessages();
      const title = getChatTitle();
      sendResponse({ messages, title, platform: PLATFORM_ID });
    }
    if (message.action === 'INJECT_CONTEXT') {
      injectContext(message.context);
      sendResponse({ success: true });
    }
  });

  async function init() {
    const hasPending = await AICS.checkPendingSwitch();
    if (hasPending) {
      setTimeout(async () => {
        const result = await chrome.storage.local.get('currentContext');
        const context = result.currentContext;
        if (context && context.messages && context.messages.length > 0) {
          const sourceName = context.sourcePlatform ?
            context.sourcePlatform.charAt(0).toUpperCase() + context.sourcePlatform.slice(1) : 'another AI';
          AICS.showInjectionBanner(
            context.messages.length, sourceName,
            () => injectContext(context),
            () => AICS.showToast('Context dismissed')
          );
        }
      }, 3000);
    }
  }

  init();
})();
