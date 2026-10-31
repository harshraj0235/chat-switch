// ============================================
// AI Context Switcher — ChatGPT Content Script
// Extracts & injects chat on chatgpt.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'chatgpt';
  const PLATFORM_NAME = 'ChatGPT';

  // ── Extract conversation messages from ChatGPT DOM ──
  function extractMessages() {
    const messages = [];

    // ChatGPT uses article elements or divs with data-message-author-role
    const messageEls = document.querySelectorAll('[data-message-author-role]');

    if (messageEls.length > 0) {
      messageEls.forEach(el => {
        const role = el.getAttribute('data-message-author-role');
        const contentEl = el.querySelector('.markdown, .whitespace-pre-wrap, p');
        if (contentEl && (role === 'user' || role === 'assistant')) {
          messages.push({
            role: role,
            content: contentEl.innerText.trim()
          });
        }
      });
    }

    // Fallback: Try the conversation turn structure
    if (messages.length === 0) {
      const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
      turns.forEach(turn => {
        const isUser = turn.querySelector('[data-message-author-role="user"]');
        const isAssistant = turn.querySelector('[data-message-author-role="assistant"]');
        const contentEl = turn.querySelector('.markdown, .whitespace-pre-wrap, p');

        if (contentEl) {
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: contentEl.innerText.trim()
          });
        }
      });
    }

    // Another fallback: generic approach
    if (messages.length === 0) {
      const allDivs = document.querySelectorAll('main .group\\/conversation-turn');
      allDivs.forEach((div, index) => {
        const textContent = div.innerText.trim();
        if (textContent.length > 0) {
          messages.push({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: textContent.substring(0, 5000) // Cap per message
          });
        }
      });
    }

    return messages;
  }

  // ── Get chat title ──
  function getChatTitle() {
    // Try the nav element for current chat name
    const activeNav = document.querySelector('nav a.bg-token-sidebar-surface-secondary, nav li.relative a[class*="bg-"]');
    if (activeNav) return activeNav.textContent.trim();

    // Fallback
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim();

    return 'ChatGPT Conversation';
  }

  // ── Find the input textarea ──
  function getInputElement() {
    return document.querySelector('#prompt-textarea') ||
           document.querySelector('textarea[data-id="root"]') ||
           document.querySelector('[contenteditable="true"][id="prompt-textarea"]') ||
           document.querySelector('div#prompt-textarea[contenteditable]');
  }

  // ── Click the send button ──
  function clickSend() {
    const sendBtn = document.querySelector('[data-testid="send-button"]') ||
                    document.querySelector('button[aria-label="Send prompt"]') ||
                    document.querySelector('form button[type="submit"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return true;
    }
    return false;
  }

  // ── Inject context into the chat ──
  async function injectContext(context) {
    const prompt = AICS.buildContextPrompt(context);
    const input = getInputElement();

    if (!input) {
      AICS.showToast('Could not find ChatGPT input field');
      return;
    }

    await AICS.typeIntoElement(input, prompt);
    AICS.showToast('✅ Context pasted! Press Enter or click Send.');
  }

  // ── Listen for messages from popup/background ──
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

  // ── On page load, check if we should inject context ──
  async function init() {
    const hasPending = await AICS.checkPendingSwitch();
    if (hasPending) {
      // Wait for page to fully load
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
