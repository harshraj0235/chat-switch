// ============================================
// AI Context Switcher — Perplexity Content Script
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'perplexity';
  const PLATFORM_NAME = 'Perplexity';

  function extractMessages() {
    const messages = [];
    const threadItems = document.querySelectorAll('[class*="thread-"], [class*="message"], [class*="query"], [class*="answer"]');
    if (threadItems.length > 0) {
      threadItems.forEach(item => {
        const text = item.innerText.trim();
        if (text.length > 5) {
          const isUser = item.classList.toString().includes('query') || item.classList.toString().includes('user');
          messages.push({ role: isUser ? 'user' : 'assistant', content: text.substring(0, 5000) });
        }
      });
    }
    return messages;
  }

  function getChatTitle() { return document.querySelector('h1, [class*="title"]')?.textContent?.trim() || 'Perplexity Conversation'; }

  function getInputElement() {
    const selectors = ['textarea[placeholder]', 'textarea', '[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]', '[contenteditable="true"]'];
    for (const sel of selectors) { const el = document.querySelector(sel); if (el) { AICS.log('Perplexity input found:', sel); return el; } }
    return null;
  }

  async function customInject(input, prompt) { await AICS.typeIntoElement(input, prompt); }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_CHAT') sendResponse({ messages: extractMessages(), title: getChatTitle(), platform: PLATFORM_ID });
    if (message.action === 'INJECT_CONTEXT') { const input = getInputElement(); if (input) customInject(input, AICS.buildContextPrompt(message.context)); sendResponse({ success: true }); }
  });

  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
