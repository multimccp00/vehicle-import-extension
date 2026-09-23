export const COUNTRY_NAMES = {
  PT: 'Portugal', DE: 'Germany', ES: 'Spain', FR: 'France', NL: 'Netherlands',
  BE: 'Belgium', IT: 'Italy', GB: 'United Kingdom', JP: 'Japan', US: 'United States'
};

export function inferCountryFromEnvironment({ languages = [], uiLanguage = '', timezone = '' } = {}) {
  const candidates = [uiLanguage, ...languages].filter(Boolean).map((value) => String(value).replace('_', '-'));
  const region = candidates.map((value) => value.match(/-([A-Z]{2})$/i)?.[1]?.toUpperCase()).find(Boolean);
  if (region && COUNTRY_NAMES[region]) return { countryCode: region, source: 'browser-settings', confidence: 'high' };
  if (timezone === 'Europe/Lisbon' || timezone === 'Atlantic/Madeira' || timezone === 'Atlantic/Azores') {
    return { countryCode: 'PT', source: 'browser-settings', confidence: 'medium' };
  }
  const language = candidates[0]?.split('-')[0].toLowerCase();
  const languageMap = { pt: 'PT', de: 'DE', es: 'ES', fr: 'FR', nl: 'NL', it: 'IT', en: 'GB' };
  if (languageMap[language]) return { countryCode: languageMap[language], source: 'browser-settings', confidence: 'low' };
  return { countryCode: 'PT', source: 'default', confidence: 'low' };
}

export async function detectDestination() {
  const stored = await chrome.storage.local.get(['destinationOverride']);
  if (stored.destinationOverride) {
    return { countryCode: stored.destinationOverride, source: 'manual', confidence: 'high', isUserOverride: true };
  }
  const languages = await chrome.i18n.getAcceptLanguages();
  return {
    ...inferCountryFromEnvironment({
      languages,
      uiLanguage: chrome.i18n.getUILanguage(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }),
    isUserOverride: false
  };
}
