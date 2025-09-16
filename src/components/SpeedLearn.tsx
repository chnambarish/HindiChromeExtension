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
    exposuresBeforeQuiz: 5
  });

  const [wordsReadyForQuiz, setWordsReadyForQuiz] = useState<VocabularyItem[]>([]);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [currentQuizWord, setCurrentQuizWord] = useState<VocabularyItem | null>(null);

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
      checkForQuizWords();
    });

    speedLearnEngine.setOnSessionPause(() => {
      setIsPaused(true);
    });

    speedLearnEngine.setOnSessionResume(() => {
      setIsPaused(false);
    });

    // Load initial data
    checkForQuizWords();

    return () => {
      if (speedLearnEngine.isSessionActive()) {
        speedLearnEngine.stopSession();
      }
    };
  }, [speedLearnEngine]);

  const checkForQuizWords = useCallback(async () => {
    const quizWords = await speedLearnEngine.getWordsReadyForQuiz();
    setWordsReadyForQuiz(quizWords);
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

  const handleStartQuiz = (word: VocabularyItem) => {
    setCurrentQuizWord(word);
    setShowQuizModal(true);
  };

  const handleQuizComplete = async (passed: boolean) => {
    if (currentQuizWord && passed) {
      await speedLearnEngine.markWordAsMastered(currentQuizWord.id);
      await checkForQuizWords();
    }
    setShowQuizModal(false);
    setCurrentQuizWord(null);
  };

  const handleManualMigration = async () => {
    try {
      // Force re-initialization to trigger migration
      await (storageManager.constructor as any).initialize();
      alert('Vocabulary migrated successfully! You can now start Speed Learn sessions.');
    } catch (error) {
      console.error('Migration failed:', error);
      alert('Migration failed. Please check the console for details.');
    }
  };

  return (
    <div className="speed-learn-container">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🚀 Speed Learn</h2>

      {/* Quiz Alert */}
      {wordsReadyForQuiz.length > 0 && (
        <div className="bg-orange-100 border-l-4 border-orange-500 p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-orange-800">Quiz Time! 🎯</h4>
              <p className="text-sm text-orange-700">
                {wordsReadyForQuiz.length} words ready for quiz
              </p>
            </div>
            <button
              onClick={() => handleStartQuiz(wordsReadyForQuiz[0])}
              className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
            >
              Start Quiz
            </button>
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

      {/* Quiz Modal */}
      {showQuizModal && currentQuizWord && (
        <QuizModal
          word={currentQuizWord}
          onComplete={handleQuizComplete}
          onClose={() => setShowQuizModal(false)}
        />
      )}
    </div>
  );
};

// Quiz Modal Component
interface QuizModalProps {
  word: VocabularyItem;
  onComplete: (passed: boolean) => void;
  onClose: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ word, onComplete, onClose }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const checkAnswer = () => {
    const correct = userAnswer.toLowerCase().trim() === word.englishTranslation.toLowerCase().trim();
    setIsCorrect(correct);
    setShowResult(true);
  };

  const handleComplete = () => {
    onComplete(isCorrect);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-gray-800 mb-4">🧠 Quick Quiz</h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">What does this mean in English?</p>
          <div className="text-2xl font-bold text-center py-4 bg-gray-50 rounded">
            {word.targetLanguageWord}
          </div>
        </div>

        {!showResult ? (
          <div>
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full p-2 border border-gray-300 rounded mb-4"
              onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={checkAnswer}
                className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
              >
                Check Answer
              </button>
              <button
                onClick={onClose}
                className="px-4 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className={`text-center py-4 rounded mb-4 ${
              isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isCorrect ? '✅ Correct!' : '❌ Not quite'}
              <div className="text-sm mt-2">
                Correct answer: <strong>{word.englishTranslation}</strong>
              </div>
            </div>
            <button
              onClick={handleComplete}
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};