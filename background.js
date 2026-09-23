import { lookupEeaCatalogue } from './src/eea-lookup.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'LOOKUP_EEA') return undefined;

  lookupEeaCatalogue(message.vehicle)
    .then((records) => sendResponse({ records }))
    .catch((error) => sendResponse({ error: error?.message || 'EEA lookup failed' }));
  return true;
});
