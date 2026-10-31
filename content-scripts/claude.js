// ============================================
// AI Context Switcher — Claude Content Script
// Extracts & injects chat on claude.ai
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'claude';
  const PLATFORM_NAME = 'Claude';

  // ── Extract conversation messages from Claude DOM ──
  function extractMessages() {
    const messages = [];

    // Claude uses [data-testid] attributes for messages
    // Human messages and assistant messages
    const humanMsgs = document.querySelectorAll('[data-testid="user-human-turn"]');
    const botMsgs = document.querySelectorAll('[data-testid="user-bot-turn"]');

    // Try a combined approach by looking at all turns
    const allTurns = document.querySelectorAll('.font-claude-message, .font-user-message, [class*="turn"], [class*="message"]');

    // Primary: Look for the structured message containers
    const messageContainers = document.querySelectorAll('[data-test-render-count]');

    if (messageContainers.length > 0) {
      messageContainers.forEach(container => {
        // Detect role by checking classes or parent structure
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

    // Fallback: Parse from broader DOM
    if (messages.length === 0) {
      const conversationDiv = document.querySelector('[class*="conversation"], [class*="chat-messages"], main');
      if (conversationDiv) {
        // Look for alternating user/assistant blocks
        const blocks = conversationDiv.querySelectorAll('[class*="human"], [class*="assistant"], [class*="turn"]');
        blocks.forEach(block => {
          const text = block.innerText.trim();
          if (text.length > 5) {
            const isHuman = block.className.includes('human') ||
                           block.getAttribute('data-testid')?.includes('human') ||
                           block.querySelector('[class*="human"]') !== null;
            messages.push({
              role: isHuman ? 'user' : 'assistant',
              content: text.substring(0, 5000)
            });
          }
        });
      }
    }

    // Generic fallback
    if (messages.length === 0) {
      const grid = document.querySelector('.grid-cols-1, [class*="thread"]');
      if (grid) {
        const children = grid.children;
        for (let i = 0; i < children.length; i++) {
          const text = children[i].innerText.trim();
          if (text.length > 5) {
            messages.push({
              role: i % 2 === 0 ? 'user' : 'assistant',
              content: text.substring(0, 5000)
            });
          }
        }
      }
    }

    return messages;
  }

  // ── Get chat title ──
  function getChatTitle() {
    const titleEl = document.querySelector('[data-testid="chat-title"], h1, title');
    if (titleEl) return titleEl.textContent.trim();
    return 'Claude Conversation';
  }

  // ── Find the input element ──
  function getInputElement() {
    return document.querySelector('[contenteditable="true"].ProseMirror') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('div[data-placeholder]') ||
           document.querySelector('.ProseMirror');
  }

  // ── Inject context ──
  async function injectContext(context) {
    const prompt = AICS.buildContextPrompt(context);
    const input = getInputElement();

    if (!input) {
      AICS.showToast('Could not find Claude input field');
      return;
    }

    // Claude uses ProseMirror, need special handling
    input.focus();
    input.innerHTML = '';

    // Create a paragraph element for ProseMirror
    const p = document.createElement('p');
    p.textContent = prompt;
    input.appendChild(p);

    // Dispatch input event
    input.dispatchEvent(new Event('input', { bubbles: true }));

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

  // ── On page load, check for pending context ──
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
