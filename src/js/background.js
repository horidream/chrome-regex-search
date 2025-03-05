// Keep service worker active
const KEEP_ALIVE_INTERVAL = 20000; // 20 seconds

function keepAlive() {
  chrome.runtime.getPlatformInfo(() => {
    setTimeout(keepAlive, KEEP_ALIVE_INTERVAL);
  });
}

keepAlive();

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "_execute_action") {
    await handleSearchAction();
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  await handleSearchAction();
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && !tab.url?.startsWith("chrome://")) {
    await ensureContentScriptInjected(tabId);
  }
});

async function ensureContentScriptInjected(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { message: "ping" });
  } catch (e) {
    // Content script not ready, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["js/content.js"]
      });
    } catch (err) {
      console.error("Failed to inject content script:", err);
    }
  }
}

async function handleSearchAction() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Try to ping the content script
    try {
      await chrome.tabs.sendMessage(tab.id, { message: "ping" });
      // Content script is ready, open popup
      await chrome.action.openPopup();
    } catch (e) {
      // Content script not ready or error occurred
      if (tab.url?.startsWith("chrome://")) {
        console.log("Cannot inject script in chrome:// pages");
        return;
      }

      // Inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["js/content.js"]
        });
        await chrome.action.openPopup();
      } catch (err) {
        console.error("Failed to inject content script:", err);
      }
    }
  } catch (err) {
    console.error("Error handling search action:", err);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'returnSearchInfo') {
    chrome.action.setBadgeText({
      'text': String(request.numResults),
      'tabId': sender.tab.id
    });
  }
  // Always return true if you're going to sendResponse asynchronously
  return true;
});

console.log("background.js loaded");