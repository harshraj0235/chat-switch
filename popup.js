// ============================================
// AI Context Switcher — Popup Logic
// ============================================

const PLATFORMS = {
  chatgpt: { name: 'ChatGPT', icon: '🟢', color: '#10a37f' },
  claude:  { name: 'Claude',  icon: '🟠', color: '#d97706' },
  gemini:  { name: 'Gemini',  icon: '🔵', color: '#4285f4' },
  deepseek:{ name: 'DeepSeek',icon: '🟣', color: '#7c3aed' },
  perplexity:{ name: 'Perplexity', icon: '🔷', color: '#20b2aa' },
  copilot: { name: 'Copilot', icon: '🟦', color: '#0078d4' }
};

let currentPlatform = null;
let currentContext = null;

document.addEventListener('DOMContentLoaded', async () => {
  await detectCurrentPlatform();
  await loadContext();
  renderPlatformGrid();
  await loadHistory();
  setupEventListeners();
});

// ── Detect which AI platform the user is currently on ──
async function detectCurrentPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      if (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com')) currentPlatform = 'chatgpt';
      else if (tab.url.includes('claude.ai')) currentPlatform = 'claude';
      else if (tab.url.includes('gemini.google.com')) currentPlatform = 'gemini';
      else if (tab.url.includes('deepseek.com')) currentPlatform = 'deepseek';
      else if (tab.url.includes('perplexity.ai')) currentPlatform = 'perplexity';
      else if (tab.url.includes('copilot.microsoft.com')) currentPlatform = 'copilot';
    }
  } catch (e) {
    console.warn('Could not detect platform:', e);
  }

  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');
  const captureBtn = document.getElementById('captureBtn');

  if (currentPlatform) {
    const p = PLATFORMS[currentPlatform];
    statusBar.classList.add('active');
    statusText.textContent = `On ${p.icon} ${p.name} — Ready to capture`;
    captureBtn.disabled = false;
  } else {
    statusText.textContent = 'Open an AI chat to capture context';
    captureBtn.disabled = true;
  }
}

// ── Load existing context ──
async function loadContext() {
  const response = await chrome.runtime.sendMessage({ action: 'GET_CONTEXT' });
  currentContext = response?.context;
  renderContextCard();
}

// ── Render context preview card ──
function renderContextCard() {
  const card = document.getElementById('contextCard');
  const emptyState = document.getElementById('emptyState');
  const source = document.getElementById('contextSource');
  const count = document.getElementById('contextCount');
  const preview = document.getElementById('contextPreview');

  if (currentContext && currentContext.messages && currentContext.messages.length > 0) {
    card.style.display = 'block';
    emptyState.style.display = 'none';

    const p = PLATFORMS[currentContext.sourcePlatform] || { name: 'Unknown', icon: '❓' };
    source.textContent = `${p.icon} From ${p.name}`;
    count.textContent = `${currentContext.messages.length} messages`;

    // Show last few messages
    preview.innerHTML = '';
    const msgs = currentContext.messages.slice(-3);
    msgs.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'context-msg';
      div.innerHTML = `
        <div class="context-msg-role ${msg.role}">${msg.role}</div>
        <div class="context-msg-text">${escapeHtml(msg.content.substring(0, 120))}</div>
      `;
      preview.appendChild(div);
    });
  } else {
    card.style.display = 'none';
    emptyState.style.display = 'block';
  }
}

// ── Render platform switch buttons ──
function renderPlatformGrid() {
  const grid = document.getElementById('platformGrid');
  grid.innerHTML = '';

  Object.entries(PLATFORMS).forEach(([key, platform]) => {
    const btn = document.createElement('button');
    btn.className = 'platform-btn';
    if (key === currentPlatform) btn.classList.add('current');
    btn.style.setProperty('--platform-color', platform.color);
    btn.innerHTML = `
      <span class="platform-icon">${platform.icon}</span>
      <span class="platform-name">${platform.name}</span>
    `;

    // Disable switch to self
    if (key === currentPlatform) {
      btn.title = 'You are currently here';
    } else {
      // ONE-CLICK: Capture + Switch in a single click!
      btn.addEventListener('click', () => directSwitch(key));
      btn.title = `⚡ Capture & Switch to ${platform.name}`;
    }

    grid.appendChild(btn);
  });
}

// ── Capture context from current tab ──
async function captureContext() {
  if (!currentPlatform) {
    showToast('Open an AI chat first!', 'error');
    return;
  }

  const captureBtn = document.getElementById('captureBtn');
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');

  captureBtn.disabled = true;
  captureBtn.innerHTML = `
    <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
    Capturing...
  `;
  statusBar.className = 'status-bar capturing';
  statusText.textContent = 'Extracting conversation...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // CRITICAL: Inject content scripts first (in case page was loaded before extension)
    await ensureContentScriptsLoaded(tab.id, tab.url);
    await new Promise(r => setTimeout(r, 500));

    // Send message to content script to extract chat
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'EXTRACT_CHAT'
    });

    if (response && response.messages && response.messages.length > 0) {
      // Save context via background
      await chrome.runtime.sendMessage({
        action: 'SAVE_CONTEXT',
        data: {
          messages: response.messages,
          sourcePlatform: currentPlatform,
          title: response.title || 'Chat from ' + PLATFORMS[currentPlatform].name
        }
      });

      currentContext = {
        messages: response.messages,
        sourcePlatform: currentPlatform,
        title: response.title
      };

      renderContextCard();
      statusBar.className = 'status-bar active';
      statusText.textContent = `✅ Captured ${response.messages.length} messages from ${PLATFORMS[currentPlatform].name}`;

      captureBtn.classList.add('success');
      captureBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Captured!
      `;

      showToast(`✅ ${response.messages.length} messages captured!`, 'success');

      setTimeout(() => {
        captureBtn.classList.remove('success');
        captureBtn.disabled = false;
        captureBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Capture Current Chat
        `;
      }, 2000);

    } else {
      throw new Error('No messages found');
    }

  } catch (error) {
    console.error('Capture failed:', error);
    statusBar.className = 'status-bar active';
    statusText.textContent = `On ${PLATFORMS[currentPlatform]?.icon} ${PLATFORMS[currentPlatform]?.name}`;
    captureBtn.disabled = false;
    captureBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Capture Current Chat
    `;
    showToast('Could not extract chat. Try scrolling up first.', 'error');
  }
}

// ── Inject content scripts into a tab if not already there ──
async function ensureContentScriptsLoaded(tabId, tabUrl) {
  // Determine which platform-specific script to inject
  let platformScript = null;
  if (tabUrl.includes('chatgpt.com') || tabUrl.includes('chat.openai.com')) platformScript = 'content-scripts/chatgpt.js';
  else if (tabUrl.includes('claude.ai')) platformScript = 'content-scripts/claude.js';
  else if (tabUrl.includes('gemini.google.com')) platformScript = 'content-scripts/gemini.js';
  else if (tabUrl.includes('deepseek.com')) platformScript = 'content-scripts/deepseek.js';
  else if (tabUrl.includes('perplexity.ai')) platformScript = 'content-scripts/perplexity.js';
  else if (tabUrl.includes('copilot.microsoft.com')) platformScript = 'content-scripts/copilot.js';

  if (!platformScript) return;

  try {
    // Inject shared utilities first, then platform-specific script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/shared.js']
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [platformScript]
    });
    // Also inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content-scripts/overlay.css']
    });
    console.log('Content scripts injected successfully into tab', tabId);
  } catch (e) {
    console.warn('Script injection failed (may already be loaded):', e.message);
  }
}

// ── ONE-CLICK: Capture context + Switch to target platform directly ──
async function directSwitch(targetPlatform) {
  const platform = PLATFORMS[targetPlatform];
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');

  // If we're on an AI platform, auto-capture first
  if (currentPlatform) {
    statusBar.className = 'status-bar capturing';
    statusText.textContent = `⚡ Capturing & switching to ${platform.name}...`;

    // Disable all platform buttons during switch
    document.querySelectorAll('.platform-btn').forEach(b => b.disabled = true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // CRITICAL: Inject content scripts first (in case page was loaded before extension)
      await ensureContentScriptsLoaded(tab.id, tab.url);

      // Small delay to let scripts initialize
      await new Promise(r => setTimeout(r, 500));

      // Step 1: Capture current chat
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'EXTRACT_CHAT'
      });

      if (response && response.messages && response.messages.length > 0) {
        // Step 2: Save captured context
        await chrome.runtime.sendMessage({
          action: 'SAVE_CONTEXT',
          data: {
            messages: response.messages,
            sourcePlatform: currentPlatform,
            title: response.title || 'Chat from ' + PLATFORMS[currentPlatform].name
          }
        });

        currentContext = {
          messages: response.messages,
          sourcePlatform: currentPlatform,
          title: response.title
        };

        showToast(`⚡ ${response.messages.length} msgs captured → Opening ${platform.name}...`, 'success');

        // Step 3: Switch to target platform
        await chrome.runtime.sendMessage({
          action: 'SWITCH_TO',
          targetPlatform
        });

        // Close popup after switch
        setTimeout(() => window.close(), 600);
        return;

      } else {
        showToast('No messages found to capture. Switching anyway...', 'error');
      }
    } catch (error) {
      console.warn('Auto-capture failed:', error);
      showToast('Capture failed. Switching with existing context...', 'error');
    }
  }

  // Fallback: Use existing context if available, or just open the platform
  if (currentContext && currentContext.messages && currentContext.messages.length > 0) {
    showToast(`Switching to ${platform.icon} ${platform.name}...`, 'success');
    await chrome.runtime.sendMessage({
      action: 'SWITCH_TO',
      targetPlatform
    });
    setTimeout(() => window.close(), 500);
  } else {
    // No context at all — just open the target platform
    showToast(`Opening ${platform.name}...`, 'success');
    await chrome.runtime.sendMessage({
      action: 'SWITCH_TO',
      targetPlatform
    });
    setTimeout(() => window.close(), 500);
  }
}

// ── Switch using existing saved context (used by history items) ──
async function switchTo(targetPlatform) {
  if (!currentContext || !currentContext.messages || currentContext.messages.length === 0) {
    showToast('No saved context to switch!', 'error');
    return;
  }

  const platform = PLATFORMS[targetPlatform];
  showToast(`Switching to ${platform.icon} ${platform.name}...`, 'success');

  await chrome.runtime.sendMessage({
    action: 'SWITCH_TO',
    targetPlatform
  });

  setTimeout(() => window.close(), 500);
}

// ── Copy context as text ──
function copyAsText() {
  if (!currentContext || !currentContext.messages) {
    showToast('No context to copy!', 'error');
    return;
  }

  const text = currentContext.messages.map(m =>
    `**${m.role.toUpperCase()}:**\n${m.content}`
  ).join('\n\n---\n\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  });
}

// ── Export as JSON ──
function exportJson() {
  if (!currentContext || !currentContext.messages) {
    showToast('No context to export!', 'error');
    return;
  }

  const json = JSON.stringify(currentContext, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-context-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported JSON file!', 'success');
}

// ── Clear context ──
async function clearContextAction() {
  await chrome.runtime.sendMessage({ action: 'CLEAR_CONTEXT' });
  currentContext = null;
  renderContextCard();
  showToast('Context cleared', 'success');
}

// ── Load history ──
async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ action: 'GET_HISTORY' });
  const history = response?.history || [];
  const list = document.getElementById('historyList');
  const countEl = document.getElementById('historyCount');

  countEl.textContent = history.length ? `${history.length} saved` : '';

  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty">No switch history yet</div>';
    return;
  }

  list.innerHTML = '';
  history.slice(0, 10).forEach(item => {
    const p = PLATFORMS[item.sourcePlatform] || { icon: '❓', name: 'Unknown' };
    const timeAgo = getTimeAgo(item.timestamp);
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span class="history-icon">${p.icon}</span>
      <div class="history-info">
        <div class="history-title">${escapeHtml(item.title || 'Untitled')}</div>
        <div class="history-meta">${p.name} • ${timeAgo}</div>
      </div>
      <span class="history-msgs">${item.messages?.length || 0} msgs</span>
    `;
    div.addEventListener('click', async () => {
      // Load this history item as current context
      await chrome.runtime.sendMessage({
        action: 'SAVE_CONTEXT',
        data: {
          messages: item.messages,
          sourcePlatform: item.sourcePlatform,
          title: item.title
        }
      });
      currentContext = item;
      renderContextCard();
      showToast('Context loaded from history!', 'success');
    });
    list.appendChild(div);
  });
}

// ── Event Listeners ──
function setupEventListeners() {
  document.getElementById('captureBtn').addEventListener('click', captureContext);
  document.getElementById('clearContextBtn').addEventListener('click', clearContextAction);
  document.getElementById('copyContextBtn').addEventListener('click', copyAsText);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
}

// ── Utility: Toast ──
function showToast(message, type = 'success') {
  // Remove existing toast
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── Utility: Escape HTML ──
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Utility: Time Ago ──
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
