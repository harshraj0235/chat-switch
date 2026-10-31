// ============================================
// AI Context Switcher — Claude Content Script
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'claude';
  const PLATFORM_NAME = 'Claude';

  function extractMessages() {
    const messages = [];
    const humanTurns = document.querySelectorAll('[data-testid="user-human-turn"]');
    const botTurns = document.querySelectorAll('[data-testid="user-bot-turn"]');

    if (humanTurns.length > 0 || botTurns.length > 0) {
      const allTurns = [];
      humanTurns.forEach(el => allTurns.push({ el, role: 'user', top: el.getBoundingClientRect().top }));
      botTurns.forEach(el => allTurns.push({ el, role: 'assistant', top: el.getBoundingClientRect().top }));
      allTurns.sort((a, b) => a.top - b.top);
      allTurns.forEach(turn => {
        const text = turn.el.innerText.trim();
        if (text.length > 2) messages.push({ role: turn.role, content: text.substring(0, 5000) });
      });
    }

    if (messages.length === 0) {
      const containers = document.querySelectorAll('[data-test-render-count]');
      containers.forEach(container => {
        const isHuman = container.closest('[data-testid="user-human-turn"]') !== null;
        const text = container.innerText.trim();
        if (text) messages.push({ role: isHuman ? 'user' : 'assistant', content: text.substring(0, 5000) });
      });
    }

    return messages;
  }

  function getChatTitle() {
    const titleEl = document.querySelector('[data-testid="chat-title"], h1');
    if (titleEl) return titleEl.textContent.trim();
    return 'Claude Conversation';
  }

  function getInputElement() {
    const selectors = [
      '.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"].ProseMirror',
      'div.ProseMirror',
      'div[contenteditable="true"][data-placeholder]',
      'fieldset [contenteditable="true"]',
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
      'textarea',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { AICS.log('Claude input found:', sel); return el; }
    }
    return null;
  }

  async function customInject(input, prompt, context) {
    AICS.log('Claude: Injecting...');
    input.focus();
    await new Promise(r => setTimeout(r, 300));

    if (input.classList.contains('ProseMirror') || input.getAttribute('contenteditable') !== null) {
      // Try execCommand first (works best with ProseMirror)
      input.innerHTML = '';
      input.focus();
      const success = document.execCommand('insertText', false, prompt);
      if (!success) {
        // Fallback: create paragraph
        const p = document.createElement('p');
        p.textContent = prompt;
        input.innerHTML = '';
        input.appendChild(p);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
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
