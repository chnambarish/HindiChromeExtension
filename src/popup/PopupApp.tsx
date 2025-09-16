import React, { useState, useEffect } from 'react';
import { VocabularyItem, LearningStats } from '@/types';
import { StorageManager } from '@/utils/storage';
import { SM2Engine } from '@/utils/srs-engine';
import { SpeedLearn } from '../components/SpeedLearn';

export const PopupApp: React.FC = () => {
  const [currentItem, setCurrentItem] = useState<VocabularyItem | null>(null);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'review' | 'speedlearn' | 'stats'>('review');
  const [storageManager] = useState(() => new StorageManager());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Initialize storage if needed
      await StorageManager.initialize();
      
      // Load due vocabulary items
      const dueItems = await StorageManager.getDueVocabulary();
      const currentItem = dueItems.length > 0 ? dueItems[0] : null;
      
      // Load learning statistics
      const learningStats = await StorageManager.getLearningStats();
      
      setCurrentItem(currentItem);
      setStats(learningStats);
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
      // Process the review with SM-2 algorithm and update storage
      const startTime = Date.now() - (showAnswer ? 10000 : 5000); // Estimate review time
      const responseTime = Date.now() - startTime;
      
      await StorageManager.processVocabularyReview(
        currentItem.id,
        quality,
        responseTime,
        startTime
      );
      
      console.log('Review processed successfully for item:', currentItem.id);
      
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'speedlearn':
        return <SpeedLearn storageManager={storageManager} />;
      case 'stats':
        return renderStatsView();
      default:
        return renderReviewContent();
    }
  };

  const renderStatsView = () => (
    <div className="stats-view">
      <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Learning Stats</h2>
      {stats && (
        <div className="stats-grid grid grid-cols-2 gap-4">
          <div className="stat-item bg-blue-50 p-3 rounded">
            <div className="text-2xl font-bold text-blue-600">{stats.dueToday}</div>
            <div className="text-sm text-gray-600">Due Today</div>
          </div>
          <div className="stat-item bg-green-50 p-3 rounded">
            <div className="text-2xl font-bold text-green-600">{stats.totalItems}</div>
            <div className="text-sm text-gray-600">Total Words</div>
          </div>
          <div className="stat-item bg-purple-50 p-3 rounded">
            <div className="text-2xl font-bold text-purple-600">{Math.round(stats.accuracyRate * 100)}%</div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
          <div className="stat-item bg-orange-50 p-3 rounded">
            <div className="text-2xl font-bold text-orange-600">{stats.reviewedToday}</div>
            <div className="text-sm text-gray-600">Reviewed Today</div>
          </div>
        </div>
      )}
      <button 
        className="w-full mt-4 bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        ⚙️ Open Settings
      </button>
    </div>
  );

  const renderReviewContent = () => {
    if (!currentItem) {
      return (
        <div className="no-reviews-view">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📏 Reviews</h2>
          <div className="no-reviews-message text-center py-8">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-gray-800 font-medium">No reviews due right now!</p>
            <p className="text-gray-600">Great job staying on top of your learning!</p>
          </div>
          <button 
            className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            ⚙️ Open Settings
          </button>
        </div>
      );
    }

    return (
      <div className="review-content">
        <div className="review-header mb-4">
          <h2 className="text-xl font-bold text-gray-800">📏 Review Session</h2>
          <div className="review-progress text-sm text-gray-600">
            {stats && `${stats.reviewedToday} reviewed today`}
          </div>
        </div>

        <div className="vocabulary-card bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-4">
          <div className="hindi-text text-3xl font-bold text-center mb-4 text-gray-800">
            {currentItem.targetLanguageWord}
          </div>
          
          <div className="text-center mb-4">
            <button className="audio-button bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onClick={playAudio} title="Play pronunciation">
              🔊 Play Audio
            </button>
          </div>

          {showAnswer && (
            <div className="english-translation text-xl text-center text-gray-700 font-medium">
              {currentItem.englishTranslation}
            </div>
          )}
        </div>

        <div className="action-buttons">
          {!showAnswer ? (
            <button className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600" onClick={handleReveal}>
              Show Answer
            </button>
          ) : (
            <div className="quality-buttons grid grid-cols-2 gap-2">
              <button 
                className="quality-btn bg-red-500 text-white py-2 rounded hover:bg-red-600"
                onClick={() => handleQualityResponse(1)}
              >
                Again
              </button>
              <button 
                className="quality-btn bg-orange-500 text-white py-2 rounded hover:bg-orange-600"
                onClick={() => handleQualityResponse(2)}
              >
                Hard
              </button>
              <button 
                className="quality-btn bg-green-500 text-white py-2 rounded hover:bg-green-600"
                onClick={() => handleQualityResponse(3)}
              >
                Good
              </button>
              <button 
                className="quality-btn bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
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

  return (
    <div className="popup-container w-80 bg-white">
      {/* Tab Navigation */}
      <div className="tab-navigation flex border-b border-gray-200 mb-4">
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'review' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('review')}
        >
          📏 Reviews
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'speedlearn' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('speedlearn')}
        >
          🚀 Speed Learn
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'stats' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Stats
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};
