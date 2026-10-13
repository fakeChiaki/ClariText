/**
 * Service Worker de ClariText.
 */

// ─── Estado en memoria ──────────────────────────────────────────

let lockedTabId = null;

// ─── Mensajes desde content scripts ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.type) {
    case 'timer:lock': {
      lockedTabId = sender.tab?.id ?? null;
      sendResponse({ ok: true, lockedTabId });
      return false;
    }

    case 'timer:unlock': {
      if (sender.tab?.id === lockedTabId) {
        lockedTabId = null;
      }
      sendResponse({ ok: true });
      return false;
    }

    default:
      return false;
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!lockedTabId) {
    return;
  }
  if (activeInfo.tabId === lockedTabId) {
    return;
  }

  try {
    await chrome.tabs.get(lockedTabId);
  } catch {
    lockedTabId = null;
    return;
  }

  setTimeout(() => {
    chrome.tabs.update(lockedTabId, { active: true }).catch(() => {
      setTimeout(() => {
        chrome.tabs.update(lockedTabId, { active: true }).catch(() => {});
      }, 300);
    });
  }, 150);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === lockedTabId) {
    lockedTabId = null;
  }
});
