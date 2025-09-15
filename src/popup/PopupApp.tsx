import React, { useState, useEffect } from 'react';
import { VocabularyItem, LearningStats } from '@/types';

export const PopupApp: React.FC = () => {
  const [currentItem, setCurrentItem] = useState<VocabularyItem | null>(null);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // TODO: Load current review item and stats from storage
      // This will be implemented when we add the background script and storage utilities
      
      // Mock data for now
      const mockItem: VocabularyItem = {
        id: '1',
        targetLanguageWord: 'नमस्ते',
        englishTranslation: 'Hello',
        srsData: {
          nextReviewDate: Date.now(),
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          lastReviewed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const mockStats: LearningStats = {
        totalItems: 10,
        dueToday: 3,
        newToday: 2,
        reviewedToday: 1,
        accuracyRate: 0.85,
        streak: 5,
        totalReviews: 25,
      };

      setCurrentItem(mockItem);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleQualityResponse = async (quality: number) => {
    if (!currentItem) return;

    try {
      // TODO: Record review response and update SRS data
      console.log('Quality response:', quality);
      
      // Reset for next item
      setShowAnswer(false);
      setCurrentItem(null);
      
      // Load next item
      await loadData();
    } catch (error) {
      console.error('Failed to record review:', error);
    }
  };

  const playAudio = () => {
    if (!currentItem) return;
    
    // Use Web Speech API for text-to-speech
    const utterance = new SpeechSynthesisUtterance(currentItem.targetLanguageWord);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
  };

  if (loading) {
    return (
      <div className="popup-container loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="popup-container no-reviews">
        <div className="stats-section">
          <h2>📚 Hindi Learning</h2>
          {stats && (
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">{stats.dueToday}</span>
                <span className="stat-label">Due Today</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.totalItems}</span>
                <span className="stat-label">Total Words</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{Math.round(stats.accuracyRate * 100)}%</span>
                <span className="stat-label">Accuracy</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="no-reviews-message">
          <p>🎉 No reviews due right now!</p>
          <p>Great job staying on top of your learning!</p>
        </div>
        
        <button 
          className="options-button"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          ⚙️ Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="popup-container review">
      <div className="review-header">
        <div className="review-progress">
          {stats && `${stats.reviewedToday} reviewed today`}
        </div>
      </div>

      <div className="vocabulary-card">
        <div className="hindi-text">
          {currentItem.targetLanguageWord}
        </div>
        
        <button className="audio-button" onClick={playAudio} title="Play pronunciation">
          🔊
        </button>

        {showAnswer && (
          <div className="english-translation">
            {currentItem.englishTranslation}
          </div>
        )}
      </div>

      <div className="action-buttons">
        {!showAnswer ? (
          <button className="reveal-button" onClick={handleReveal}>
            Show Answer
          </button>
        ) : (
          <div className="quality-buttons">
            <button 
              className="quality-btn again"
              onClick={() => handleQualityResponse(1)}
            >
              Again
            </button>
            <button 
              className="quality-btn hard"
              onClick={() => handleQualityResponse(2)}
            >
              Hard
            </button>
            <button 
              className="quality-btn good"
              onClick={() => handleQualityResponse(3)}
            >
              Good
            </button>
            <button 
              className="quality-btn easy"
              onClick={() => handleQualityResponse(4)}
            >
              Easy
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
