/**
 * Speed Learn Engine - Auto-play vocabulary with TTS
 * Based on linguistic psychology principles for passive learning
 */

import { VocabularyItem, SpeedLearnStage, SpeedLearnConfig, SpeedLearnSession } from '../types/vocabulary';
import { StorageManager } from './storage';

export class SpeedLearnEngine {
  private storageManager: StorageManager;
  private currentSession: SpeedLearnSession | null = null;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private currentWordIndex: number = 0;
  private currentRepetition: number = 0;
  private sessionWords: VocabularyItem[] = [];
  private config: SpeedLearnConfig;
  private audioQueue: (() => Promise<void>)[] = [];
  private isProcessingAudio: boolean = false;

  // Event callbacks
  private onWordStart?: (word: VocabularyItem, repetition: number) => void;
  private onWordComplete?: (word: VocabularyItem, repetition: number) => void;
  private onSessionComplete?: (session: SpeedLearnSession) => void;
  private onSessionPause?: () => void;
  private onSessionResume?: () => void;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): SpeedLearnConfig {
    return {
      repetitionsPerSession: 3,
      wordPause: 800,         // 0.8 seconds between Hindi and English
      sentencePause: 1200,    // 1.2 seconds between words
      maxWordsPerSession: 15,
      enableBackgroundMusic: false,
      speechSpeed: 1.0,
      exposuresBeforeMastery: 5
    };
  }

  /**
   * Start a new Speed Learn session
   */
  async startSession(config?: Partial<SpeedLearnConfig>): Promise<SpeedLearnSession> {
    if (this.isPlaying) {
      throw new Error('Session already in progress');
    }

    // Update config if provided
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Get words for today's session
    this.sessionWords = await this.getSessionWords();
    
    if (this.sessionWords.length === 0) {
      throw new Error('No words available for Speed Learn session');
    }

    // Create session record
    this.currentSession = {
      id: `speed-learn-${Date.now()}`,
      startTime: Date.now(),
      itemsPlayed: [],
      repetitionsCompleted: 0,
      completed: false
    };

    // Initialize session state
    this.currentWordIndex = 0;
    this.currentRepetition = 0;
    this.isPlaying = true;
    this.isPaused = false;

    // Start playing
    await this.playCurrentWord();

    return this.currentSession;
  }

  /**
   * Get words for today's session based on Speed Learn stages
   */
  private async getSessionWords(): Promise<VocabularyItem[]> {
    const allItems = await this.storageManager.getAllVocabulary();
    
    console.log('Total vocabulary items:', allItems.length);
    
    // Debug: Check if items have Speed Learn fields
    const itemsWithoutSpeedLearn = allItems.filter(item => 
      !item.srsData.speedLearnStage || item.srsData.exposureCount === undefined
    );
    
    if (itemsWithoutSpeedLearn.length > 0) {
      console.warn('Found vocabulary items without Speed Learn fields:', itemsWithoutSpeedLearn.length);
      // Trigger a storage re-initialization to migrate these items
      await this.storageManager.getAllVocabulary(); // This should trigger migration
    }
    
    // Speed Learn focuses ONLY on new learning - no reviews!
    const newLearningWords = allItems.filter(item => 
      item.srsData.speedLearnStage === SpeedLearnStage.NEW ||
      item.srsData.speedLearnStage === SpeedLearnStage.PASSIVE_LEARNING
    );

    console.log('New learning words available:', newLearningWords.length);
    console.log('Speed Learn is purely for NEW learning - reviews stay in Reviews tab');

    // If no words have Speed Learn stages, treat all as new
    if (newLearningWords.length === 0 && allItems.length > 0) {
      console.log('No items with Speed Learn stages found, treating all as new');
      return allItems.slice(0, this.config.maxWordsPerSession);
    }

    // Return ONLY new learning words - no reviews mixed in
    return newLearningWords.slice(0, this.config.maxWordsPerSession);
  }

  /**
   * Play current word with TTS
   */
  private async playCurrentWord(): Promise<void> {
    if (!this.isPlaying || this.isPaused || !this.currentSession) {
      return;
    }

    const word = this.sessionWords[this.currentWordIndex];
    if (!word) {
      await this.completeSession();
      return;
    }

    // Notify word start
    this.onWordStart?.(word, this.currentRepetition + 1);

    // Add to queue: Hindi TTS -> pause -> English TTS -> pause
    this.audioQueue = [
      () => this.speakText(word.targetLanguageWord, 'hi-IN'),
      () => this.pause(this.config.wordPause),
      () => this.speakText(word.englishTranslation, 'en-US'),
      () => this.pause(this.config.sentencePause)
    ];

    await this.processAudioQueue();

    // Update word exposure count
    await this.updateWordExposure(word);

    // Notify word complete
    this.onWordComplete?.(word, this.currentRepetition + 1);

    // Move to next word or repetition
    await this.advanceToNext();
  }

  /**
   * Process audio queue sequentially
   */
  private async processAudioQueue(): Promise<void> {
    if (this.isProcessingAudio) return;

    this.isProcessingAudio = true;
    
    while (this.audioQueue.length > 0 && this.isPlaying && !this.isPaused) {
      const audioAction = this.audioQueue.shift();
      if (audioAction) {
        await audioAction();
      }
    }

    this.isProcessingAudio = false;
  }

  /**
   * Text-to-speech with promise wrapper
   */
  private speakText(text: string, lang: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isPlaying || this.isPaused) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = this.config.speechSpeed;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (error) => {
        console.warn('TTS error:', error);
        resolve(); // Continue even if TTS fails
      };

      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Pause for specified duration
   */
  private pause(duration: number): Promise<void> {
    return new Promise(resolve => {
      if (!this.isPlaying || this.isPaused) {
        resolve();
        return;
      }
      setTimeout(resolve, duration);
    });
  }

  /**
   * Update word exposure count and stage
   */
  private async updateWordExposure(word: VocabularyItem): Promise<void> {
    const updatedWord = { ...word };
    updatedWord.srsData.exposureCount = (updatedWord.srsData.exposureCount || 0) + 1;
    updatedWord.srsData.lastSpeedLearnSession = Date.now();

    // Update stage based on exposure count (fully automatic progression)
    if (updatedWord.srsData.exposureCount >= this.config.exposuresBeforeMastery) {
      // Automatically mark as mastered and EXIT Speed Learn system
      updatedWord.srsData.speedLearnStage = SpeedLearnStage.MASTERED;
      updatedWord.srsData.masteredAt = Date.now();
      
      // Move to traditional SRS system (Reviews tab only)
      // Speed Learn is done with this word - it now goes to Reviews tab
      updatedWord.srsData.interval = 1; // Start fresh in traditional SRS
      updatedWord.srsData.nextReviewDate = Date.now() + (24 * 60 * 60 * 1000); // Next day
      updatedWord.srsData.repetitions = 0; // Reset for traditional SRS progression
      
      console.log(`Word "${updatedWord.targetLanguageWord}" mastered via Speed Learn - now in Reviews tab only`);
    } else if (updatedWord.srsData.speedLearnStage === SpeedLearnStage.NEW) {
      updatedWord.srsData.speedLearnStage = SpeedLearnStage.PASSIVE_LEARNING;
    }

    await this.storageManager.updateVocabulary(updatedWord);

    // Add to session tracking
    if (this.currentSession && !this.currentSession.itemsPlayed.includes(word.id)) {
      this.currentSession.itemsPlayed.push(word.id);
    }
  }

  /**
   * Advance to next word or repetition
   */
  private async advanceToNext(): Promise<void> {
    if (!this.isPlaying || !this.currentSession) return;

    this.currentWordIndex++;

    // Check if we completed all words in current repetition
    if (this.currentWordIndex >= this.sessionWords.length) {
      this.currentRepetition++;
      this.currentSession.repetitionsCompleted = this.currentRepetition;

      // Check if we completed all repetitions
      if (this.currentRepetition >= this.config.repetitionsPerSession) {
        await this.completeSession();
        return;
      }

      // Start next repetition
      this.currentWordIndex = 0;
    }

    // Continue with next word
    setTimeout(() => this.playCurrentWord(), 100);
  }

  /**
   * Complete the current session
   */
  private async completeSession(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.currentSession.completed = true;
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

    this.isPlaying = false;
    this.isPaused = false;

    // Save session data
    await this.saveSession(this.currentSession);

    // Notify completion
    this.onSessionComplete?.(this.currentSession);

    this.currentSession = null;
  }

  /**
   * Pause current session
   */
  pauseSession(): void {
    if (!this.isPlaying) return;

    this.isPaused = true;
    speechSynthesis.cancel(); // Stop current TTS
    this.onSessionPause?.();
  }

  /**
   * Resume paused session
   */
  resumeSession(): void {
    if (!this.isPlaying || !this.isPaused) return;

    this.isPaused = false;
    this.onSessionResume?.();
    
    // Continue playing current word
    setTimeout(() => this.playCurrentWord(), 100);
  }

  /**
   * Stop current session
   */
  async stopSession(): Promise<void> {
    if (!this.isPlaying || !this.currentSession) return;

    speechSynthesis.cancel();
    
    this.currentSession.endTime = Date.now();
    this.currentSession.completed = false;
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

    await this.saveSession(this.currentSession);

    this.isPlaying = false;
    this.isPaused = false;
    this.currentSession = null;
  }

  /**
   * Save session data to storage
   */
  private async saveSession(session: SpeedLearnSession): Promise<void> {
    // Save to chrome.storage or your preferred storage method
    const sessions = await this.getStoredSessions();
    sessions.push(session);
    
    // Keep only last 50 sessions
    const recentSessions = sessions.slice(-50);
    
    await chrome.storage.local.set({ speedLearnSessions: recentSessions });
  }

  /**
   * Get stored sessions
   */
  private async getStoredSessions(): Promise<SpeedLearnSession[]> {
    const result = await chrome.storage.local.get(['speedLearnSessions']);
    return result.speedLearnSessions || [];
  }

  /**
   * Get statistics about current Speed Learn progress (new learning only)
   */
  async getLearningProgress(): Promise<{
    newWords: number;
    learningWords: number;
    masteredWords: number;
    totalInTraditionalReviews: number;
  }> {
    const allItems = await this.storageManager.getAllVocabulary();
    
    return {
      newWords: allItems.filter(item => item.srsData.speedLearnStage === SpeedLearnStage.NEW).length,
      learningWords: allItems.filter(item => item.srsData.speedLearnStage === SpeedLearnStage.PASSIVE_LEARNING).length,
      masteredWords: allItems.filter(item => item.srsData.speedLearnStage === SpeedLearnStage.MASTERED).length,
      totalInTraditionalReviews: allItems.filter(item => 
        item.srsData.speedLearnStage === SpeedLearnStage.MASTERED && 
        item.srsData.nextReviewDate <= Date.now()
      ).length
    };
  }

  // Event listener setters
  setOnWordStart(callback: (word: VocabularyItem, repetition: number) => void): void {
    this.onWordStart = callback;
  }

  setOnWordComplete(callback: (word: VocabularyItem, repetition: number) => void): void {
    this.onWordComplete = callback;
  }

  setOnSessionComplete(callback: (session: SpeedLearnSession) => void): void {
    this.onSessionComplete = callback;
  }

  setOnSessionPause(callback: () => void): void {
    this.onSessionPause = callback;
  }

  setOnSessionResume(callback: () => void): void {
    this.onSessionResume = callback;
  }

  // Getters
  getCurrentSession(): SpeedLearnSession | null {
    return this.currentSession;
  }

  isSessionActive(): boolean {
    return this.isPlaying;
  }

  isSessionPaused(): boolean {
    return this.isPaused;
  }

  getCurrentProgress(): { wordIndex: number; repetition: number; totalWords: number } {
    return {
      wordIndex: this.currentWordIndex,
      repetition: this.currentRepetition,
      totalWords: this.sessionWords.length
    };
  }
}