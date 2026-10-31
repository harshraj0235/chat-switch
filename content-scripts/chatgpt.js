// ============================================
// AI Context Switcher — ChatGPT Content Script
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'chatgpt';
  const PLATFORM_NAME = 'ChatGPT';

  function extractMessages() {
    const messages = [];
    const messageEls = document.querySelectorAll('[data-message-author-role]');

    if (messageEls.length > 0) {
      messageEls.forEach(el => {
        const role = el.getAttribute('data-message-author-role');
        const contentEl = el.querySelector('.markdown, .whitespace-pre-wrap, p');
        if (contentEl && (role === 'user' || role === 'assistant')) {
          messages.push({ role, content: contentEl.innerText.trim() });
        }
      });
    }

    if (messages.length === 0) {
      const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
      turns.forEach(turn => {
        const isUser = turn.querySelector('[data-message-author-role="user"]');
        const contentEl = turn.querySelector('.markdown, .whitespace-pre-wrap, p');
        if (contentEl) {
          messages.push({ role: isUser ? 'user' : 'assistant', content: contentEl.innerText.trim() });
        }
      });
    }

    return messages;
  }

  function getChatTitle() {
    const activeNav = document.querySelector('nav a.bg-token-sidebar-surface-secondary');
    if (activeNav) return activeNav.textContent.trim();
    return 'ChatGPT Conversation';
  }

  function getInputElement() {
    const selectors = [
      '#prompt-textarea',
      'div#prompt-textarea[contenteditable]',
      '[contenteditable="true"][id="prompt-textarea"]',
      'textarea[data-id="root"]',
      'textarea[placeholder]',
      'div[contenteditable="true"]',
      'textarea',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { AICS.log('ChatGPT input found:', sel); return el; }
    }
    return null;
  }

  async function customInject(input, prompt, context) {
    AICS.log('ChatGPT: Injecting...');
    input.focus();
    await new Promise(r => setTimeout(r, 300));

    if (input.getAttribute('contenteditable') !== null) {
      input.textContent = '';
      const success = document.execCommand('insertText', false, prompt);
      if (!success) input.innerText = prompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    } else {
      await AICS.typeIntoElement(input, prompt);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_CHAT') {
      sendResponse({ messages: extractMessages(), title: getChatTitle(), platform: PLATFORM_ID });
    }
    if (message.action === 'INJECT_CONTEXT') {
      const input = getInputElement();
      if (input) customInject(input, AICS.buildContextPrompt(message.context), message.context);
      sendResponse({ success: true });
    }
  });

  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
