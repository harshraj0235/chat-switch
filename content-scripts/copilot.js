// ============================================
// AI Context Switcher — Copilot Content Script
// Extracts & injects chat on copilot.microsoft.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'copilot';
  const PLATFORM_NAME = 'Microsoft Copilot';

  // ── Extract messages ──
  function extractMessages() {
    const messages = [];

    // Copilot uses shadow DOM heavily, try accessible elements first
    const userMsgs = document.querySelectorAll('[class*="user-message"], [class*="request"], [data-content="user"]');
    const botMsgs = document.querySelectorAll('[class*="bot-message"], [class*="response"], [data-content="bot"]');

    if (userMsgs.length > 0 || botMsgs.length > 0) {
      const maxLen = Math.max(userMsgs.length, botMsgs.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < userMsgs.length) {
          messages.push({
            role: 'user',
            content: userMsgs[i].innerText.trim().substring(0, 5000)
          });
        }
        if (i < botMsgs.length) {
          messages.push({
            role: 'assistant',
            content: botMsgs[i].innerText.trim().substring(0, 5000)
          });
        }
      }
    }

    // Fallback: generic turn-based extraction
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

  async function injectContext(context) {
    const prompt = AICS.buildContextPrompt(context);
    const input = getInputElement();

    if (!input) {
      AICS.showToast('Could not find Copilot input field');
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
