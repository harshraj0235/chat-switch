// ============================================
// AI Context Switcher — Gemini Content Script
// FIXED: Correct Gemini input selectors + always show panel
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'gemini';
  const PLATFORM_NAME = 'Gemini';

  function extractMessages() {
    const messages = [];

    // Strategy 1: Gemini message-content elements
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

    // Strategy 2: Generic main area extraction
    if (messages.length === 0) {
      const mainEl = document.querySelector('main') || document.querySelector('[role="main"]');
      if (mainEl) {
        const fullText = mainEl.innerText.trim();
        if (fullText.length > 10) {
          messages.push({
            role: 'user',
            content: '[Full conversation from Gemini]\n\n' + fullText.substring(0, 15000)
          });
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

  // ── Find Gemini's input — EXHAUSTIVE selectors ──
  function getInputElement() {
    const selectors = [
      // Gemini's Quill editor (most common)
      '.ql-editor[contenteditable="true"]',
      'div.ql-editor[aria-label*="prompt"]',
      'div.ql-editor[aria-label*="Gemini"]',
      'div.ql-editor',
      // Rich textarea component
      'rich-textarea .ql-editor',
      'rich-textarea [contenteditable="true"]',
      'rich-textarea textarea',
      // Generic contenteditable
      '[contenteditable="true"][aria-label*="prompt"]',
      '[contenteditable="true"][aria-label*="Gemini"]',
      '[contenteditable="true"][role="textbox"]',
      // Textareas
      'textarea[aria-label*="prompt"]',
      'textarea[aria-label*="Gemini"]',
      'textarea[placeholder*="Gemini"]',
      'textarea[placeholder]',
      'textarea',
      // Last resort
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) { // Make sure it's visible
        AICS.log('Gemini input found:', sel, el.tagName, el.className);
        return el;
      }
    }

    // Also try inside shadow DOM of custom elements
    const richTextareas = document.querySelectorAll('rich-textarea');
    for (const rt of richTextareas) {
      if (rt.shadowRoot) {
        const inner = rt.shadowRoot.querySelector('.ql-editor, [contenteditable], textarea');
        if (inner) {
          AICS.log('Gemini input found in shadow DOM');
          return inner;
        }
      }
      // Also check light DOM children
      const inner = rt.querySelector('.ql-editor, [contenteditable], textarea');
      if (inner) {
        AICS.log('Gemini input found in rich-textarea children');
        return inner;
      }
    }

    AICS.log('Gemini: No input found');
    return null;
  }

  // ── Inject into Gemini ──
  async function customInject(input, prompt) {
    AICS.log('Gemini: Starting injection into', input.tagName, input.className);
    input.focus();
    await new Promise(r => setTimeout(r, 500));

    if (input.classList.contains('ql-editor')) {
      // Quill editor — set content as paragraph
      input.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = prompt;
      input.appendChild(p);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      AICS.log('Gemini: Injected via Quill paragraph');
    } else if (input.getAttribute('contenteditable') !== null) {
      input.textContent = '';
      const success = document.execCommand('insertText', false, prompt);
      if (!success) input.innerText = prompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      AICS.log('Gemini: Injected via contenteditable');
    } else {
      await AICS.typeIntoElement(input, prompt);
      AICS.log('Gemini: Injected via typeIntoElement');
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

  // ── AUTO-PASTE on page load ──
  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
