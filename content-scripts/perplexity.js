// ============================================
// AI Context Switcher — Perplexity Content Script
// Extracts & injects chat on perplexity.ai
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'perplexity';
  const PLATFORM_NAME = 'Perplexity';

  // ── Extract messages ──
  function extractMessages() {
    const messages = [];

    // Perplexity has a thread-based structure
    const queryBlocks = document.querySelectorAll('[class*="query"], .whitespace-pre-line');
    const answerBlocks = document.querySelectorAll('[class*="answer"], .prose, .markdown');

    // Try structured approach
    const threadItems = document.querySelectorAll('[class*="thread-"], [class*="message"]');

    if (threadItems.length > 0) {
      threadItems.forEach(item => {
        const text = item.innerText.trim();
        if (text.length > 5) {
          const isUser = item.classList.toString().includes('query') ||
                        item.classList.toString().includes('user') ||
                        item.classList.toString().includes('question');
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 5000)
          });
        }
      });
    }

    // Fallback: parse the main content area
    if (messages.length === 0) {
      const main = document.querySelector('main, [class*="thread"]');
      if (main) {
        // Look for question/answer pairs
        const sections = main.querySelectorAll('[class*="block"], [class*="section"], [class*="turn"]');
        sections.forEach((section, i) => {
          const text = section.innerText.trim();
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

  function getChatTitle() {
    const titleEl = document.querySelector('h1, [class*="title"], title');
    if (titleEl) return titleEl.textContent.trim();
    return 'Perplexity Conversation';
  }

  function getInputElement() {
    return document.querySelector('textarea[placeholder]') ||
           document.querySelector('textarea') ||
           document.querySelector('[contenteditable="true"]');
  }

  async function injectContext(context) {
    const prompt = AICS.buildContextPrompt(context);
    const input = getInputElement();

    if (!input) {
      AICS.showToast('Could not find Perplexity input field');
      return;
    }

    await AICS.typeIntoElement(input, prompt);
    AICS.showToast('✅ Context pasted! Press Enter or click Send.');
  }

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
            context.messages.length, sourceName,
            () => injectContext(context),
            () => AICS.showToast('Context dismissed')
          );
        }
      }, 3000);
    }
  }

  init();
})();
