// ============================================
// AI Context Switcher — Background Service Worker
// ============================================

const AI_PLATFORMS = {
  chatgpt: {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    icon: '🟢',
    color: '#10a37f'
  },
  claude: {
    name: 'Claude',
    url: 'https://claude.ai/new',
    icon: '🟠',
    color: '#d97706'
  },
  gemini: {
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    icon: '🔵',
    color: '#4285f4'
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com/',
    icon: '🟣',
    color: '#7c3aed'
  },
  perplexity: {
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    icon: '🔷',
    color: '#20b2aa'
  },
  copilot: {
    name: 'Copilot',
    url: 'https://copilot.microsoft.com/',
    icon: '🟦',
    color: '#0078d4'
  }
};

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {

    case 'GET_PLATFORMS':
      sendResponse({ platforms: AI_PLATFORMS });
      break;

    case 'SAVE_CONTEXT':
      saveContext(message.data).then(() => {
        sendResponse({ success: true });
      });
      return true; // async

    case 'GET_CONTEXT':
      getContext().then(ctx => {
        sendResponse({ context: ctx });
      });
      return true;

    case 'SWITCH_TO':
      handleSwitch(message.targetPlatform, sender.tab?.id).then(result => {
        sendResponse(result);
      });
      return true;

    case 'GET_HISTORY':
      getHistory().then(history => {
        sendResponse({ history });
      });
      return true;

    case 'CLEAR_CONTEXT':
      clearContext().then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'DETECT_CURRENT_PLATFORM':
      if (sender.tab?.url) {
        const platform = detectPlatformFromUrl(sender.tab.url);
        sendResponse({ platform });
      }
      break;

    case 'PASTE_CONTEXT_READY':
      // Content script signals it's ready to receive context
      getContext().then(ctx => {
        if (ctx && ctx.messages && ctx.messages.length > 0) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'INJECT_CONTEXT',
            context: ctx
          });
        }
        sendResponse({ success: true });
      });
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

function detectPlatformFromUrl(url) {
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) return 'chatgpt';
  if (url.includes('claude.ai')) return 'claude';
  if (url.includes('gemini.google.com')) return 'gemini';
  if (url.includes('deepseek.com')) return 'deepseek';
  if (url.includes('perplexity.ai')) return 'perplexity';
  if (url.includes('copilot.microsoft.com')) return 'copilot';
  return null;
}

async function saveContext(data) {
  const context = {
    messages: data.messages || [],
    sourcePlatform: data.sourcePlatform,
    timestamp: Date.now(),
    title: data.title || 'Untitled Chat'
  };

  await chrome.storage.local.set({ currentContext: context });

  // Also save to history
  const result = await chrome.storage.local.get('contextHistory');
  const history = result.contextHistory || [];
  history.unshift({
    ...context,
    id: `ctx_${Date.now()}`
  });
  // Keep only last 50 entries
  if (history.length > 50) history.length = 50;
  await chrome.storage.local.set({ contextHistory: history });
}

async function getContext() {
  const result = await chrome.storage.local.get('currentContext');
  return result.currentContext || null;
}

async function getHistory() {
  const result = await chrome.storage.local.get('contextHistory');
  return result.contextHistory || [];
}

async function clearContext() {
  await chrome.storage.local.remove('currentContext');
}

async function handleSwitch(targetPlatform, sourceTabId) {
  const platform = AI_PLATFORMS[targetPlatform];
  if (!platform) {
    return { success: false, error: 'Unknown platform' };
  }

  console.log('[AI-Switch BG] handleSwitch called:', targetPlatform);

  // Store the pending switch flag
  await chrome.storage.local.set({
    pendingSwitch: {
      targetPlatform,
      timestamp: Date.now()
    }
  });

  // Verify both context and pendingSwitch are in storage
  const verify = await chrome.storage.local.get(['currentContext', 'pendingSwitch']);
  console.log('[AI-Switch BG] Storage verified:', {
    hasContext: !!(verify.currentContext && verify.currentContext.messages),
    contextMsgCount: verify.currentContext?.messages?.length || 0,
    hasPending: !!verify.pendingSwitch,
    targetPlatform: verify.pendingSwitch?.targetPlatform
  });

  // Open the target platform in a new tab
  const tab = await chrome.tabs.create({ url: platform.url });
  console.log('[AI-Switch BG] Opened tab:', tab.id, platform.url);

  return { success: true, tabId: tab.id };
}

// Badge update when context is saved
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.currentContext) {
    const ctx = changes.currentContext.newValue;
    if (ctx && ctx.messages && ctx.messages.length > 0) {
      chrome.action.setBadgeText({ text: String(ctx.messages.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});
