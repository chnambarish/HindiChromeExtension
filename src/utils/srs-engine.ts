/**
 * SM-2 Spaced Repetition System Engine
 * 
 * Implementation of the SuperMemo-2 algorithm for optimal review scheduling
 * Based on the research by Piotr Wozniak (1987)
 * 
 * @see https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

import { VocabularyItem, SRSData, ReviewQuality, ReviewSession } from '@/types';

/**
 * Core SM-2 algorithm parameters
 */
const SM2_CONFIG = {
  /** Minimum ease factor allowed */
  MIN_EASE_FACTOR: 1.3,
  
  /** Initial ease factor for new items */
  INITIAL_EASE_FACTOR: 2.5,
  
  /** Initial interval for first successful review (days) */
  INITIAL_INTERVAL: 1,
  
  /** Second interval for items reviewed twice successfully (days) */
  SECOND_INTERVAL: 6,
  
  /** Quality threshold below which item is considered 'failed' */
  QUALITY_THRESHOLD: 3,
} as const;

/**
 * SM-2 Spaced Repetition Engine
 */
export class SM2Engine {
  /**
   * Process a review session and calculate new SRS parameters
   * 
   * @param item - The vocabulary item being reviewed
   * @param quality - The quality of user's response (1-4: Again, Hard, Good, Easy)
   * @returns Updated vocabulary item with new SRS data
   */
  static processReview(item: VocabularyItem, quality: ReviewQuality): VocabularyItem {
    const now = Date.now();
    const srsData = { ...item.srsData };
    
    // Update last reviewed timestamp
    srsData.lastReviewed = now;
    srsData.updatedAt = now;
    
    // Check if the response was correct (quality >= 3)
    const isCorrect = quality >= SM2_CONFIG.QUALITY_THRESHOLD;
    
    if (isCorrect) {
      // Correct response - proceed with SM-2 algorithm
      srsData.repetitions += 1;
      
      // Calculate new interval based on repetition number
      if (srsData.repetitions === 1) {
        srsData.interval = SM2_CONFIG.INITIAL_INTERVAL;
      } else if (srsData.repetitions === 2) {
        srsData.interval = SM2_CONFIG.SECOND_INTERVAL;
      } else {
        // For repetitions > 2, use the SM-2 formula
        srsData.interval = Math.round(srsData.interval * srsData.easeFactor);
      }
      
      // Update ease factor based on quality
      srsData.easeFactor = this.calculateNewEaseFactor(srsData.easeFactor, quality);
      
    } else {
      // Incorrect response - reset repetitions but keep ease factor
      srsData.repetitions = 0;
      srsData.interval = SM2_CONFIG.INITIAL_INTERVAL;
      
      // Slightly decrease ease factor for failed reviews
      srsData.easeFactor = Math.max(
        SM2_CONFIG.MIN_EASE_FACTOR,
        srsData.easeFactor - 0.2
      );
    }
    
    // Calculate next review date
    srsData.nextReviewDate = this.calculateNextReviewDate(now, srsData.interval);
    
    return {
      ...item,
      srsData,
    };
  }
  
  /**
   * Calculate new ease factor based on response quality using SM-2 formula
   * 
   * @param currentEaseFactor - Current ease factor
   * @param quality - Response quality (1-4)
   * @returns New ease factor
   */
  private static calculateNewEaseFactor(currentEaseFactor: number, quality: ReviewQuality): number {
    // SM-2 formula: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    // Map our 1-4 scale to 2-5 scale for better results
    // 1 (Again) -> 2, 2 (Hard) -> 3, 3 (Good) -> 4, 4 (Easy) -> 5
    const q = quality + 1;
    const newEaseFactor = currentEaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    
    // Ensure ease factor doesn't go below minimum
    return Math.max(SM2_CONFIG.MIN_EASE_FACTOR, newEaseFactor);
  }
  
  /**
   * Calculate the next review date based on current time and interval
   * 
   * @param currentTime - Current timestamp
   * @param intervalDays - Interval in days
   * @returns Next review timestamp
   */
  private static calculateNextReviewDate(currentTime: number, intervalDays: number): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return currentTime + (intervalDays * millisecondsPerDay);
  }
  
  /**
   * Create initial SRS data for a new vocabulary item
   * 
   * @returns Initial SRS data
   */
  static createInitialSRSData(): SRSData {
    const now = Date.now();
    
    return {
      nextReviewDate: now, // Available for review immediately
      interval: 0, // Will be set to 1 day after first review
      repetitions: 0,
      easeFactor: SM2_CONFIG.INITIAL_EASE_FACTOR,
      lastReviewed: 0,
      createdAt: now,
      updatedAt: now,
    };
  }
  
  /**
   * Get all vocabulary items that are due for review
   * 
   * @param vocabulary - Array of vocabulary items
   * @param currentTime - Current timestamp (defaults to now)
   * @returns Array of items due for review
   */
  static getDueItems(vocabulary: VocabularyItem[], currentTime: number = Date.now()): VocabularyItem[] {
    return vocabulary.filter(item => item.srsData.nextReviewDate <= currentTime);
  }
  
  /**
   * Get vocabulary items that are new (never reviewed)
   * 
   * @param vocabulary - Array of vocabulary items
   * @returns Array of new items
   */
  static getNewItems(vocabulary: VocabularyItem[]): VocabularyItem[] {
    return vocabulary.filter(item => item.srsData.repetitions === 0 && item.srsData.lastReviewed === 0);
  }
  
  /**
   * Get vocabulary items that are learned (successfully reviewed multiple times)
   * 
   * @param vocabulary - Array of vocabulary items
   * @param minRepetitions - Minimum repetitions to consider "learned" (default: 3)
   * @returns Array of learned items
   */
  static getLearnedItems(vocabulary: VocabularyItem[], minRepetitions: number = 3): VocabularyItem[] {
    return vocabulary.filter(item => item.srsData.repetitions >= minRepetitions);
  }
  
  /**
   * Calculate learning statistics for a vocabulary set
   * 
   * @param vocabulary - Array of vocabulary items
   * @param reviewHistory - Optional review history for accuracy calculation
   * @returns Learning statistics
   */
  static calculateStats(vocabulary: VocabularyItem[], reviewHistory: ReviewSession[] = []) {
    const now = Date.now();
    const today = new Date().toDateString();
    
    const dueItems = this.getDueItems(vocabulary, now);
    const newItems = this.getNewItems(vocabulary);
    const learnedItems = this.getLearnedItems(vocabulary);
    
    // Calculate today's reviews
    const todayReviews = reviewHistory.filter(session => 
      session.endTime && new Date(session.endTime).toDateString() === today
    );
    
    // Calculate accuracy rate from recent reviews (last 50 reviews)
    const recentReviews = reviewHistory
      .filter(session => session.quality !== undefined)
      .slice(-50);
    
    const accuracyRate = recentReviews.length > 0
      ? recentReviews.filter(session => session.quality! >= SM2_CONFIG.QUALITY_THRESHOLD).length / recentReviews.length
      : 0;
    
    // Calculate learning streak (days with reviews)
    const reviewDates = new Set(
      reviewHistory
        .filter(session => session.endTime)
        .map(session => new Date(session.endTime!).toDateString())
    );
    
    return {
      totalItems: vocabulary.length,
      dueToday: dueItems.length,
      newToday: newItems.length,
      reviewedToday: todayReviews.length,
      learnedItems: learnedItems.length,
      accuracyRate,
      streak: reviewDates.size, // Simplified streak calculation
      totalReviews: reviewHistory.length,
    };
  }
  
  /**
   * Reset progress for a vocabulary item (useful for difficult items)
   * 
   * @param item - The vocabulary item to reset
   * @returns Item with reset SRS data
   */
  static resetProgress(item: VocabularyItem): VocabularyItem {
    return {
      ...item,
      srsData: {
        ...item.srsData,
        nextReviewDate: Date.now(),
        interval: 0,
        repetitions: 0,
        easeFactor: SM2_CONFIG.INITIAL_EASE_FACTOR,
        lastReviewed: 0,
        updatedAt: Date.now(),
      },
    };
  }
}

/**
 * Utility functions for working with SRS data
 */
export const SRSUtils = {
  /**
   * Format interval in human-readable form
   * 
   * @param intervalDays - Interval in days
   * @returns Human-readable interval string
   */
  formatInterval: (intervalDays: number): string => {
    if (intervalDays < 1) return 'Less than a day';
    if (intervalDays === 1) return '1 day';
    if (intervalDays < 30) return `${intervalDays} days`;
    if (intervalDays < 365) {
      const months = Math.round(intervalDays / 30);
      return months === 1 ? '1 month' : `${months} months`;
    }
    const years = Math.round(intervalDays / 365);
    return years === 1 ? '1 year' : `${years} years`;
  },
  
  /**
   * Get difficulty level based on ease factor
   * 
   * @param easeFactor - Current ease factor
   * @returns Difficulty level string
   */
  getDifficultyLevel: (easeFactor: number): string => {
    if (easeFactor >= 2.5) return 'Easy';
    if (easeFactor >= 2.0) return 'Normal';
    if (easeFactor >= 1.7) return 'Hard';
    return 'Very Hard';
  },
  
  /**
   * Check if an item is due for review
   * 
   * @param item - Vocabulary item
   * @param currentTime - Current timestamp (defaults to now)
   * @returns True if item is due
   */
  isDue: (item: VocabularyItem, currentTime: number = Date.now()): boolean => {
    return item.srsData.nextReviewDate <= currentTime;
  },
  
  /**
   * Get days until next review
   * 
   * @param item - Vocabulary item
   * @param currentTime - Current timestamp (defaults to now)
   * @returns Days until next review (negative if overdue)
   */
  getDaysUntilReview: (item: VocabularyItem, currentTime: number = Date.now()): number => {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((item.srsData.nextReviewDate - currentTime) / millisecondsPerDay);
  },
};