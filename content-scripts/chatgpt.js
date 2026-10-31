// ============================================
// AI Context Switcher — ChatGPT Content Script
// FIXED: Generic text extraction that works with any ChatGPT DOM version
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'chatgpt';
  const PLATFORM_NAME = 'ChatGPT';

  // ── Extract messages — multiple strategies ──
  function extractMessages() {
    let messages = [];

    // Strategy 1: data-message-author-role (classic ChatGPT)
    const roleEls = document.querySelectorAll('[data-message-author-role]');
    if (roleEls.length > 0) {
      AICS.log('ChatGPT: Using data-message-author-role strategy');
      roleEls.forEach(el => {
        const role = el.getAttribute('data-message-author-role');
        const text = el.innerText.trim();
        if (text.length > 1 && (role === 'user' || role === 'assistant')) {
          messages.push({ role, content: text.substring(0, 5000) });
        }
      });
    }

    // Strategy 2: conversation-turn data-testid
    if (messages.length === 0) {
      const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
      if (turns.length > 0) {
        AICS.log('ChatGPT: Using conversation-turn strategy');
        turns.forEach(turn => {
          const userRole = turn.querySelector('[data-message-author-role="user"]');
          const text = turn.innerText.trim();
          if (text.length > 3) {
            messages.push({ role: userRole ? 'user' : 'assistant', content: text.substring(0, 5000) });
          }
        });
      }
    }

    // Strategy 3: Look for user bubbles (blue) and assistant responses
    if (messages.length === 0) {
      AICS.log('ChatGPT: Using article/turn-based strategy');
      const articles = document.querySelectorAll('article');
      if (articles.length > 0) {
        articles.forEach(article => {
          const text = article.innerText.trim();
          if (text.length > 3) {
            const isUser = article.querySelector('[data-message-author-role="user"]') !== null;
            messages.push({ role: isUser ? 'user' : 'assistant', content: text.substring(0, 5000) });
          }
        });
      }
    }

    // Strategy 4: GENERIC FALLBACK — grab ALL text from main conversation area
    if (messages.length === 0) {
      AICS.log('ChatGPT: Using generic text extraction fallback');
      const mainEl = document.querySelector('main') || document.querySelector('[role="main"]');
      if (mainEl) {
        const fullText = mainEl.innerText.trim();
        if (fullText.length > 10) {
          // Send as a single context block
          messages.push({
            role: 'user',
            content: '[Full conversation text from ChatGPT]\n\n' + fullText.substring(0, 15000)
          });
        }
      }
    }

    AICS.log(`ChatGPT: Extracted ${messages.length} messages`);
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
      'div[contenteditable="true"]',
      'textarea[placeholder]',
      'textarea',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { AICS.log('ChatGPT input found:', sel); return el; }
    }
    return null;
  }

  async function customInject(input, prompt) {
    input.focus();
    await new Promise(r => setTimeout(r, 500));

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
      if (input) customInject(input, AICS.buildContextPrompt(message.context));
      sendResponse({ success: true });
    }
  });

  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
