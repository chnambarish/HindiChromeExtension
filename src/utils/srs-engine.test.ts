import { SM2Engine, SRSUtils } from './srs-engine';
import { VocabularyItem, SRSData, ReviewQuality } from '@/types';

// Mock vocabulary item helper
const createMockVocabularyItem = (overrides?: Partial<VocabularyItem>): VocabularyItem => ({
  id: 'test-1',
  targetLanguageWord: 'नमस्ते',
  englishTranslation: 'hello',
  pronunciationAudioUrl: '',
  tags: ['greeting'],
  srsData: SM2Engine.createInitialSRSData(),
  ...overrides,
});

describe('SM2Engine', () => {
  describe('createInitialSRSData', () => {
    it('should create valid initial SRS data', () => {
      const srsData = SM2Engine.createInitialSRSData();
      
      expect(srsData.repetitions).toBe(0);
      expect(srsData.easeFactor).toBe(2.5);
      expect(srsData.interval).toBe(0);
      expect(srsData.lastReviewed).toBe(0);
      expect(srsData.nextReviewDate).toBeLessThanOrEqual(Date.now());
      expect(srsData.createdAt).toBeLessThanOrEqual(Date.now());
      expect(srsData.updatedAt).toBeLessThanOrEqual(Date.now());
    });
  });
  
  describe('processReview', () => {
    it('should handle first successful review (quality 3)', () => {
      const item = createMockVocabularyItem();
      const result = SM2Engine.processReview(item, 3); // Good
      
      expect(result.srsData.repetitions).toBe(1);
      expect(result.srsData.interval).toBe(1);
      expect(result.srsData.easeFactor).toBeCloseTo(2.5); // Quality 3 -> 4, should maintain ease factor
      expect(result.srsData.lastReviewed).toBeGreaterThan(0);
      expect(result.srsData.nextReviewDate).toBeGreaterThan(Date.now());
    });
    
    it('should handle second successful review (quality 4)', () => {
      const item = createMockVocabularyItem({
        srsData: {
          ...SM2Engine.createInitialSRSData(),
          repetitions: 1,
          interval: 1,
          easeFactor: 2.5,
        },
      });
      
      const result = SM2Engine.processReview(item, 4); // Easy
      
      expect(result.srsData.repetitions).toBe(2);
      expect(result.srsData.interval).toBe(6);
      expect(result.srsData.easeFactor).toBeGreaterThan(2.5); // Quality 4 should increase ease factor
      expect(result.srsData.nextReviewDate).toBeGreaterThan(Date.now());
    });
    
    it('should use SM-2 formula for third and subsequent reviews', () => {
      const item = createMockVocabularyItem({
        srsData: {
          ...SM2Engine.createInitialSRSData(),
          repetitions: 2,
          interval: 6,
          easeFactor: 2.6,
        },
      });
      
      const result = SM2Engine.processReview(item, 3); // Good
      
      expect(result.srsData.repetitions).toBe(3);
      expect(result.srsData.interval).toBe(Math.round(6 * 2.6)); // interval * easeFactor
      expect(result.srsData.easeFactor).toBeCloseTo(2.6); // Quality 3 -> 4, should maintain ease factor
    });
    
    it('should reset repetitions on failed review (quality < 3)', () => {
      const item = createMockVocabularyItem({
        srsData: {
          ...SM2Engine.createInitialSRSData(),
          repetitions: 3,
          interval: 15,
          easeFactor: 2.4,
        },
      });
      
      const result = SM2Engine.processReview(item, 1); // Again
      
      expect(result.srsData.repetitions).toBe(0);
      expect(result.srsData.interval).toBe(1);
      expect(result.srsData.easeFactor).toBeLessThan(2.4); // Should decrease
    });
    
    it('should not let ease factor go below minimum', () => {
      const item = createMockVocabularyItem({
        srsData: {
          ...SM2Engine.createInitialSRSData(),
          easeFactor: 1.3, // Already at minimum
        },
      });
      
      const result = SM2Engine.processReview(item, 1); // Again (failed)
      
      expect(result.srsData.easeFactor).toBe(1.3); // Should not go below minimum
    });
    
    it('should handle different quality ratings correctly', () => {
      const baseItem = createMockVocabularyItem({
        srsData: {
          ...SM2Engine.createInitialSRSData(),
          repetitions: 1,
          easeFactor: 2.5,
        },
      });
      
      const resultEasy = SM2Engine.processReview({ ...baseItem }, 4);
      const resultGood = SM2Engine.processReview({ ...baseItem }, 3);
      const resultHard = SM2Engine.processReview({ ...baseItem }, 2);
      const resultAgain = SM2Engine.processReview({ ...baseItem }, 1);
      
      // Easy should increase ease factor most
      expect(resultEasy.srsData.easeFactor).toBeGreaterThan(resultGood.srsData.easeFactor);
      
      // Hard should still increase repetitions but might affect ease factor
      expect(resultHard.srsData.repetitions).toBe(0); // Failed (< 3)
      
      // Again should reset
      expect(resultAgain.srsData.repetitions).toBe(0);
      expect(resultAgain.srsData.easeFactor).toBeLessThan(2.5);
    });
  });
  
  describe('getDueItems', () => {
    it('should return items due for review', () => {
      const now = Date.now();
      const vocabulary: VocabularyItem[] = [
        createMockVocabularyItem({
          id: 'due-1',
          srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: now - 1000 },
        }),
        createMockVocabularyItem({
          id: 'future-1',
          srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: now + 86400000 },
        }),
        createMockVocabularyItem({
          id: 'due-2',
          srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: now },
        }),
      ];
      
      const dueItems = SM2Engine.getDueItems(vocabulary, now);
      
      expect(dueItems).toHaveLength(2);
      expect(dueItems.map(item => item.id).sort()).toEqual(['due-1', 'due-2']);
    });
  });
  
  describe('getNewItems', () => {
    it('should return items that have never been reviewed', () => {
      const vocabulary: VocabularyItem[] = [
        createMockVocabularyItem({
          id: 'new-1',
          srsData: { ...SM2Engine.createInitialSRSData() },
        }),
        createMockVocabularyItem({
          id: 'reviewed-1',
          srsData: {
            ...SM2Engine.createInitialSRSData(),
            repetitions: 1,
            lastReviewed: Date.now(),
          },
        }),
        createMockVocabularyItem({
          id: 'new-2',
          srsData: {
            ...SM2Engine.createInitialSRSData(),
            repetitions: 0,
            lastReviewed: 0,
          },
        }),
      ];
      
      const newItems = SM2Engine.getNewItems(vocabulary);
      
      expect(newItems).toHaveLength(2);
      expect(newItems.map(item => item.id).sort()).toEqual(['new-1', 'new-2']);
    });
  });
  
  describe('getLearnedItems', () => {
    it('should return items with sufficient repetitions', () => {
      const vocabulary: VocabularyItem[] = [
        createMockVocabularyItem({
          id: 'learned-1',
          srsData: { ...SM2Engine.createInitialSRSData(), repetitions: 5 },
        }),
        createMockVocabularyItem({
          id: 'learning-1',
          srsData: { ...SM2Engine.createInitialSRSData(), repetitions: 2 },
        }),
        createMockVocabularyItem({
          id: 'learned-2',
          srsData: { ...SM2Engine.createInitialSRSData(), repetitions: 3 },
        }),
      ];
      
      const learnedItems = SM2Engine.getLearnedItems(vocabulary);
      
      expect(learnedItems).toHaveLength(2);
      expect(learnedItems.map(item => item.id).sort()).toEqual(['learned-1', 'learned-2']);
    });
    
    it('should respect custom minimum repetitions', () => {
      const vocabulary: VocabularyItem[] = [
        createMockVocabularyItem({
          id: 'high-rep',
          srsData: { ...SM2Engine.createInitialSRSData(), repetitions: 8 },
        }),
        createMockVocabularyItem({
          id: 'medium-rep',
          srsData: { ...SM2Engine.createInitialSRSData(), repetitions: 5 },
        }),
        createMockVocabularyItem({
          id: 'low-rep',
          srsData: { ...SM2Engine.createInitialSRSData(), repetitions: 3 },
        }),
      ];
      
      const learnedItems = SM2Engine.getLearnedItems(vocabulary, 6);
      
      expect(learnedItems).toHaveLength(1);
      expect(learnedItems[0].id).toBe('high-rep');
    });
  });
  
  describe('calculateStats', () => {
    it('should calculate basic statistics correctly', () => {
      const vocabulary: VocabularyItem[] = [
        createMockVocabularyItem({
          id: 'due-item',
          srsData: { 
            ...SM2Engine.createInitialSRSData(), 
            nextReviewDate: Date.now() - 1000,
            repetitions: 1, // Has been reviewed before
            lastReviewed: Date.now() - 86400000, // Reviewed yesterday
          },
        }),
        createMockVocabularyItem({
          id: 'new-item',
          srsData: SM2Engine.createInitialSRSData(),
        }),
        createMockVocabularyItem({
          id: 'learned-item',
          srsData: { 
            ...SM2Engine.createInitialSRSData(), 
            repetitions: 5,
            lastReviewed: Date.now() - 86400000, // Reviewed yesterday
          },
        }),
        createMockVocabularyItem({
          id: 'future-item',
          srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: Date.now() + 86400000 },
        }),
      ];
      
      const stats = SM2Engine.calculateStats(vocabulary);
      
      expect(stats.totalItems).toBe(4);
      expect(stats.dueToday).toBe(3); // due-item + new-item + learned-item (all <= now)
      expect(stats.newToday).toBe(2); // new-item and future-item (both never reviewed)
      expect(stats.learnedItems).toBe(1); // learned-item
      expect(stats.accuracyRate).toBe(0); // No review history
      expect(stats.totalReviews).toBe(0);
    });
  });
  
  describe('resetProgress', () => {
    it('should reset SRS data while preserving item data', () => {
      const item = createMockVocabularyItem({
        srsData: {
          ...SM2Engine.createInitialSRSData(),
          repetitions: 5,
          interval: 30,
          easeFactor: 2.8,
          lastReviewed: Date.now() - 86400000,
        },
      });
      
      const result = SM2Engine.resetProgress(item);
      
      // Item data should be preserved
      expect(result.id).toBe(item.id);
      expect(result.targetLanguageWord).toBe(item.targetLanguageWord);
      
      // SRS data should be reset
      expect(result.srsData.repetitions).toBe(0);
      expect(result.srsData.interval).toBe(0);
      expect(result.srsData.easeFactor).toBe(2.5);
      expect(result.srsData.lastReviewed).toBe(0);
      expect(result.srsData.nextReviewDate).toBeLessThanOrEqual(Date.now());
    });
  });
});

describe('SRSUtils', () => {
  describe('formatInterval', () => {
    it('should format intervals correctly', () => {
      expect(SRSUtils.formatInterval(0.5)).toBe('Less than a day');
      expect(SRSUtils.formatInterval(1)).toBe('1 day');
      expect(SRSUtils.formatInterval(7)).toBe('7 days');
      expect(SRSUtils.formatInterval(30)).toBe('1 month');
      expect(SRSUtils.formatInterval(60)).toBe('2 months');
      expect(SRSUtils.formatInterval(365)).toBe('1 year');
      expect(SRSUtils.formatInterval(730)).toBe('2 years');
    });
  });
  
  describe('getDifficultyLevel', () => {
    it('should return correct difficulty levels', () => {
      expect(SRSUtils.getDifficultyLevel(2.6)).toBe('Easy');
      expect(SRSUtils.getDifficultyLevel(2.3)).toBe('Normal');
      expect(SRSUtils.getDifficultyLevel(1.8)).toBe('Hard');
      expect(SRSUtils.getDifficultyLevel(1.5)).toBe('Very Hard');
      expect(SRSUtils.getDifficultyLevel(1.3)).toBe('Very Hard');
    });
  });
  
  describe('isDue', () => {
    it('should correctly identify due items', () => {
      const now = Date.now();
      const dueItem = createMockVocabularyItem({
        srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: now - 1000 },
      });
      const futureItem = createMockVocabularyItem({
        srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: now + 1000 },
      });
      
      expect(SRSUtils.isDue(dueItem, now)).toBe(true);
      expect(SRSUtils.isDue(futureItem, now)).toBe(false);
    });
  });
  
  describe('getDaysUntilReview', () => {
    it('should calculate days until review correctly', () => {
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      const futureItem = createMockVocabularyItem({
        srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: now + oneDayInMs },
      });
      const pastItem = createMockVocabularyItem({
        srsData: { ...SM2Engine.createInitialSRSData(), nextReviewDate: now - oneDayInMs },
      });
      
      expect(SRSUtils.getDaysUntilReview(futureItem, now)).toBe(1);
      expect(SRSUtils.getDaysUntilReview(pastItem, now)).toBe(-1);
    });
  });
});