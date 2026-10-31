// ============================================
// AI Context Switcher — Shared Utilities
// ROBUST auto-paste with retry + clipboard fallback
// ============================================

const AICS = {
  LOG_PREFIX: '[AI-Switch]',

  log(...args) {
    console.log(this.LOG_PREFIX, ...args);
  },

  // ── Toast notification ──
  showToast(message) {
    let toast = document.getElementById('aics-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aics-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
  },

  // ── Show floating context panel (FALLBACK if auto-paste fails) ──
  showContextPanel(prompt, sourceName, msgCount) {
    if (document.getElementById('aics-context-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'aics-context-panel';
    panel.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 2147483647;
      width: 380px; max-height: 500px; overflow-y: auto;
      background: #1a1a2e; border: 2px solid #7c3aed; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6); font-family: 'Inter', system-ui, sans-serif;
      color: #f0f0f5; animation: aics-slideDown 0.4s ease;
    `;
    panel.innerHTML = `
      <div style="padding:16px; border-bottom:1px solid rgba(124,58,237,0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:14px; font-weight:700; color:#a78bfa;">⚡ Context Ready</div>
            <div style="font-size:11px; color:#8888a8; margin-top:2px;">${msgCount} messages from ${sourceName}</div>
          </div>
          <button id="aics-panel-close" style="background:none; border:none; color:#8888a8; cursor:pointer; font-size:18px; padding:4px;">✕</button>
        </div>
      </div>
      <div style="padding:12px 16px;">
        <button id="aics-copy-btn" style="
          width:100%; padding:12px; border:none; border-radius:10px;
          background:linear-gradient(135deg,#7c3aed,#6d28d9); color:white;
          font-size:14px; font-weight:600; cursor:pointer; font-family:inherit;
          margin-bottom:8px;
        ">📋 Copy Context & Paste with Ctrl+V</button>
        <div style="font-size:10px; color:#5a5a7a; text-align:center;">
          Click the button above, then click the chat input and press Ctrl+V
        </div>
      </div>
      <div style="padding:0 16px 12px;">
        <details>
          <summary style="font-size:11px; color:#8888a8; cursor:pointer; padding:6px 0;">Preview context...</summary>
          <pre id="aics-context-text" style="
            font-size:10px; color:#8888a8; white-space:pre-wrap; word-break:break-word;
            max-height:200px; overflow-y:auto; background:rgba(0,0,0,0.3);
            padding:8px; border-radius:8px; margin-top:6px;
          ">${this.escapeHtml(prompt.substring(0, 2000))}${prompt.length > 2000 ? '...' : ''}</pre>
        </details>
      </div>
    `;

    document.body.appendChild(panel);

    // Copy button
    panel.querySelector('#aics-copy-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        panel.querySelector('#aics-copy-btn').textContent = '✅ Copied! Now Ctrl+V in the chat input';
        panel.querySelector('#aics-copy-btn').style.background = 'linear-gradient(135deg,#10b981,#059669)';
      } catch (e) {
        // Fallback: textarea copy
        const ta = document.createElement('textarea');
        ta.value = prompt;
        ta.style.cssText = 'position:fixed;left:-9999px;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        panel.querySelector('#aics-copy-btn').textContent = '✅ Copied! Now Ctrl+V in the chat input';
        panel.querySelector('#aics-copy-btn').style.background = 'linear-gradient(135deg,#10b981,#059669)';
      }
    });

    // Close button
    panel.querySelector('#aics-panel-close').addEventListener('click', () => panel.remove());

    // Auto-remove after 2 minutes
    setTimeout(() => { if (panel.parentNode) panel.remove(); }, 120000);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ── Build context prompt ──
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

    prompt += `\n---\n\nPlease continue from where we left off. You have the full context above.`;
    return prompt;
  },

  // ── Type text into an input element ──
  async typeIntoElement(element, text) {
    this.log('Typing into element:', element.tagName, element.id || element.className);
    element.focus();

    // For contenteditable divs
    if (element.getAttribute('contenteditable') !== null) {
      element.textContent = '';
      // Try execCommand first
      const success = document.execCommand('insertText', false, text);
      if (!success) {
        // Direct innerHTML set as fallback
        element.innerText = text;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      // Also dispatch KeyboardEvent to trigger React/Vue listeners
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }
    // For textareas
    else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      try {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
          'value'
        ).set;
        nativeSetter.call(element, text);
      } catch (e) {
        element.value = text;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }
  },

  // ── Check for pending context switch ──
  async checkPendingSwitch() {
    try {
      const result = await chrome.storage.local.get('pendingSwitch');
      const pending = result.pendingSwitch;
      this.log('Checking pendingSwitch:', pending);
      if (pending && (Date.now() - pending.timestamp < 120000)) { // 2 minute window
        await chrome.storage.local.remove('pendingSwitch');
        this.log('Found pending switch! Cleared.');
        return true;
      }
    } catch (e) {
      this.log('Error checking pending switch:', e);
    }
    return false;
  },

  // ── Get saved context from storage ──
  async getSavedContext() {
    try {
      const result = await chrome.storage.local.get('currentContext');
      this.log('Saved context:', result.currentContext ? `${result.currentContext.messages?.length} messages` : 'none');
      return result.currentContext || null;
    } catch (e) {
      this.log('Error getting context:', e);
      return null;
    }
  },

  // ══════════════════════════════════════════
  // MAIN AUTO-PASTE FUNCTION
  // Called when content script loads on target AI
  // ══════════════════════════════════════════
  async autoPasteContext(getInputFn, platformName, customInjectFn) {
    this.log(`Content script loaded on ${platformName}`);

    // Step 1: Check if this page load is from a context switch
    const hasPending = await this.checkPendingSwitch();
    if (!hasPending) {
      this.log('No pending switch found, skipping auto-paste.');
      return;
    }

    // Step 2: Get the saved context
    const context = await this.getSavedContext();
    if (!context || !context.messages || context.messages.length === 0) {
      this.log('No context found in storage!');
      return;
    }

    const sourceName = context.sourcePlatform
      ? context.sourcePlatform.charAt(0).toUpperCase() + context.sourcePlatform.slice(1)
      : 'another AI';

    const msgCount = context.messages.length;
    const prompt = this.buildContextPrompt(context);

    this.log(`Context found: ${msgCount} messages from ${sourceName}. Starting auto-paste...`);

    // Step 3: Wait for input field with aggressive retry
    let input = null;
    const maxAttempts = 15;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Wait longer on each attempt
      const delay = attempt <= 3 ? 2000 : attempt <= 6 ? 3000 : 4000;
      await new Promise(r => setTimeout(r, delay));

      input = getInputFn();

      if (input) {
        this.log(`Input found on attempt ${attempt}!`, input.tagName, input.id || input.className);
        break;
      }

      this.log(`Attempt ${attempt}/${maxAttempts}: Input not found, waiting ${delay}ms...`);
    }

    // Step 4: Paste the context
    if (input) {
      try {
        this.log('Injecting context into input field...');

        if (customInjectFn) {
          await customInjectFn(input, prompt, context);
        } else {
          await this.typeIntoElement(input, prompt);
        }

        this.log('✅ Context injected successfully!');
        this.showToast(`⚡ ${msgCount} messages from ${sourceName} pasted! Press Enter to send.`);
        return; // SUCCESS!
      } catch (error) {
        this.log('❌ DOM injection failed:', error.message);
      }
    } else {
      this.log('❌ Could not find input field after all attempts.');
    }

    // Step 5: FALLBACK — Show floating panel with copy button
    this.log('Falling back to context panel with copy button...');
    this.showContextPanel(prompt, sourceName, msgCount);
  }
};
