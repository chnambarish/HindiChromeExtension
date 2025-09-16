import React, { useState, useEffect, useCallback } from 'react';
import { SpeedLearnEngine } from '../utils/speedLearn';
import { StorageManager } from '../utils/storage';
import { VocabularyItem, SpeedLearnSession, SpeedLearnConfig } from '../types/vocabulary';

interface SpeedLearnProps {
  storageManager: StorageManager;
}

export const SpeedLearn: React.FC<SpeedLearnProps> = ({ storageManager }) => {
  const [speedLearnEngine] = useState(() => new SpeedLearnEngine(storageManager));
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSession, setCurrentSession] = useState<SpeedLearnSession | null>(null);
  const [currentWord, setCurrentWord] = useState<VocabularyItem | null>(null);
  const [progress, setProgress] = useState({ wordIndex: 0, repetition: 0, totalWords: 0 });
  const [config, setConfig] = useState<SpeedLearnConfig>({
    repetitionsPerSession: 3,
    wordPause: 800,
    sentencePause: 1200,
    maxWordsPerSession: 15,
    enableBackgroundMusic: false,
    speechSpeed: 1.0,
    exposuresBeforeMastery: 5
  });

  const [learningProgress, setLearningProgress] = useState<{
    newWords: number;
    learningWords: number;
    masteredWords: number;
    totalInTraditionalReviews: number;
  } | null>(null);

  useEffect(() => {
    // Set up event listeners
    speedLearnEngine.setOnWordStart((word, repetition) => {
      setCurrentWord(word);
      setProgress(speedLearnEngine.getCurrentProgress());
    });

    speedLearnEngine.setOnWordComplete((word, repetition) => {
      setProgress(speedLearnEngine.getCurrentProgress());
    });

    speedLearnEngine.setOnSessionComplete((session) => {
      setIsActive(false);
      setIsPaused(false);
      setCurrentSession(session);
      setCurrentWord(null);
      loadLearningProgress();
    });

    speedLearnEngine.setOnSessionPause(() => {
      setIsPaused(true);
    });

    speedLearnEngine.setOnSessionResume(() => {
      setIsPaused(false);
    });

    // Load initial data
    loadLearningProgress();

    return () => {
      if (speedLearnEngine.isSessionActive()) {
        speedLearnEngine.stopSession();
      }
    };
  }, [speedLearnEngine]);

  const loadLearningProgress = useCallback(async () => {
    const progress = await speedLearnEngine.getLearningProgress();
    setLearningProgress(progress);
  }, [speedLearnEngine]);

  const handleStartSession = async () => {
    try {
      const session = await speedLearnEngine.startSession(config);
      setCurrentSession(session);
      setIsActive(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to start Speed Learn session:', error);
      
      if (error instanceof Error && error.message.includes('No words available')) {
        alert('No vocabulary items available for Speed Learn. Please:\n\n1. Add vocabulary items in the Options page, OR\n2. Click "Migrate Vocabulary" button below if you have existing vocabulary');
      } else {
        alert('Failed to start session. Please check console for details or try migrating your vocabulary.');
      }
    }
  };

  const handlePauseSession = () => {
    speedLearnEngine.pauseSession();
  };

  const handleResumeSession = () => {
    speedLearnEngine.resumeSession();
  };

  const handleStopSession = async () => {
    await speedLearnEngine.stopSession();
    setIsActive(false);
    setIsPaused(false);
    setCurrentWord(null);
    setCurrentSession(null);
  };

  const handleConfigChange = (field: keyof SpeedLearnConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleManualMigration = async () => {
    try {
      // Force re-initialization to trigger migration
      await (storageManager.constructor as any).initialize();
      alert('Vocabulary migrated successfully! You can now start Speed Learn sessions.');
      // Refresh progress after migration
      await loadLearningProgress();
    } catch (error) {
      console.error('Migration failed:', error);
      alert('Migration failed. Please check the console for details.');
    }
  };

  return (
    <div className="speed-learn-container">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🚀 Speed Learn</h2>

      {/* Learning Progress */}
      {learningProgress && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg mb-4 border border-green-200">
          <h4 className="font-medium text-gray-800 mb-3">🌱 Speed Learn Progress (New Learning Only)</h4>
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div className="bg-blue-100 p-2 rounded text-center">
              <div className="font-bold text-blue-700">{learningProgress.newWords}</div>
              <div className="text-blue-600">New Words</div>
            </div>
            <div className="bg-yellow-100 p-2 rounded text-center">
              <div className="font-bold text-yellow-700">{learningProgress.learningWords}</div>
              <div className="text-yellow-600">Learning</div>
            </div>
            <div className="bg-green-100 p-2 rounded text-center">
              <div className="font-bold text-green-700">{learningProgress.masteredWords}</div>
              <div className="text-green-600">Completed</div>
            </div>
            <div className="bg-purple-100 p-2 rounded text-center">
              <div className="font-bold text-purple-700">{learningProgress.totalInTraditionalReviews}</div>
              <div className="text-purple-600">In Reviews Tab</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 text-center">
            📝 Speed Learn = New learning only • Reviews = Traditional SRS in Reviews tab
          </div>
        </div>
      )}

      {/* Session Controls */}
      <div className="session-controls mb-4">
        {!isActive ? (
          <div className="space-y-2">
            <button
              onClick={handleStartSession}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              🎵 Start Speed Learn Session
            </button>
            <button
              onClick={handleManualMigration}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded text-sm hover:bg-gray-600"
              title="Run this if Speed Learn sessions fail to start"
            >
              🔄 Migrate Vocabulary for Speed Learn
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex space-x-2">
              {isPaused ? (
                <button
                  onClick={handleResumeSession}
                  className="flex-1 bg-green-500 text-white py-2 px-4 rounded font-medium hover:bg-green-600"
                >
                  ▶️ Resume
                </button>
              ) : (
                <button
                  onClick={handlePauseSession}
                  className="flex-1 bg-yellow-500 text-white py-2 px-4 rounded font-medium hover:bg-yellow-600"
                >
                  ⏸️ Pause
                </button>
              )}
              <button
                onClick={handleStopSession}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded font-medium hover:bg-red-600"
              >
                ⏹️ Stop
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current Word Display */}
      {isActive && currentWord && (
        <div className="current-word-display bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800 mb-2">
              {currentWord.targetLanguageWord}
            </div>
            <div className="text-lg text-gray-600 mb-3">
              {currentWord.englishTranslation}
            </div>
            <div className="text-sm text-gray-500">
              Word {progress.wordIndex + 1} of {progress.totalWords} • 
              Repetition {progress.repetition + 1} of {config.repetitionsPerSession}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${((progress.wordIndex + progress.repetition * progress.totalWords) / 
                           (config.repetitionsPerSession * progress.totalWords)) * 100}%` 
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Configuration Panel */}
      {!isActive && (
        <div className="config-panel bg-gray-50 p-4 rounded-lg mb-4">
          <h3 className="font-medium text-gray-800 mb-3">Session Settings</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Repetitions per session: {config.repetitionsPerSession}
              </label>
              <input
                type="range"
                min="2"
                max="5"
                value={config.repetitionsPerSession}
                onChange={(e) => handleConfigChange('repetitionsPerSession', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Speech speed: {config.speechSpeed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={config.speechSpeed}
                onChange={(e) => handleConfigChange('speechSpeed', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Max words per session: {config.maxWordsPerSession}
              </label>
              <input
                type="range"
                min="10"
                max="25"
                value={config.maxWordsPerSession}
                onChange={(e) => handleConfigChange('maxWordsPerSession', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Word pause: {(config.wordPause / 1000).toFixed(1)}s
              </label>
              <input
                type="range"
                min="500"
                max="2000"
                step="100"
                value={config.wordPause}
                onChange={(e) => handleConfigChange('wordPause', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500">Pause between Hindi and English</div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Sentence pause: {(config.sentencePause / 1000).toFixed(1)}s
              </label>
              <input
                type="range"
                min="800"
                max="3000"
                step="100"
                value={config.sentencePause}
                onChange={(e) => handleConfigChange('sentencePause', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500">Pause between different words</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
