import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types/srs';
import { calculateSRSData, PerformanceRating } from '../../background/srs-engine';

interface Props {
  item: VocabularyItem;
  onReviewComplete: (updatedItem: VocabularyItem) => void;
}

function ReviewSession({ item, onReviewComplete }: Props) {
  const [isAnswerShown, setIsAnswerShown] = useState(false);

  // Reset answer visibility when the item changes
  useEffect(() => {
    setIsAnswerShown(false);
  }, [item]);

  const handleShowAnswer = () => {
    setIsAnswerShown(true);
  };

  const handleFeedback = (quality: PerformanceRating) => {
    const updatedSrsData = calculateSRSData(item.srsData, quality);
    onReviewComplete({ ...item, srsData: updatedSrsData });
  };

  return (
    <div>
      <div style={{ margin: '2rem 0', fontSize: '1.5rem' }}>
        {item.targetLanguageWord}
      </div>

      {isAnswerShown ? (
        <div>
          <div style={{ margin: '2rem 0', fontSize: '1.2rem', color: '#555' }}>
            {item.englishTranslation}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <button onClick={() => handleFeedback(1)} style={{ backgroundColor: '#ffcccb' }}>
              Incorrect
            </button>
            <button onClick={() => handleFeedback(4)} style={{ backgroundColor: '#lightgreen' }}>
              Correct
            </button>
          </div>
        </div>
      ) : (
        <button onClick={handleShowAnswer}>Show Answer</button>
      )}
    </div>
  );
}

export default ReviewSession;
