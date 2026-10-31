// ============================================
// AI Context Switcher — Copilot Content Script
// ============================================

(function() {
  'use strict';

  const PLATFORM_ID = 'copilot';
  const PLATFORM_NAME = 'Microsoft Copilot';

  function extractMessages() {
    const messages = [];
    const userMsgs = document.querySelectorAll('[class*="user-message"], [class*="request"], [data-content="user"]');
    const botMsgs = document.querySelectorAll('[class*="bot-message"], [class*="response"], [data-content="bot"]');
    const maxLen = Math.max(userMsgs.length, botMsgs.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < userMsgs.length) messages.push({ role: 'user', content: userMsgs[i].innerText.trim().substring(0, 5000) });
      if (i < botMsgs.length) messages.push({ role: 'assistant', content: botMsgs[i].innerText.trim().substring(0, 5000) });
    }
    return messages;
  }

  function getChatTitle() { return document.querySelector('h1, [class*="title"]')?.textContent?.trim() || 'Copilot Conversation'; }

  function getInputElement() {
    const selectors = ['#searchbox', 'textarea[placeholder]', 'textarea', '[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]', '[contenteditable="true"]'];
    for (const sel of selectors) { const el = document.querySelector(sel); if (el) { AICS.log('Copilot input found:', sel); return el; } }
    return null;
  }

  async function customInject(input, prompt) { await AICS.typeIntoElement(input, prompt); }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_CHAT') sendResponse({ messages: extractMessages(), title: getChatTitle(), platform: PLATFORM_ID });
    if (message.action === 'INJECT_CONTEXT') { const input = getInputElement(); if (input) customInject(input, AICS.buildContextPrompt(message.context)); sendResponse({ success: true }); }
  });

  AICS.autoPasteContext(getInputElement, PLATFORM_NAME, customInject);
})();
