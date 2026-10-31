// ============================================
// AI Context Switcher — Perplexity Content Script
// Extracts & AUTO-PASTES chat on perplexity.ai
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'perplexity';
  const PLATFORM_NAME = 'Perplexity';

  function extractMessages() {
    const messages = [];

    const threadItems = document.querySelectorAll('[class*="thread-"], [class*="message"], [class*="query"], [class*="answer"]');

    if (threadItems.length > 0) {
      threadItems.forEach(item => {
        const text = item.innerText.trim();
        if (text.length > 5) {
          const isUser = item.classList.toString().includes('query') ||
                        item.classList.toString().includes('user') ||
                        item.classList.toString().includes('question');
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 5000)
          });
        }
      });
    }

    if (messages.length === 0) {
      const main = document.querySelector('main, [class*="thread"]');
      if (main) {
        const sections = main.querySelectorAll('[class*="block"], [class*="section"], [class*="turn"]');
        sections.forEach((section, i) => {
          const text = section.innerText.trim();
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
    const titleEl = document.querySelector('h1, [class*="title"]');
    if (titleEl) return titleEl.textContent.trim();
    return 'Perplexity Conversation';
  }

  function getInputElement() {
    return document.querySelector('textarea[placeholder]') ||
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
