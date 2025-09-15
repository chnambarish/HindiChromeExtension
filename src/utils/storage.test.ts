import { StorageManager, STORAGE_KEYS } from './storage';
import { SM2Engine } from './srs-engine';
import { VocabularyItem, UserConfig, ReviewSession } from '@/types';

// Mock Chrome storage API
const mockStorageLocal = {
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn(),
  getBytesInUse: jest.fn(),
};

const mockStorageSync = {
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn(),
  getBytesInUse: jest.fn(),
};

const mockStorage = {
  local: mockStorageLocal,
  sync: mockStorageSync,
  onChanged: {
    addListener: jest.fn(),
  },
};

const mockRuntime = {
  getManifest: jest.fn(() => ({ version: '2.0.0' })),
};

// Set up global chrome mock
(globalThis as any).chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
};

// Helper function to create mock vocabulary item
const createMockVocabularyItem = (overrides?: Partial<VocabularyItem>): VocabularyItem => ({
  id: 'test-1',
  targetLanguageWord: 'नमस्ते',
  englishTranslation: 'hello',
  pronunciationAudioUrl: '',
  tags: ['greeting'],
  srsData: SM2Engine.createInitialSRSData(),
  ...overrides,
});

describe('StorageManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock return values
    mockStorageLocal.get.mockResolvedValue({});
    mockStorageSync.get.mockResolvedValue({});
    mockStorageLocal.set.mockResolvedValue(undefined);
    mockStorageSync.set.mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should perform first-time setup for new installations', async () => {
      // Mock empty storage (new installation)
      mockStorageLocal.get.mockImplementation((key) => {
        if (typeof key === 'string') {
          return Promise.resolve({ [key]: null });
        }
        return Promise.resolve({});
      });
      
      await StorageManager.initialize();
      
      expect(mockStorageLocal.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.INSTALLATION_DATE]: expect.any(Number),
        })
      );
      expect(mockStorageLocal.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.VERSION]: '2.0.0',
        })
      );
    });

    it('should skip first-time setup for existing installations', async () => {
      // Mock existing installation
      mockStorageLocal.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.INSTALLATION_DATE) {
          return Promise.resolve({ [STORAGE_KEYS.INSTALLATION_DATE]: Date.now() });
        }
        if (key === STORAGE_KEYS.VOCABULARY) {
          return Promise.resolve({ [STORAGE_KEYS.VOCABULARY]: [createMockVocabularyItem()] });
        }
        return Promise.resolve({});
      });
      
      await StorageManager.initialize();
      
      // Should not call setInstallationDate for existing installations
      const setInstallationCalls = mockStorageLocal.set.mock.calls.filter(
        call => call[0][STORAGE_KEYS.INSTALLATION_DATE]
      );
      expect(setInstallationCalls).toHaveLength(0);
    });
  });

  describe('vocabulary management', () => {
    it('should get vocabulary items', async () => {
      const mockVocabulary = [createMockVocabularyItem()];
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: mockVocabulary });
      
      const result = await StorageManager.getVocabulary();
      
      expect(mockStorageLocal.get).toHaveBeenCalledWith(STORAGE_KEYS.VOCABULARY);
      expect(result).toEqual(mockVocabulary);
    });

    it('should return empty array when no vocabulary exists', async () => {
      mockStorageLocal.get.mockResolvedValue({});
      
      const result = await StorageManager.getVocabulary();
      
      expect(result).toEqual([]);
    });

    it('should set vocabulary items', async () => {
      const mockVocabulary = [createMockVocabularyItem()];
      
      await StorageManager.setVocabulary(mockVocabulary);
      
      expect(mockStorageLocal.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VOCABULARY]: mockVocabulary,
      });
    });

    it('should add a new vocabulary item', async () => {
      const existingVocabulary = [createMockVocabularyItem({ id: 'existing-1' })];
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: existingVocabulary });
      
      const newItemData = {
        targetLanguageWord: 'धन्यवाद',
        englishTranslation: 'thank you',
        tags: ['gratitude'],
      };
      
      const result = await StorageManager.addVocabularyItem(newItemData);
      
      expect(result.id).toMatch(/^vocab_\d+_/);
      expect(result.targetLanguageWord).toBe('धन्यवाद');
      expect(result.srsData).toBeDefined();
      expect(mockStorageLocal.set).toHaveBeenCalled();
    });

    it('should update an existing vocabulary item', async () => {
      const existingItem = createMockVocabularyItem({ id: 'test-1' });
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: [existingItem] });
      
      const updatedItem = { ...existingItem, englishTranslation: 'greetings' };
      
      await StorageManager.updateVocabularyItem(updatedItem);
      
      expect(mockStorageLocal.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VOCABULARY]: [
          expect.objectContaining({
            id: 'test-1',
            englishTranslation: 'greetings',
            srsData: expect.objectContaining({
              updatedAt: expect.any(Number),
            }),
          }),
        ],
      });
    });

    it('should throw error when updating non-existent item', async () => {
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: [] });
      
      const nonExistentItem = createMockVocabularyItem({ id: 'non-existent' });
      
      await expect(StorageManager.updateVocabularyItem(nonExistentItem))
        .rejects.toThrow('Vocabulary item with id non-existent not found');
    });

    it('should delete a vocabulary item', async () => {
      const existingVocabulary = [
        createMockVocabularyItem({ id: 'test-1' }),
        createMockVocabularyItem({ id: 'test-2' }),
      ];
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: existingVocabulary });
      
      await StorageManager.deleteVocabularyItem('test-1');
      
      expect(mockStorageLocal.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VOCABULARY]: [
          expect.objectContaining({ id: 'test-2' }),
        ],
      });
    });

    it('should throw error when deleting non-existent item', async () => {
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: [] });
      
      await expect(StorageManager.deleteVocabularyItem('non-existent'))
        .rejects.toThrow('Vocabulary item with id non-existent not found');
    });
  });

  describe('user configuration', () => {
    it('should get user configuration', async () => {
      const mockConfig: UserConfig = {
        ttsVoice: 'custom-voice',
        speechRate: 1.2,
        speechPitch: 1.1,
        notificationsEnabled: false,
        quietHoursStart: 23,
        quietHoursEnd: 7,
        targetLanguage: 'hi-IN',
        newWordRepetitions: 5,
      };
      mockStorageSync.get.mockResolvedValue({ [STORAGE_KEYS.USER_CONFIG]: mockConfig });
      
      const result = await StorageManager.getUserConfig();
      
      expect(mockStorageSync.get).toHaveBeenCalledWith(STORAGE_KEYS.USER_CONFIG);
      expect(result).toEqual(mockConfig);
    });

    it('should return default config when none exists', async () => {
      mockStorageSync.get.mockResolvedValue({});
      
      const result = await StorageManager.getUserConfig();
      
      expect(result).toEqual(expect.objectContaining({
        ttsVoice: 'default',
        speechRate: 1.0,
        speechPitch: 1.0,
        notificationsEnabled: true,
        targetLanguage: 'hi-IN',
      }));
    });

    it('should set user configuration', async () => {
      const config: UserConfig = {
        ttsVoice: 'test-voice',
        speechRate: 1.5,
        speechPitch: 0.9,
        notificationsEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        targetLanguage: 'hi-IN',
        newWordRepetitions: 4,
      };
      
      await StorageManager.setUserConfig(config);
      
      expect(mockStorageSync.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.USER_CONFIG]: config,
      });
    });

    it('should update partial configuration', async () => {
      const existingConfig: UserConfig = {
        ttsVoice: 'default',
        speechRate: 1.0,
        speechPitch: 1.0,
        notificationsEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        targetLanguage: 'hi-IN',
        newWordRepetitions: 3,
      };
      mockStorageSync.get.mockResolvedValue({ [STORAGE_KEYS.USER_CONFIG]: existingConfig });
      
      const partialUpdate = { speechRate: 1.5, notificationsEnabled: false };
      
      await StorageManager.updateUserConfig(partialUpdate);
      
      expect(mockStorageSync.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.USER_CONFIG]: {
          ...existingConfig,
          speechRate: 1.5,
          notificationsEnabled: false,
        },
      });
    });
  });

  describe('review history', () => {
    it('should get review history', async () => {
      const mockHistory: ReviewSession[] = [
        {
          itemId: 'test-1',
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          quality: 3,
          responseTime: 3000,
        },
      ];
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.REVIEW_HISTORY]: mockHistory });
      
      const result = await StorageManager.getReviewHistory();
      
      expect(mockStorageLocal.get).toHaveBeenCalledWith(STORAGE_KEYS.REVIEW_HISTORY);
      expect(result).toEqual(mockHistory);
    });

    it('should add review session', async () => {
      const existingHistory: ReviewSession[] = [];
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.REVIEW_HISTORY]: existingHistory });
      
      const newSession: ReviewSession = {
        itemId: 'test-1',
        startTime: Date.now() - 2000,
        endTime: Date.now(),
        quality: 4,
        responseTime: 1500,
      };
      
      await StorageManager.addReviewSession(newSession);
      
      expect(mockStorageLocal.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.REVIEW_HISTORY]: [newSession],
      });
    });

    it('should limit review history to 1000 sessions', async () => {
      // Create 1001 existing sessions
      const existingHistory: ReviewSession[] = Array.from({ length: 1001 }, (_, i) => ({
        itemId: `test-${i}`,
        startTime: Date.now() - 10000 + i,
        endTime: Date.now() - 5000 + i,
        quality: 3,
        responseTime: 2000,
      }));
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.REVIEW_HISTORY]: existingHistory });
      
      const newSession: ReviewSession = {
        itemId: 'new-test',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        quality: 4,
        responseTime: 1000,
      };
      
      await StorageManager.addReviewSession(newSession);
      
      const savedHistory = mockStorageLocal.set.mock.calls[0][0][STORAGE_KEYS.REVIEW_HISTORY];
      expect(savedHistory).toHaveLength(1000);
      expect(savedHistory[savedHistory.length - 1]).toEqual(newSession);
    });
  });

  describe('vocabulary review processing', () => {
    it('should process vocabulary review and update both item and history', async () => {
      const mockItem = createMockVocabularyItem({ id: 'test-item' });
      mockStorageLocal.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.VOCABULARY) {
          return Promise.resolve({ [STORAGE_KEYS.VOCABULARY]: [mockItem] });
        }
        if (key === STORAGE_KEYS.REVIEW_HISTORY) {
          return Promise.resolve({ [STORAGE_KEYS.REVIEW_HISTORY]: [] });
        }
        return Promise.resolve({});
      });
      
      const startTime = Date.now() - 3000;
      const quality = 3;
      const responseTime = 2500;
      
      const result = await StorageManager.processVocabularyReview(
        'test-item',
        quality,
        responseTime,
        startTime
      );
      
      // Should return updated item with new SRS data
      expect(result.id).toBe('test-item');
      expect(result.srsData.repetitions).toBe(1);
      expect(result.srsData.lastReviewed).toBeGreaterThan(0);
      
      // Should save updated vocabulary
      expect(mockStorageLocal.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.VOCABULARY]: [
            expect.objectContaining({
              id: 'test-item',
              srsData: expect.objectContaining({
                repetitions: 1,
                lastReviewed: expect.any(Number),
              }),
            }),
          ],
        })
      );
      
      // Should save review session
      expect(mockStorageLocal.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.REVIEW_HISTORY]: [
            expect.objectContaining({
              itemId: 'test-item',
              startTime,
              quality,
              responseTime,
              endTime: expect.any(Number),
            }),
          ],
        })
      );
    });

    it('should throw error for non-existent vocabulary item', async () => {
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: [] });
      
      await expect(
        StorageManager.processVocabularyReview('non-existent', 3, 2000, Date.now())
      ).rejects.toThrow('Vocabulary item with id non-existent not found');
    });
  });

  describe('data import/export', () => {
    it('should export all extension data', async () => {
      const mockVocabulary = [createMockVocabularyItem()];
      const mockConfig: UserConfig = {
        ttsVoice: 'test-voice',
        speechRate: 1.2,
        speechPitch: 1.1,
        notificationsEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        targetLanguage: 'hi-IN',
        newWordRepetitions: 3,
      };
      const mockHistory: ReviewSession[] = [];
      const mockStats = { totalItems: 1, dueToday: 1, newToday: 1 };
      
      mockStorageLocal.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.VOCABULARY) return Promise.resolve({ [key]: mockVocabulary });
        if (key === STORAGE_KEYS.REVIEW_HISTORY) return Promise.resolve({ [key]: mockHistory });
        if (key === STORAGE_KEYS.LEARNING_STATS) return Promise.resolve({ [key]: mockStats });
        return Promise.resolve({});
      });
      
      mockStorageSync.get.mockResolvedValue({ [STORAGE_KEYS.USER_CONFIG]: mockConfig });
      
      const exportedData = await StorageManager.exportData();
      const parsedData = JSON.parse(exportedData);
      
      expect(parsedData).toEqual(
        expect.objectContaining({
          version: '2.0.0',
          vocabulary: mockVocabulary,
          userConfig: mockConfig,
          reviewHistory: mockHistory,
          learningStats: mockStats,
          exportDate: expect.any(String),
        })
      );
    });

    it('should import vocabulary data', async () => {
      const existingVocabulary = [createMockVocabularyItem({ id: 'existing-1' })];
      mockStorageLocal.get.mockResolvedValue({ [STORAGE_KEYS.VOCABULARY]: existingVocabulary });
      
      const importData = [
        createMockVocabularyItem({ 
          id: 'import-1',
          targetLanguageWord: 'धन्यवाद',
          englishTranslation: 'thank you',
        }),
      ];
      
      await StorageManager.importVocabulary(importData);
      
      // Should merge with existing vocabulary
      expect(mockStorageLocal.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.VOCABULARY]: expect.arrayContaining([
            expect.objectContaining({ id: 'existing-1' }),
            expect.objectContaining({ 
              id: 'import-1',
              targetLanguageWord: 'धन्यवाद',
            }),
          ]),
        })
      );
    });

    it('should validate imported vocabulary data', async () => {
      await expect(StorageManager.importVocabulary('invalid data' as any))
        .rejects.toThrow('Invalid vocabulary data: must be an array');
      
      await expect(StorageManager.importVocabulary([{ invalid: 'item' } as any]))
        .rejects.toThrow('Invalid vocabulary item');
    });
  });

  describe('utility methods', () => {
    it('should get storage usage', async () => {
      mockStorageLocal.getBytesInUse.mockResolvedValue(1024);
      mockStorageSync.getBytesInUse.mockResolvedValue(512);
      
      const usage = await StorageManager.getStorageUsage();
      
      expect(usage).toEqual({ local: 1024, sync: 512 });
    });

    it('should clear all data', async () => {
      await StorageManager.clearAllData();
      
      expect(mockStorageLocal.clear).toHaveBeenCalled();
      expect(mockStorageSync.clear).toHaveBeenCalled();
    });

    it('should create and get backup', async () => {
      mockStorageLocal.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.VOCABULARY) return Promise.resolve({ [key]: [] });
        if (key === STORAGE_KEYS.REVIEW_HISTORY) return Promise.resolve({ [key]: [] });
        if (key === STORAGE_KEYS.LEARNING_STATS) return Promise.resolve({ [key]: {} });
        return Promise.resolve({});
      });
      mockStorageSync.get.mockResolvedValue({});
      
      await StorageManager.createBackup();
      
      expect(mockStorageLocal.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.LAST_BACKUP]: expect.objectContaining({
            data: expect.any(String),
            timestamp: expect.any(Number),
          }),
        })
      );
    });
  });
});