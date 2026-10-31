// ============================================
// AI Context Switcher — Claude Content Script
// Extracts & AUTO-PASTES chat on claude.ai
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'claude';
  const PLATFORM_NAME = 'Claude';

  // ── Extract conversation messages from Claude DOM ──
  function extractMessages() {
    const messages = [];

    // Try structured message containers
    const humanTurns = document.querySelectorAll('[data-testid="user-human-turn"]');
    const botTurns = document.querySelectorAll('[data-testid="user-bot-turn"]');

    if (humanTurns.length > 0 || botTurns.length > 0) {
      // Collect all turns with their positions
      const allTurns = [];
      humanTurns.forEach(el => {
        const rect = el.getBoundingClientRect();
        allTurns.push({ el, role: 'user', top: rect.top });
      });
      botTurns.forEach(el => {
        const rect = el.getBoundingClientRect();
        allTurns.push({ el, role: 'assistant', top: rect.top });
      });

      // Sort by vertical position
      allTurns.sort((a, b) => a.top - b.top);

      allTurns.forEach(turn => {
        const text = turn.el.innerText.trim();
        if (text.length > 2) {
          messages.push({
            role: turn.role,
            content: text.substring(0, 5000)
          });
        }
      });
    }

    // Fallback: data-test-render-count elements
    if (messages.length === 0) {
      const containers = document.querySelectorAll('[data-test-render-count]');
      containers.forEach(container => {
        const isHuman = container.closest('[data-testid="user-human-turn"]') !== null;
        const text = container.innerText.trim();
        if (text) {
          messages.push({
            role: isHuman ? 'user' : 'assistant',
            content: text.substring(0, 5000)
          });
        }
      });
    }

    // Generic fallback
    if (messages.length === 0) {
      const main = document.querySelector('main, [class*="conversation"]');
      if (main) {
        const blocks = main.querySelectorAll('[class*="human"], [class*="assistant"], [class*="turn"]');
        blocks.forEach(block => {
          const text = block.innerText.trim();
          if (text.length > 5) {
            const isHuman = block.className.includes('human') ||
                           block.getAttribute('data-testid')?.includes('human');
            messages.push({
              role: isHuman ? 'user' : 'assistant',
              content: text.substring(0, 5000)
            });
          }
        });
      }
    }

    return messages;
  }

  function getChatTitle() {
    const titleEl = document.querySelector('[data-testid="chat-title"], h1, title');
    if (titleEl) return titleEl.textContent.trim();
    return 'Claude Conversation';
  }

  // ── Find the input element ──
  function getInputElement() {
    return document.querySelector('[contenteditable="true"].ProseMirror') ||
           document.querySelector('.ProseMirror[contenteditable="true"]') ||
           document.querySelector('div[contenteditable="true"]') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('textarea');
  }

  // ── Custom inject for Claude (ProseMirror editor) ──
  async function customInject(input, prompt, context) {
    input.focus();

    // Claude uses ProseMirror
    if (input.classList.contains('ProseMirror') || input.getAttribute('contenteditable') !== null) {
      // Clear existing content
      input.innerHTML = '';

      // Create paragraph with text
      const p = document.createElement('p');
      p.textContent = prompt;
      input.appendChild(p);

      // Dispatch events to trigger ProseMirror update
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Also try execCommand as backup
      try {
        input.innerHTML = '';
        input.focus();
        document.execCommand('insertText', false, prompt);
      } catch (e) {
        // ProseMirror paragraph approach already done above
      }
    } else {
      await AICS.typeIntoElement(input, prompt);
    }
  }

  // ── Listen for messages ──
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
