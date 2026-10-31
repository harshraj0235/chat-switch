// ============================================
// AI Context Switcher — Copilot Content Script
// Extracts & AUTO-PASTES chat on copilot.microsoft.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'copilot';
  const PLATFORM_NAME = 'Microsoft Copilot';

  function extractMessages() {
    const messages = [];

    const userMsgs = document.querySelectorAll('[class*="user-message"], [class*="request"], [data-content="user"]');
    const botMsgs = document.querySelectorAll('[class*="bot-message"], [class*="response"], [data-content="bot"]');

    if (userMsgs.length > 0 || botMsgs.length > 0) {
      const maxLen = Math.max(userMsgs.length, botMsgs.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < userMsgs.length) {
          messages.push({ role: 'user', content: userMsgs[i].innerText.trim().substring(0, 5000) });
        }
        if (i < botMsgs.length) {
          messages.push({ role: 'assistant', content: botMsgs[i].innerText.trim().substring(0, 5000) });
        }
      }
    }

    if (messages.length === 0) {
      const container = document.querySelector('[class*="chat"], [class*="conversation"], main');
      if (container) {
        const turns = container.querySelectorAll('[class*="turn"], [class*="message"]');
        turns.forEach((turn, i) => {
          const text = turn.innerText.trim();
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
    return 'Copilot Conversation';
  }

  function getInputElement() {
    return document.querySelector('#searchbox') ||
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
