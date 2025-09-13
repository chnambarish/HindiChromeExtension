chrome.runtime.onInstalled.addListener(() => {
  console.log('Spaced Repetition Language Learner extension installed.');

  // Fetch the sample data and store it in chrome.storage.local
  fetch(chrome.runtime.getURL('hindi.json'))
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      chrome.storage.local.set({ languageData: data }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error setting language data in storage:', chrome.runtime.lastError);
        } else {
          console.log('Initial language data has been successfully stored.');
        }
      });
    })
    .catch(error => {
      console.error('Error fetching or parsing initial language data:', error);
    });
});
