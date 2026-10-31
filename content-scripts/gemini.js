// ============================================
// AI Context Switcher — Gemini Content Script
// Extracts & AUTO-PASTES chat on gemini.google.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'gemini';
  const PLATFORM_NAME = 'Gemini';

  function extractMessages() {
    const messages = [];

    const turns = document.querySelectorAll('message-content, .conversation-turn, .query-content, .response-content');
    if (turns.length > 0) {
      turns.forEach(turn => {
        const text = turn.innerText.trim();
        if (text.length > 2) {
          const isUser = turn.classList.contains('query-content') ||
                        turn.closest('.query-turn') !== null ||
                        turn.closest('[class*="query"]') !== null;
          messages.push({ role: isUser ? 'user' : 'assistant', content: text.substring(0, 5000) });
        }
      });
    }

    if (messages.length === 0) {
      const userMsgs = document.querySelectorAll('.user-query, [class*="user-message"], .query-text');
      const modelMsgs = document.querySelectorAll('.model-response, [class*="model-response"], .response-text, .markdown-main-panel');
      const maxLen = Math.max(userMsgs.length, modelMsgs.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < userMsgs.length) messages.push({ role: 'user', content: userMsgs[i].innerText.trim().substring(0, 5000) });
        if (i < modelMsgs.length) messages.push({ role: 'assistant', content: modelMsgs[i].innerText.trim().substring(0, 5000) });
      }
    }

    return messages;
  }

  function getChatTitle() {
    const titleEl = document.querySelector('.conversation-title, [class*="chat-title"], h1');
    if (titleEl) return titleEl.textContent.trim();
    return 'Gemini Conversation';
  }

  // ── Find input — try MANY selectors for Gemini ──
  function getInputElement() {
    // Gemini changes its DOM frequently, so try many selectors
    const selectors = [
      '.ql-editor[contenteditable="true"]',
      'rich-textarea .ql-editor',
      'rich-textarea [contenteditable="true"]',
      '.text-input-field textarea',
      '.input-area textarea',
      'textarea[placeholder]',
      'textarea',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
      '.input-area [contenteditable]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        AICS.log('Gemini input found with selector:', sel);
        return el;
      }
    }

    AICS.log('Gemini: No input found with any selector');
    return null;
  }

  // ── Custom inject for Gemini ──
  async function customInject(input, prompt, context) {
    AICS.log('Gemini: Injecting into', input.tagName, input.className);
    input.focus();

    // Small delay after focus
    await new Promise(r => setTimeout(r, 300));

    if (input.classList.contains('ql-editor')) {
      // Quill editor
      input.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = prompt;
      input.appendChild(p);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      AICS.log('Gemini: Injected via Quill paragraph');
    } else if (input.getAttribute('contenteditable') !== null) {
      input.textContent = '';
      const success = document.execCommand('insertText', false, prompt);
      if (!success) input.innerText = prompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      AICS.log('Gemini: Injected via contenteditable');
    } else if (input.tagName === 'TEXTAREA') {
      await AICS.typeIntoElement(input, prompt);
      AICS.log('Gemini: Injected via textarea');
    } else {
      await AICS.typeIntoElement(input, prompt);
      AICS.log('Gemini: Injected via generic typeInto');
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

  // ── AUTO-PASTE on page load ──
  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
