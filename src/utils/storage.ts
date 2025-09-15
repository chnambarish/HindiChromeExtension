import { VocabularyItem } from '../types/srs';

const VOCABULARY_KEY = 'vocabulary';

/**
 * Retrieves the vocabulary list from chrome.storage.local.
 * @returns A promise that resolves with the array of VocabularyItem or an empty array if not found.
 */
export function getVocabulary(): Promise<VocabularyItem[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([VOCABULARY_KEY], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result[VOCABULARY_KEY] || []);
    });
  });
}

/**
 * Saves the vocabulary list to chrome.storage.local.
 * @param vocabulary The array of VocabularyItem to save.
 * @returns A promise that resolves when the data is successfully saved.
 */
export function setVocabulary(vocabulary: VocabularyItem[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [VOCABULARY_KEY]: vocabulary }, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}
