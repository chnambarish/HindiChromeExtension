import React, { useState, useEffect } from 'react';
import { getVocabulary, setVocabulary } from '../utils/storage';
import { VocabularyItem } from '../types/srs';
import ReviewSession from './ReviewSession';

function App() {
  const [allVocabulary, setAllVocabulary] = useState<VocabularyItem[]>([]);
  const [dueItems, setDueItems] = useState<VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);

  // Load all data on mount
  useEffect(() => {
    getVocabulary()
      .then(vocab => {
        setAllVocabulary(vocab);
        const now = Date.now();
        const itemsToReview = vocab.filter(
          item => item.srsData.nextReviewDate <= now
        );
        setDueItems(itemsToReview);
      })
      .catch(err => console.error("Error fetching vocabulary:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleStartSession = () => {
    if (dueItems.length > 0) {
      setCurrentItemIndex(0);
      setIsSessionActive(true);
    }
  };

  const handleReviewComplete = (updatedItem: VocabularyItem) => {
    // Update the item in the main vocabulary list
    const updatedVocabulary = allVocabulary.map(item =>
      item.id === updatedItem.id ? updatedItem : item
    );
    setAllVocabulary(updatedVocabulary);

    // Save the entire updated list back to storage
    setVocabulary(updatedVocabulary)
      .then(() => {
        console.log(`Item "${updatedItem.targetLanguageWord}" reviewed and saved.`);
        // Move to the next item or end the session
        if (currentItemIndex < dueItems.length - 1) {
          setCurrentItemIndex(currentItemIndex + 1);
        } else {
          // Session finished
          setIsSessionActive(false);
          setDueItems([]); // Clear due items as they've been reviewed
          console.log("Review session complete!");
        }
      })
      .catch(err => console.error("Error saving vocabulary:", err));
  };

  const currentItem = dueItems[currentItemIndex];

  return (
    <div style={{ padding: '1rem', textAlign: 'center', width: '300px' }}>
      <h2>Language Learner</h2>

      {isLoading ? (
        <p>Loading...</p>
      ) : isSessionActive && currentItem ? (
        <ReviewSession item={currentItem} onReviewComplete={handleReviewComplete} />
      ) : (
        <div>
          <h3>Home</h3>
          {dueItems.length > 0 ? (
            <div>
              <p>You have {dueItems.length} item(s) to review.</p>
              <button onClick={handleStartSession}>Start Review</button>
            </div>
          ) : (
            <p>No items to review right now. Good job!</p>
          )}
          <hr style={{ margin: '1rem 0' }} />
          <button onClick={() => chrome.runtime.openOptionsPage()}>
            Go to Options
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
