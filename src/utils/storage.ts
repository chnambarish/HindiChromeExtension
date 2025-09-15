/**
 * Chrome Storage Utilities
 * 
 * Provides a centralized interface for managing all extension data
 * including vocabulary items, user configuration, learning statistics,
 * and review sessions using Chrome's storage API.
 */

import { VocabularyItem, UserConfig, LearningStats, ReviewSession, SRSData } from '@/types';
import { SM2Engine } from './srs-engine';

/**
 * Storage keys used in Chrome storage
 */
export const STORAGE_KEYS = {
  VOCABULARY: 'vocabulary',
  USER_CONFIG: 'userConfig',
  REVIEW_HISTORY: 'reviewHistory', 
  LEARNING_STATS: 'learningStats',
  LAST_BACKUP: 'lastBackup',
  INSTALLATION_DATE: 'installationDate',
  VERSION: 'version',
} as const;

/**
 * Default user configuration
 */
const DEFAULT_CONFIG: UserConfig = {
  ttsVoice: 'default',
  speechRate: 1.0,
  speechPitch: 1.0,
  notificationsEnabled: true,
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 8,    // 8 AM
  targetLanguage: 'hi-IN',
  newWordRepetitions: 3,
};

/**
 * Default sample vocabulary for new installations
 */
const DEFAULT_VOCABULARY: VocabularyItem[] = [
  {
    id: 'default-1',
    targetLanguageWord: 'नमस्ते',
    englishTranslation: 'hello/goodbye',
    pronunciationAudioUrl: '',
    tags: ['greeting', 'common'],
    srsData: SM2Engine.createInitialSRSData(),
  },
  {
    id: 'default-2',
    targetLanguageWord: 'धन्यवाद',
    englishTranslation: 'thank you',
    pronunciationAudioUrl: '',
    tags: ['gratitude', 'common'],
    srsData: SM2Engine.createInitialSRSData(),
  },
  {
    id: 'default-3',
    targetLanguageWord: 'माफ़ करें',
    englishTranslation: 'excuse me/sorry',
    pronunciationAudioUrl: '',
    tags: ['apology', 'common'],
    srsData: SM2Engine.createInitialSRSData(),
  },
  {
    id: 'default-4',
    targetLanguageWord: 'कृपया',
    englishTranslation: 'please',
    pronunciationAudioUrl: '',
    tags: ['politeness', 'common'],
    srsData: SM2Engine.createInitialSRSData(),
  },
  {
    id: 'default-5',
    targetLanguageWord: 'हाँ',
    englishTranslation: 'yes',
    pronunciationAudioUrl: '',
    tags: ['response', 'basic'],
    srsData: SM2Engine.createInitialSRSData(),
  },
];

/**
 * Chrome Storage Manager
 */
export class StorageManager {
  /**
   * Initialize storage on first install or extension update
   */
  static async initialize(): Promise<void> {
    try {
      // Check if this is first installation
      const installationDate = await this.getInstallationDate();
      if (!installationDate) {
        await this.performFirstTimeSetup();
      }

      // Check if vocabulary exists, if not create default
      const vocabulary = await this.getVocabulary();
      if (!vocabulary || vocabulary.length === 0) {
        await this.setVocabulary(DEFAULT_VOCABULARY);
      }

      // Ensure user config exists
      const config = await this.getUserConfig();
      if (!config) {
        await this.setUserConfig(DEFAULT_CONFIG);
      }

      // Initialize empty review history if it doesn't exist
      const reviewHistory = await this.getReviewHistory();
      if (!reviewHistory) {
        await this.setReviewHistory([]);
      }

      console.log('Storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Perform first-time setup for new installations
   */
  private static async performFirstTimeSetup(): Promise<void> {
    const now = Date.now();
    await Promise.all([
      this.setInstallationDate(now),
      this.setVersion(chrome.runtime.getManifest().version),
      this.setVocabulary(DEFAULT_VOCABULARY),
      this.setUserConfig(DEFAULT_CONFIG),
      this.setReviewHistory([]),
      this.updateLearningStats(),
    ]);
    console.log('First-time setup completed');
  }

  // =============================================================================
  // VOCABULARY MANAGEMENT
  // =============================================================================

  /**
   * Get all vocabulary items
   */
  static async getVocabulary(): Promise<VocabularyItem[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VOCABULARY);
    return result[STORAGE_KEYS.VOCABULARY] || [];
  }

  /**
   * Set all vocabulary items (replaces existing)
   */
  static async setVocabulary(vocabulary: VocabularyItem[]): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.VOCABULARY]: vocabulary,
    });
    await this.updateLearningStats();
  }

  /**
   * Add a new vocabulary item
   */
  static async addVocabularyItem(item: Omit<VocabularyItem, 'id' | 'srsData'>): Promise<VocabularyItem> {
    const vocabulary = await this.getVocabulary();
    
    const newItem: VocabularyItem = {
      ...item,
      id: this.generateId(),
      srsData: SM2Engine.createInitialSRSData(),
    };

    vocabulary.push(newItem);
    await this.setVocabulary(vocabulary);
    
    return newItem;
  }

  /**
   * Update an existing vocabulary item
   */
  static async updateVocabularyItem(updatedItem: VocabularyItem): Promise<void> {
    const vocabulary = await this.getVocabulary();
    const index = vocabulary.findIndex(item => item.id === updatedItem.id);
    
    if (index === -1) {
      throw new Error(`Vocabulary item with id ${updatedItem.id} not found`);
    }

    vocabulary[index] = {
      ...updatedItem,
      srsData: {
        ...updatedItem.srsData,
        updatedAt: Date.now(),
      },
    };

    await this.setVocabulary(vocabulary);
  }

  /**
   * Delete a vocabulary item
   */
  static async deleteVocabularyItem(itemId: string): Promise<void> {
    const vocabulary = await this.getVocabulary();
    const filteredVocabulary = vocabulary.filter(item => item.id !== itemId);
    
    if (filteredVocabulary.length === vocabulary.length) {
      throw new Error(`Vocabulary item with id ${itemId} not found`);
    }

    await this.setVocabulary(filteredVocabulary);
  }

  /**
   * Get vocabulary items due for review
   */
  static async getDueVocabulary(currentTime: number = Date.now()): Promise<VocabularyItem[]> {
    const vocabulary = await this.getVocabulary();
    return SM2Engine.getDueItems(vocabulary, currentTime);
  }

  /**
   * Get new vocabulary items (never reviewed)
   */
  static async getNewVocabulary(): Promise<VocabularyItem[]> {
    const vocabulary = await this.getVocabulary();
    return SM2Engine.getNewItems(vocabulary);
  }

  /**
   * Get learned vocabulary items
   */
  static async getLearnedVocabulary(minRepetitions: number = 3): Promise<VocabularyItem[]> {
    const vocabulary = await this.getVocabulary();
    return SM2Engine.getLearnedItems(vocabulary, minRepetitions);
  }

  // =============================================================================
  // USER CONFIGURATION
  // =============================================================================

  /**
   * Get user configuration
   */
  static async getUserConfig(): Promise<UserConfig> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.USER_CONFIG);
    return result[STORAGE_KEYS.USER_CONFIG] || DEFAULT_CONFIG;
  }

  /**
   * Set user configuration
   */
  static async setUserConfig(config: UserConfig): Promise<void> {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.USER_CONFIG]: config,
    });
  }

  /**
   * Update specific configuration settings
   */
  static async updateUserConfig(partialConfig: Partial<UserConfig>): Promise<void> {
    const currentConfig = await this.getUserConfig();
    const updatedConfig = { ...currentConfig, ...partialConfig };
    await this.setUserConfig(updatedConfig);
  }

  // =============================================================================
  // REVIEW HISTORY & SESSIONS
  // =============================================================================

  /**
   * Get review history
   */
  static async getReviewHistory(): Promise<ReviewSession[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.REVIEW_HISTORY);
    return result[STORAGE_KEYS.REVIEW_HISTORY] || [];
  }

  /**
   * Set review history (replaces existing)
   */
  static async setReviewHistory(sessions: ReviewSession[]): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.REVIEW_HISTORY]: sessions,
    });
  }

  /**
   * Add a review session to history
   */
  static async addReviewSession(session: ReviewSession): Promise<void> {
    const history = await this.getReviewHistory();
    history.push(session);
    
    // Keep only last 1000 sessions to prevent storage bloat
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    await this.setReviewHistory(history);
    await this.updateLearningStats();
  }

  /**
   * Process a vocabulary review and update both the item and history
   */
  static async processVocabularyReview(
    itemId: string, 
    quality: number, 
    responseTime: number,
    startTime: number
  ): Promise<VocabularyItem> {
    const vocabulary = await this.getVocabulary();
    const item = vocabulary.find(v => v.id === itemId);
    
    if (!item) {
      throw new Error(`Vocabulary item with id ${itemId} not found`);
    }

    // Process the review with SM-2 algorithm
    const updatedItem = SM2Engine.processReview(item, quality as any);
    
    // Update the vocabulary
    await this.updateVocabularyItem(updatedItem);
    
    // Add to review history
    const reviewSession: ReviewSession = {
      itemId,
      startTime,
      endTime: Date.now(),
      quality: quality as any,
      responseTime,
    };
    
    await this.addReviewSession(reviewSession);
    
    return updatedItem;
  }

  // =============================================================================
  // LEARNING STATISTICS
  // =============================================================================

  /**
   * Calculate and cache current learning statistics
   */
  static async updateLearningStats(): Promise<LearningStats> {
    const vocabulary = await this.getVocabulary();
    const reviewHistory = await this.getReviewHistory();
    
    const stats = SM2Engine.calculateStats(vocabulary, reviewHistory);
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.LEARNING_STATS]: {
        ...stats,
        lastUpdated: Date.now(),
      },
    });
    
    return stats;
  }

  /**
   * Get cached learning statistics
   */
  static async getLearningStats(): Promise<LearningStats & { lastUpdated?: number }> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LEARNING_STATS);
    return result[STORAGE_KEYS.LEARNING_STATS] || await this.updateLearningStats();
  }

  // =============================================================================
  // DATA IMPORT/EXPORT
  // =============================================================================

  /**
   * Export all extension data
   */
  static async exportData(): Promise<string> {
    const [vocabulary, config, reviewHistory, stats] = await Promise.all([
      this.getVocabulary(),
      this.getUserConfig(),
      this.getReviewHistory(),
      this.getLearningStats(),
    ]);

    const exportData = {
      version: chrome.runtime.getManifest().version,
      exportDate: new Date().toISOString(),
      vocabulary,
      userConfig: config,
      reviewHistory,
      learningStats: stats,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import vocabulary data (validates and merges)
   */
  static async importVocabulary(vocabularyData: VocabularyItem[]): Promise<void> {
    // Validate the data structure
    if (!Array.isArray(vocabularyData)) {
      throw new Error('Invalid vocabulary data: must be an array');
    }

    for (const item of vocabularyData) {
      if (!this.isValidVocabularyItem(item)) {
        throw new Error(`Invalid vocabulary item: ${JSON.stringify(item)}`);
      }
    }

    // Get existing vocabulary
    const existingVocabulary = await this.getVocabulary();
    const existingIds = new Set(existingVocabulary.map(item => item.id));

    // Process imported items
    const importedItems: VocabularyItem[] = vocabularyData.map(item => {
      // Generate new ID if it conflicts or doesn't exist
      const needsNewId = !item.id || existingIds.has(item.id);
      
      return {
        ...item,
        id: needsNewId ? this.generateId() : item.id,
        srsData: item.srsData || SM2Engine.createInitialSRSData(),
      };
    });

    // Merge with existing vocabulary
    const mergedVocabulary = [...existingVocabulary, ...importedItems];
    await this.setVocabulary(mergedVocabulary);
  }

  /**
   * Import full extension data (replaces existing)
   */
  static async importFullData(jsonData: string): Promise<void> {
    let data;
    try {
      data = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Invalid JSON data');
    }

    // Validate required fields
    if (!data.vocabulary || !Array.isArray(data.vocabulary)) {
      throw new Error('Invalid data: vocabulary array is required');
    }

    // Import vocabulary
    if (data.vocabulary.length > 0) {
      await this.importVocabulary(data.vocabulary);
    }

    // Import user config if present
    if (data.userConfig) {
      await this.setUserConfig({ ...DEFAULT_CONFIG, ...data.userConfig });
    }

    // Import review history if present and valid
    if (data.reviewHistory && Array.isArray(data.reviewHistory)) {
      await this.setReviewHistory(data.reviewHistory);
    }

    await this.updateLearningStats();
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Clear all extension data (factory reset)
   */
  static async clearAllData(): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await this.initialize();
  }

  /**
   * Get storage usage information
   */
  static async getStorageUsage(): Promise<{ local: number; sync: number }> {
    const [localUsage, syncUsage] = await Promise.all([
      chrome.storage.local.getBytesInUse(),
      chrome.storage.sync.getBytesInUse(),
    ]);

    return { local: localUsage, sync: syncUsage };
  }

  /**
   * Backup data to chrome.storage.local with timestamp
   */
  static async createBackup(): Promise<void> {
    const backupData = await this.exportData();
    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_BACKUP]: {
        data: backupData,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Get the last backup
   */
  static async getLastBackup(): Promise<{ data: string; timestamp: number } | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_BACKUP);
    return result[STORAGE_KEYS.LAST_BACKUP] || null;
  }

  /**
   * Installation and version tracking
   */
  private static async getInstallationDate(): Promise<number | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.INSTALLATION_DATE);
    return result[STORAGE_KEYS.INSTALLATION_DATE] || null;
  }

  private static async setInstallationDate(timestamp: number): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.INSTALLATION_DATE]: timestamp,
    });
  }

  private static async setVersion(version: string): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.VERSION]: version,
    });
  }

  /**
   * Generate a unique ID for vocabulary items
   */
  private static generateId(): string {
    return `vocab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate vocabulary item structure
   */
  private static isValidVocabularyItem(item: any): item is VocabularyItem {
    return (
      typeof item === 'object' &&
      item !== null &&
      typeof item.targetLanguageWord === 'string' &&
      typeof item.englishTranslation === 'string' &&
      (typeof item.id === 'string' || !item.id) &&
      (!item.tags || Array.isArray(item.tags)) &&
      (!item.srsData || this.isValidSRSData(item.srsData))
    );
  }

  /**
   * Validate SRS data structure
   */
  private static isValidSRSData(srsData: any): srsData is SRSData {
    return (
      typeof srsData === 'object' &&
      srsData !== null &&
      typeof srsData.nextReviewDate === 'number' &&
      typeof srsData.interval === 'number' &&
      typeof srsData.repetitions === 'number' &&
      typeof srsData.easeFactor === 'number' &&
      typeof srsData.lastReviewed === 'number' &&
      typeof srsData.createdAt === 'number' &&
      typeof srsData.updatedAt === 'number'
    );
  }
}

/**
 * Storage event listeners for cross-tab synchronization
 */
export class StorageEventManager {
  private static listeners: Map<string, (changes: any) => void> = new Map();

  /**
   * Initialize storage change listeners
   */
  static initialize(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      // Notify all registered listeners
      this.listeners.forEach((callback, key) => {
        callback({ changes, areaName });
      });
    });
  }

  /**
   * Register a listener for storage changes
   */
  static addListener(key: string, callback: (changes: any) => void): void {
    this.listeners.set(key, callback);
  }

  /**
   * Remove a storage change listener
   */
  static removeListener(key: string): void {
    this.listeners.delete(key);
  }
}