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
    setTimeout(() => toast.classList.remove('show'), 3000);
  },

  // ── Show injection banner when context is available ──
  showInjectionBanner(messageCount, sourcePlatform, onPaste, onDismiss) {
    if (document.getElementById('aics-inject-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'aics-inject-banner';
    banner.innerHTML = `
      <div class="aics-banner-text">
        <span class="aics-banner-icon">⚡</span>
        <span>
          <span class="aics-banner-highlight">${messageCount} messages</span>
          from ${sourcePlatform} ready to paste
        </span>
      </div>
      <button class="aics-btn-paste">Paste Context</button>
      <button class="aics-btn-dismiss">Dismiss</button>
    `;

    banner.querySelector('.aics-btn-paste').addEventListener('click', () => {
      onPaste();
      banner.remove();
    });

    banner.querySelector('.aics-btn-dismiss').addEventListener('click', () => {
      onDismiss();
      banner.remove();
    });

    document.body.appendChild(banner);
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
      // Set inner text
      element.textContent = '';

      // Use execCommand for compatibility
      document.execCommand('insertText', false, text);

      // Dispatch events
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
  waitForElement(selector, timeout = 10000) {
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

  // ── Check for pending context switch ──
  async checkPendingSwitch() {
    const result = await chrome.storage.local.get('pendingSwitch');
    const pending = result.pendingSwitch;
    if (pending && (Date.now() - pending.timestamp < 30000)) {
      // Clear the pending switch
      await chrome.storage.local.remove('pendingSwitch');
      return true;
    }
    return false;
  }
};
