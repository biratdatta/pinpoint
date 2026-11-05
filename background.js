// Routes the toolbar icon and keyboard shortcut to the page.
async function send(tab, msg) {
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // Tab was open before the extension was installed: inject, then retry.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['main.js'], world: 'MAIN' });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch (e) {
      console.warn('Pinpoint cannot run on this page:', e.message);
    }
  }
}

chrome.action.onClicked.addListener((tab) => send(tab, { type: 'toggle' }));

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-annotate') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  send(tab, { type: 'annotate' });
});
