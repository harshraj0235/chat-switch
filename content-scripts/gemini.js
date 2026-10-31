// ============================================
// AI Context Switcher — Gemini Content Script
// Extracts & AUTO-PASTES chat on gemini.google.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'gemini';
  const PLATFORM_NAME = 'Gemini';

  // ── Extract messages ──
  function extractMessages() {
    const messages = [];

    // Gemini conversation turns
    const turns = document.querySelectorAll('message-content, .conversation-turn, .query-content, .response-content');

    if (turns.length > 0) {
      turns.forEach(turn => {
        const text = turn.innerText.trim();
        if (text.length > 2) {
          const isUser = turn.classList.contains('query-content') ||
                        turn.closest('.query-turn') !== null ||
                        turn.closest('[class*="query"]') !== null;
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 5000)
          });
        }
      });
    }

    // Fallback
    if (messages.length === 0) {
      const userMsgs = document.querySelectorAll('.user-query, [class*="user-message"], .query-text');
      const modelMsgs = document.querySelectorAll('.model-response, [class*="model-response"], .response-text, .markdown-main-panel');
      const maxLen = Math.max(userMsgs.length, modelMsgs.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < userMsgs.length) {
          messages.push({ role: 'user', content: userMsgs[i].innerText.trim().substring(0, 5000) });
        }
        if (i < modelMsgs.length) {
          messages.push({ role: 'assistant', content: modelMsgs[i].innerText.trim().substring(0, 5000) });
        }
      }
    }

    return messages;
  }

  function getChatTitle() {
    const titleEl = document.querySelector('.conversation-title, [class*="chat-title"], h1');
    if (titleEl) return titleEl.textContent.trim();
    return 'Gemini Conversation';
  }

  function getInputElement() {
    return document.querySelector('.ql-editor[contenteditable="true"]') ||
           document.querySelector('rich-textarea .ql-editor') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('.text-input-field_textarea-wrapper textarea') ||
           document.querySelector('textarea');
  }

  // ── Custom inject for Gemini (Quill editor) ──
  async function customInject(input, prompt, context) {
    input.focus();

    if (input.classList.contains('ql-editor')) {
      // Gemini uses Quill editor
      input.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = prompt;
      input.appendChild(p);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.getAttribute('contenteditable') !== null) {
      input.textContent = '';
      document.execCommand('insertText', false, prompt);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      await AICS.typeIntoElement(input, prompt);
    }
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
