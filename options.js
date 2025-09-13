document.addEventListener('DOMContentLoaded', () => {
  const loadButton = document.getElementById('loadButton');

  if (loadButton) {
    loadButton.addEventListener('click', () => {
      // Retrieve the data from chrome.storage.local
      chrome.storage.local.get(['languageData'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error retrieving language data:', chrome.runtime.lastError);
        } else if (result.languageData) {
          console.log('Successfully retrieved language data from storage:');
          console.log(result.languageData);
        } else {
          console.log('No language data found in storage. Has the extension been installed correctly?');
        }
      });
    });
  } else {
    console.error('Error: Could not find button with ID "loadButton".');
  }
});
