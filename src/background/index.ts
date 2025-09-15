import { setVocabulary } from '../utils/storage';
import { createInitialSRSData } from './srs-engine';
import { VocabularyItem } from '../types/srs';

// The raw structure of items in the hindi.json file
interface RawVocabularyItem {
  term: string;
  definition: string;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Spaced Repetition Language Learner extension installed.');

  // Fetch the sample data, transform it, and store it in chrome.storage.local
  const dataUrl = chrome.runtime.getURL('src/assets/hindi.json');

  fetch(dataUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data: { words: RawVocabularyItem[] }) => {
      const vocabulary: VocabularyItem[] = data.words.map((item, index) => ({
        id: `${Date.now()}-${index}`, // Simple unique ID
        targetLanguageWord: item.term,
        englishTranslation: item.definition,
        srsData: createInitialSRSData(),
      }));

      return setVocabulary(vocabulary);
    })
    .then(() => {
      console.log('Initial language data has been transformed and successfully stored.');
    })
    .catch(error => {
      console.error('Error processing initial language data:', error);
    });
});
