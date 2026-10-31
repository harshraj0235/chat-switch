// ============================================
// AI Context Switcher — DeepSeek Content Script
// Extracts & AUTO-PASTES chat on chat.deepseek.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'deepseek';
  const PLATFORM_NAME = 'DeepSeek';

  function extractMessages() {
    const messages = [];
    const msgElements = document.querySelectorAll('[class*="message-"], [class*="chat-message"]');

    if (msgElements.length > 0) {
      msgElements.forEach(el => {
        const text = el.innerText.trim();
        if (text.length > 2) {
          const isUser = el.classList.toString().includes('user') ||
                        el.classList.toString().includes('human');
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 5000)
          });
        }
      });
    }

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

  async function customInject(input, prompt, context) {
    await AICS.typeIntoElement(input, prompt);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_CHAT') {
      const messages = extractMessages();
      const title = getChatTitle();
      sendResponse({ messages, title, platform: PLATFORM_ID });
    }
    if (message.action === 'INJECT_CONTEXT') {
      const prompt = AICS.buildContextPrompt(message.context);
      const input = getInputElement();
      if (input) customInject(input, prompt, message.context);
      sendResponse({ success: true });
    }
  });

  // ── AUTO-PASTE on page load ──
  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
