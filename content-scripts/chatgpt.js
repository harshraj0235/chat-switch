// ============================================
// AI Context Switcher — ChatGPT Content Script
// Extracts & AUTO-PASTES chat on chatgpt.com
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'chatgpt';
  const PLATFORM_NAME = 'ChatGPT';

  // ── Extract conversation messages from ChatGPT DOM ──
  function extractMessages() {
    const messages = [];

    // ChatGPT uses article elements with data-message-author-role
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

    // Fallback: conversation turn structure
    if (messages.length === 0) {
      const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
      turns.forEach(turn => {
        const isUser = turn.querySelector('[data-message-author-role="user"]');
        const contentEl = turn.querySelector('.markdown, .whitespace-pre-wrap, p');
        if (contentEl) {
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: contentEl.innerText.trim()
          });
        }
      });
    }

    // Another fallback
    if (messages.length === 0) {
      const allDivs = document.querySelectorAll('main .group\\/conversation-turn');
      allDivs.forEach((div, index) => {
        const textContent = div.innerText.trim();
        if (textContent.length > 0) {
          messages.push({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: textContent.substring(0, 5000)
          });
        }
      });
    }

    return messages;
  }

  // ── Get chat title ──
  function getChatTitle() {
    const activeNav = document.querySelector('nav a.bg-token-sidebar-surface-secondary, nav li.relative a[class*="bg-"]');
    if (activeNav) return activeNav.textContent.trim();
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim();
    return 'ChatGPT Conversation';
  }

  // ── Find the input element ──
  function getInputElement() {
    return document.querySelector('#prompt-textarea') ||
           document.querySelector('textarea[data-id="root"]') ||
           document.querySelector('[contenteditable="true"][id="prompt-textarea"]') ||
           document.querySelector('div#prompt-textarea[contenteditable]') ||
           document.querySelector('div[contenteditable="true"]') ||
           document.querySelector('textarea');
  }

  // ── Custom inject for ChatGPT ──
  async function customInject(input, prompt, context) {
    input.focus();

    if (input.getAttribute('contenteditable') !== null) {
      // ChatGPT uses contenteditable div
      input.textContent = '';
      document.execCommand('insertText', false, prompt);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Textarea fallback
      await AICS.typeIntoElement(input, prompt);
    }
  }

  // ── Listen for messages from popup/background ──
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

  // ── AUTO-PASTE: When page loads after a switch, paste context automatically ──
  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
