// Service Worker for LinkedIn Contact Extractor
// Handles background tasks and communication between content script and popup

chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Contact Extractor installed');
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // No longer need to forward extractProfileData messages
  // as popup now communicates directly with content script

  if (request.action === 'saveProfileData') {
    // Save extracted data to local storage
    chrome.storage.local.set({ profileData: request.data }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getProfileData') {
    // Retrieve saved profile data
    chrome.storage.local.get(['profileData'], (result) => {
      sendResponse({ success: true, data: result.profileData || null });
    });
    return true;
  }

  if (request.action === 'clearProfileData') {
    // Clear saved profile data
    chrome.storage.local.remove(['profileData'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle tab updates to check if we're on LinkedIn
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com')) {
    // Inject content script if needed
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content_script.js']
    }).catch(() => {
      // Content script already injected or error occurred
    });
  }
});
