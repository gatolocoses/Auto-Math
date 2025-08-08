// background.js (MV3 service worker)

chrome.runtime.onInstalled.addListener(() => {
  console.log('Inline Math Evaluator installed.');
});

// Optional: respond to pings for debugging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === 'ping') {
    sendResponse({ pong: true });
    return true;
  }
});