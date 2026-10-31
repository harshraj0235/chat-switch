// ============================================
// AI Context Switcher — DeepSeek Content Script
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'deepseek';
  const PLATFORM_NAME = 'DeepSeek';

  function extractMessages() {
    const messages = [];
    const msgElements = document.querySelectorAll('[class*="message-"], [class*="chat-message"]');
    if (msgElements.length > 0) {
      msgElements.forEach(el => {
        const text = el.innerText.trim();
        if (text.length > 2) {
          const isUser = el.classList.toString().includes('user') || el.classList.toString().includes('human');
          messages.push({ role: isUser ? 'user' : 'assistant', content: text.substring(0, 5000) });
        }
      });
    }
    if (messages.length === 0) {
      const container = document.querySelector('#chat-container, [class*="chat"], main');
      if (container) {
        const blocks = container.querySelectorAll('.markdown-body, [class*="content"]');
        blocks.forEach((block, i) => {
          const text = block.innerText.trim();
          if (text.length > 5) messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: text.substring(0, 5000) });
        });
      }
    }
    return messages;
  }

  function getChatTitle() { return document.querySelector('[class*="title"], h1')?.textContent?.trim() || 'DeepSeek Conversation'; }

  function getInputElement() {
    const selectors = ['textarea#chat-input', 'textarea[placeholder]', 'textarea', '[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]', '[contenteditable="true"]'];
    for (const sel of selectors) { const el = document.querySelector(sel); if (el) { AICS.log('DeepSeek input found:', sel); return el; } }
    return null;
  }

  async function customInject(input, prompt) { await AICS.typeIntoElement(input, prompt); }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_CHAT') sendResponse({ messages: extractMessages(), title: getChatTitle(), platform: PLATFORM_ID });
    if (message.action === 'INJECT_CONTEXT') { const input = getInputElement(); if (input) customInject(input, AICS.buildContextPrompt(message.context)); sendResponse({ success: true }); }
  });

  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
