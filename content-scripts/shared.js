// ============================================
// AI Context Switcher — Shared Utilities
// Used by all platform content scripts
// ============================================

const AICS = {
  // ── Show a toast notification on the page ──
  showToast(message) {
    let toast = document.getElementById('aics-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aics-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  },

  // ── Show a status banner at top of page ──
  showStatusBanner(message, type = 'loading') {
    let banner = document.getElementById('aics-inject-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'aics-inject-banner';
      document.body.appendChild(banner);
    }

    const icons = {
      loading: '⏳',
      success: '✅',
      error: '❌'
    };

    banner.innerHTML = `
      <div class="aics-banner-text">
        <span class="aics-banner-icon">${icons[type] || '⚡'}</span>
        <span>
          <span class="aics-banner-highlight">${message}</span>
        </span>
      </div>
    `;

    // Auto-remove success/error banners after delay
    if (type === 'success') {
      setTimeout(() => banner.remove(), 4000);
    } else if (type === 'error') {
      setTimeout(() => banner.remove(), 6000);
    }
  },

  removeStatusBanner() {
    const banner = document.getElementById('aics-inject-banner');
    if (banner) banner.remove();
  },

  // ── Build context prompt for pasting ──
  buildContextPrompt(context) {
    let prompt = `I'm continuing a conversation from ${context.sourcePlatform || 'another AI'}. Here's the context of our previous discussion:\n\n`;
    prompt += `---\n\n`;

    context.messages.forEach((msg, i) => {
      const role = msg.role === 'user' ? '**User**' : '**Assistant**';
      prompt += `${role}:\n${msg.content}\n\n`;
      if (i < context.messages.length - 1) {
        prompt += `---\n\n`;
      }
    });

    prompt += `\n---\n\n`;
    prompt += `Please continue from where we left off. You have the full context above.`;
    return prompt;
  },

  // ── Type text into an input/textarea with simulated events ──
  async typeIntoElement(element, text) {
    element.focus();

    // For contenteditable divs
    if (element.getAttribute('contenteditable') !== null) {
      element.textContent = '';
      document.execCommand('insertText', false, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // For textareas
    else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeSetter.call(element, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },

  // ── Wait for element to appear on page ──
  waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver((_, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  },

  // ── Wait for any of multiple selectors ──
  waitForAnyElement(selectors, timeout = 15000) {
    return new Promise((resolve, reject) => {
      // Check immediately
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return resolve(el);
      }

      const observer = new MutationObserver((_, obs) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            obs.disconnect();
            resolve(el);
            return;
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`None of the elements found within ${timeout}ms`));
      }, timeout);
    });
  },

  // ── Check for pending context switch ──
  async checkPendingSwitch() {
    const result = await chrome.storage.local.get('pendingSwitch');
    const pending = result.pendingSwitch;
    if (pending && (Date.now() - pending.timestamp < 60000)) {
      await chrome.storage.local.remove('pendingSwitch');
      return true;
    }
    return false;
  },

  // ── Get saved context ──
  async getSavedContext() {
    const result = await chrome.storage.local.get('currentContext');
    return result.currentContext || null;
  },

  // ── Auto-paste context into the target AI platform ──
  // This is the main function that handles automatic context injection
  async autoPasteContext(getInputFn, platformName, injectFn) {
    const hasPending = await this.checkPendingSwitch();
    if (!hasPending) return;

    const context = await this.getSavedContext();
    if (!context || !context.messages || context.messages.length === 0) return;

    const sourceName = context.sourcePlatform
      ? context.sourcePlatform.charAt(0).toUpperCase() + context.sourcePlatform.slice(1)
      : 'another AI';

    // Show loading banner
    this.showStatusBanner(
      `Pasting ${context.messages.length} messages from ${sourceName} into ${platformName}...`,
      'loading'
    );

    // Wait for the page to fully load and input to be available
    // Retry multiple times with increasing delays
    let input = null;
    let attempts = 0;
    const maxAttempts = 10;
    const delays = [1000, 2000, 2000, 3000, 3000, 3000, 4000, 4000, 5000, 5000];

    while (!input && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, delays[attempts] || 3000));
      input = getInputFn();
      attempts++;

      if (!input) {
        console.log(`[AICS] Attempt ${attempts}/${maxAttempts}: Input not found yet, retrying...`);
      }
    }

    if (!input) {
      this.showStatusBanner(
        `Could not find ${platformName} input field. Please paste manually.`,
        'error'
      );
      // Copy to clipboard as fallback
      const prompt = this.buildContextPrompt(context);
      try {
        await navigator.clipboard.writeText(prompt);
        this.showToast('📋 Context copied to clipboard! Press Ctrl+V to paste.');
      } catch (e) {
        console.warn('Clipboard copy failed:', e);
      }
      return;
    }

    // Build the context prompt
    const prompt = this.buildContextPrompt(context);

    // Use custom inject function if provided, otherwise use generic
    try {
      if (injectFn) {
        await injectFn(input, prompt, context);
      } else {
        await this.typeIntoElement(input, prompt);
      }

      this.showStatusBanner(
        `✅ ${context.messages.length} messages from ${sourceName} pasted! Press Enter to send.`,
        'success'
      );
      this.showToast(`⚡ Context from ${sourceName} auto-pasted! Just press Enter!`);
    } catch (error) {
      console.error('[AICS] Auto-paste failed:', error);
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(prompt);
        this.showStatusBanner(
          `Auto-paste failed. Context copied to clipboard — press Ctrl+V to paste.`,
          'error'
        );
      } catch (e) {
        this.showStatusBanner(`Auto-paste failed. Please try again.`, 'error');
      }
    }
  }
};
