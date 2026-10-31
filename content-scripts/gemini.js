// ============================================
// AI Context Switcher — Gemini Content Script
// Extracts & injects chat on gemini.google.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'gemini';
  const PLATFORM_NAME = 'Gemini';

  // ── Extract conversation messages from Gemini DOM ──
  function extractMessages() {
    const messages = [];

    // Gemini uses specific selectors for conversation turns
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

    // Fallback: Look for user/model message patterns
    if (messages.length === 0) {
      const userMsgs = document.querySelectorAll('.user-query, [class*="user-message"], .query-text');
      const modelMsgs = document.querySelectorAll('.model-response, [class*="model-response"], .response-text, .markdown-main-panel');

      // Interleave if counts match
      const maxLen = Math.max(userMsgs.length, modelMsgs.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < userMsgs.length) {
          messages.push({
            role: 'user',
            content: userMsgs[i].innerText.trim().substring(0, 5000)
          });
        }
        if (i < modelMsgs.length) {
          messages.push({
            role: 'assistant',
            content: modelMsgs[i].innerText.trim().substring(0, 5000)
          });
        }
      }
    }

    // Generic fallback
    if (messages.length === 0) {
      const container = document.querySelector('.conversation-container, [class*="chat-history"], main');
      if (container) {
        const allBlocks = container.querySelectorAll('[class*="turn"], [class*="message"]');
        allBlocks.forEach((block, i) => {
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

  // ── Get chat title ──
  function getChatTitle() {
    const titleEl = document.querySelector('.conversation-title, [class*="chat-title"], h1');
    if (titleEl) return titleEl.textContent.trim();
    return 'Gemini Conversation';
  }

  // ── Find input element ──
  function getInputElement() {
    return document.querySelector('.ql-editor[contenteditable="true"]') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('rich-textarea .ql-editor') ||
           document.querySelector('.text-input-field_textarea-wrapper textarea') ||
           document.querySelector('textarea');
  }

  // ── Inject context ──
  async function injectContext(context) {
    const prompt = AICS.buildContextPrompt(context);
    const input = getInputElement();

    if (!input) {
      AICS.showToast('Could not find Gemini input field');
      return;
    }

    // Gemini uses Quill editor
    if (input.classList.contains('ql-editor')) {
      input.focus();
      input.innerHTML = `<p>${prompt.replace(/\n/g, '</p><p>')}</p>`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      await AICS.typeIntoElement(input, prompt);
    }

    AICS.showToast('✅ Context pasted! Press Enter or click Send.');
  }

  // ── Listen for messages ──
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

  // ── Init ──
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
            context.messages.length,
            sourceName,
            () => injectContext(context),
            () => AICS.showToast('Context dismissed')
          );
        }
      }, 3000);
    }
  }

  init();
})();
