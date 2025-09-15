import { StorageManager } from '../storage';
import { VocabularyItem, UserConfig, ReviewSession, LearningStats, SRSData } from '@/types';
import { SM2Engine } from '../srs-engine';

// Mock Chrome APIs with proper callback handling
const mockLocalStorage: Record<string, any> = {};
const mockSyncStorage: Record<string, any> = {};

global.chrome = {
  runtime: {
    getManifest: jest.fn().mockReturnValue({ version: '1.0.0' }),
    lastError: undefined
  },
  storage: {
    local: {
      get: jest.fn().mockImplementation((keys) => {
        return new Promise((resolve) => {
          if (typeof keys === 'string') {
            resolve({ [keys]: mockLocalStorage[keys] });
          } else if (Array.isArray(keys)) {
            const result: Record<string, any> = {};
            keys.forEach(key => {
              if (mockLocalStorage[key] !== undefined) {
                result[key] = mockLocalStorage[key];
              }
            });
            resolve(result);
          } else {
            resolve(mockLocalStorage);
          }
        });
      }),
      set: jest.fn().mockImplementation((items) => {
        return new Promise<void>((resolve) => {
          Object.assign(mockLocalStorage, items);
          resolve();
        });
      }),
      clear: jest.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
          resolve();
        });
      }),
      remove: jest.fn(),
      getBytesInUse: jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(1024);
        });
      })
    },
    sync: {
      get: jest.fn().mockImplementation((keys) => {
        return new Promise((resolve) => {
          if (typeof keys === 'string') {
            resolve({ [keys]: mockSyncStorage[keys] });
          } else if (Array.isArray(keys)) {
            const result: Record<string, any> = {};
            keys.forEach(key => {
              if (mockSyncStorage[key] !== undefined) {
                result[key] = mockSyncStorage[key];
              }
            });
            resolve(result);
          } else {
            resolve(mockSyncStorage);
          }
        });
      }),
      set: jest.fn().mockImplementation((items) => {
        return new Promise<void>((resolve) => {
          Object.assign(mockSyncStorage, items);
          resolve();
        });
      }),
      clear: jest.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          Object.keys(mockSyncStorage).forEach(key => delete mockSyncStorage[key]);
          resolve();
        });
      }),
      getBytesInUse: jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(512);
        });
      })
    }
  }
} as any;

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('StorageManager', () => {
  const mockVocabularyItem: VocabularyItem = {
    id: 'test-id-1',
    targetLanguageWord: 'नमस्ते',
    englishTranslation: 'hello',
    tags: ['greeting'],
    srsData: {
      nextReviewDate: Date.now() + 86400000,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      lastReviewed: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  };

  const mockUserConfig: UserConfig = {
    ttsVoice: 'default',
    speechRate: 1.0,
    speechPitch: 1.0,
    notificationsEnabled: true,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    targetLanguage: 'hi-IN',
    newWordRepetitions: 3
  };

  const mockReviewSession: ReviewSession = {
    itemId: 'test-id-1',
    startTime: Date.now(),
    endTime: Date.now() + 300000,
    quality: 4,
    responseTime: 5000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock storage
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
    Object.keys(mockSyncStorage).forEach(key => delete mockSyncStorage[key]);
  });

  describe('Basic Storage Operations', () => {
    test('should get vocabulary with empty default', async () => {
      const vocabulary = await StorageManager.getVocabulary();
      expect(vocabulary).toEqual([]);
      expect(chrome.storage.local.get).toHaveBeenCalledWith('vocabulary');
    });

    test('should set and get vocabulary', async () => {
      const vocabularyItems = [mockVocabularyItem];

      await StorageManager.setVocabulary(vocabularyItems);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ vocabulary: vocabularyItems });

      const retrieved = await StorageManager.getVocabulary();
      expect(retrieved).toEqual(vocabularyItems);
    });

    test('should add vocabulary item', async () => {
      const itemInput = {
        targetLanguageWord: mockVocabularyItem.targetLanguageWord,
        englishTranslation: mockVocabularyItem.englishTranslation,
        tags: mockVocabularyItem.tags,
        pronunciationAudioUrl: mockVocabularyItem.pronunciationAudioUrl
      };
      await StorageManager.addVocabularyItem(itemInput);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          vocabulary: [expect.objectContaining({
            targetLanguageWord: mockVocabularyItem.targetLanguageWord,
            englishTranslation: mockVocabularyItem.englishTranslation,
            id: expect.any(String),
            srsData: expect.any(Object)
          })]
        })
      );
    });

    test('should update vocabulary item', async () => {
      // Set up existing vocabulary
      mockLocalStorage.vocabulary = [mockVocabularyItem];

      const updatedItem = { ...mockVocabularyItem, englishTranslation: 'updated hello' };
      await StorageManager.updateVocabularyItem(updatedItem);

      expect(chrome.storage.local.set).toHaveBeenCalled();
      // The updated item should have the new translation and updated timestamp
      expect(mockLocalStorage.vocabulary[0].englishTranslation).toBe('updated hello');
    });

    test('should remove vocabulary item', async () => {
      // Set up existing vocabulary
      mockLocalStorage.vocabulary = [mockVocabularyItem];

      await StorageManager.deleteVocabularyItem('test-id-1');

      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(mockLocalStorage.vocabulary).toEqual([]);
    });
  });

  describe('User Configuration', () => {
    test('should get user config with default values', async () => {
      const config = await StorageManager.getUserConfig();
      expect(config.targetLanguage).toBe('hi-IN');
      expect(config.newWordRepetitions).toBe(3);
      expect(config.notificationsEnabled).toBe(true);
    });

    test('should set and get user config', async () => {
      await StorageManager.setUserConfig(mockUserConfig);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ userConfig: mockUserConfig });

      const retrieved = await StorageManager.getUserConfig();
      expect(retrieved).toEqual(mockUserConfig);
    });
  });

  describe('Review Sessions', () => {
    test('should handle review sessions', async () => {
      await StorageManager.addReviewSession(mockReviewSession);
      
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys.includes('reviewHistory')) {
          callback?.({ reviewHistory: [mockReviewSession] });
        } else {
          callback?.({});
        }
      });

      const sessions = await StorageManager.getReviewHistory();
      expect(sessions).toEqual([mockReviewSession]);
    });

    test('should get all reviews from history', async () => {
      const session1 = {
        ...mockReviewSession,
        itemId: 'item-1'
      };

      const session2 = {
        ...mockReviewSession,
        itemId: 'item-2',
        startTime: Date.now() - 86400000 // Yesterday
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ reviewHistory: [session1, session2] });
      });

      const allSessions = await StorageManager.getReviewHistory();
      expect(allSessions).toEqual([session1, session2]);
    });
  });

  describe('Learning Statistics', () => {
    test('should calculate learning statistics', async () => {
      const vocabulary = [
        mockVocabularyItem,
        {
          ...mockVocabularyItem,
          id: 'test-id-2',
          srsData: { ...mockVocabularyItem.srsData, repetitions: 3 }
        }
      ];

      const reviewSessions = [mockReviewSession];

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys.includes('vocabulary')) {
          callback?.({ vocabulary });
        } else if (keys.includes('reviewHistory')) {
          callback?.({ reviewHistory: reviewSessions });
        } else {
          callback?.({});
        }
      });

      await StorageManager.updateLearningStats();

      // Verify stats were calculated and stored
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          learningStats: expect.objectContaining({
            totalItems: expect.any(Number),
            dueToday: expect.any(Number),
            reviewedToday: expect.any(Number),
            lastUpdated: expect.any(Number)
          })
        })
      );
    });

    test('should get learning statistics', async () => {
      const mockStats: LearningStats = {
        totalItems: 10,
        dueToday: 5,
        newToday: 2,
        reviewedToday: 3,
        accuracyRate: 0.85,
        streak: 7,
        totalReviews: 15
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ learningStats: { ...mockStats, lastUpdated: Date.now() } });
      });

      const stats = await StorageManager.getLearningStats();
      expect(stats.totalItems).toBe(10);
      expect(stats.dueToday).toBe(5);
      expect(stats.streak).toBe(7);
    });
  });

  describe('SRS Operations', () => {
    test('should get due vocabulary items', async () => {
      const now = Date.now();
      const dueItem = { ...mockVocabularyItem, srsData: { ...mockVocabularyItem.srsData, nextReviewDate: now - 1000 } };
      const notDueItem = { ...mockVocabularyItem, id: 'not-due', srsData: { ...mockVocabularyItem.srsData, nextReviewDate: now + 86400000 } };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [dueItem, notDueItem] });
      });

      const dueItems = await StorageManager.getDueVocabulary();
      expect(dueItems).toEqual([dueItem]);
    });

    test('should process vocabulary review', async () => {
      const existingItems = [mockVocabularyItem];
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys.includes('vocabulary')) {
          callback?.({ vocabulary: existingItems });
        } else {
          callback?.({ reviewHistory: [] });
        }
      });

      const updatedItem = await StorageManager.processVocabularyReview('test-id-1', 4, 5000, Date.now() - 5000);
      
      expect(updatedItem.srsData.repetitions).toBeGreaterThan(mockVocabularyItem.srsData.repetitions);
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(2); // Once for vocabulary update, once for review session
    });
  });

  describe('Export Functionality', () => {
    test('should export data with validation', async () => {
      const vocabulary = [mockVocabularyItem];
      const reviewHistory = [mockReviewSession];

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys.includes('vocabulary')) {
          callback?.({ vocabulary });
        } else if (keys.includes('userConfig')) {
          callback?.({ userConfig: mockUserConfig });
        } else if (keys.includes('reviewHistory')) {
          callback?.({ reviewHistory });
        } else if (keys.includes('learningStats')) {
          callback?.({ learningStats: {} });
        } else {
          callback?.({});
        }
      });

      const exportData = await StorageManager.exportData();
      const parsed = JSON.parse(exportData);

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.vocabulary).toEqual(vocabulary);
      expect(parsed.userConfig).toEqual(mockUserConfig);
      expect(parsed.reviewHistory).toEqual(reviewHistory);
      expect(parsed.exportDate).toBeDefined();
    });

    test('should fail export with invalid data', async () => {
      // Mock invalid vocabulary data
      const invalidVocabulary = [{ invalidProperty: 'test' }];
      
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys.includes('vocabulary')) {
          callback?.({ vocabulary: invalidVocabulary });
        } else {
          callback?.({});
        }
      });

      await expect(StorageManager.exportData()).rejects.toThrow('Export validation failed');
    });
  });

  describe('Import Vocabulary', () => {
    test('should import valid vocabulary items', async () => {
      const newItem = {
        id: 'new-item',
        targetLanguageWord: 'धन्यवाद',
        englishTranslation: 'thank you',
        tags: ['gratitude']
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [] });
      });

      const result = await StorageManager.importVocabulary([newItem]);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    test('should handle duplicate items correctly', async () => {
      const existingItems = [mockVocabularyItem];
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: existingItems });
      });

      // Try to import the same item
      const result = await StorageManager.importVocabulary([mockVocabularyItem]);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    test('should allow duplicates when specified', async () => {
      const existingItems = [mockVocabularyItem];
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: existingItems });
      });

      const result = await StorageManager.importVocabulary([mockVocabularyItem], { allowDuplicates: true });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    test('should skip invalid items when specified', async () => {
      const validItem = { ...mockVocabularyItem, id: 'valid-item' };
      const invalidItem = { targetLanguageWord: 'test' }; // Missing required fields

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [] });
      });

      const result = await StorageManager.importVocabulary([validItem, invalidItem] as any[], { skipInvalid: true });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBeGreaterThan(0);
    });

    test('should fail on invalid items when not skipping', async () => {
      const invalidItem = { targetLanguageWord: 'test' }; // Missing required fields

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [] });
      });

      await expect(StorageManager.importVocabulary([invalidItem] as any[]))
        .rejects.toThrow('Vocabulary validation failed');
    });
  });

  describe('Import Full Data', () => {
    test('should import complete valid dataset', async () => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        vocabulary: [mockVocabularyItem],
        userConfig: mockUserConfig,
        reviewHistory: [mockReviewSession],
        learningStats: {}
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [] });
      });

      const result = await StorageManager.importFullData(JSON.stringify(exportData));

      expect(result.success).toBe(true);
      expect(result.imported.vocabulary).toBe(1);
      expect(result.imported.configImported).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should handle invalid JSON', async () => {
      const result = await StorageManager.importFullData('invalid json');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.imported.vocabulary).toBe(0);
    });

    test('should validate only when requested', async () => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        vocabulary: [mockVocabularyItem],
        userConfig: mockUserConfig
      };

      const result = await StorageManager.importFullData(
        JSON.stringify(exportData),
        { validateOnly: true }
      );

      expect(result.summary).toContain('vocabulary items: 1');
      expect(result.imported.vocabulary).toBe(0); // Nothing should be imported in validation mode
    });

    test('should replace existing data when specified', async () => {
      const existingItems = [mockVocabularyItem];
      const newItem = { ...mockVocabularyItem, id: 'new-item', targetLanguageWord: 'नया' };
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        vocabulary: [newItem]
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: existingItems });
      });

      const result = await StorageManager.importFullData(
        JSON.stringify(exportData),
        { replaceExisting: true }
      );

      expect(result.success).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        vocabulary: [newItem]
      });
    });

    test('should handle review history import in replace mode', async () => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        vocabulary: [],
        reviewHistory: [mockReviewSession]
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [] });
      });

      const result = await StorageManager.importFullData(
        JSON.stringify(exportData),
        { replaceExisting: true }
      );

      expect(result.success).toBe(true);
      expect(result.imported.reviewHistory).toBe(1);
    });

    test('should skip review history in merge mode', async () => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        vocabulary: [],
        reviewHistory: [mockReviewSession]
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [] });
      });

      const result = await StorageManager.importFullData(
        JSON.stringify(exportData),
        { replaceExisting: false }
      );

      expect(result.warnings).toContain('Review history import in merge mode not supported - skipping');
      expect(result.skipped.reviewHistory).toBe(1);
    });
  });

  describe('Utility Methods', () => {
    test('should initialize storage', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys === 'installationDate') {
          callback?.({});
        } else {
          callback?.({ vocabulary: [] });
        }
      });

      await StorageManager.initialize();
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should clear all data', async () => {
      // Mock sync storage
      (global.chrome as any).storage.sync = {
        clear: jest.fn()
      };

      await StorageManager.clearAllData();
      expect(chrome.storage.local.clear).toHaveBeenCalled();
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
    });

    test('should get storage usage', async () => {
      (chrome.storage.local.getBytesInUse as jest.Mock).mockResolvedValue(1024);
      (chrome.storage.sync.getBytesInUse as jest.Mock).mockResolvedValue(512);
      
      // Mock sync storage
      (global.chrome as any).storage.sync = {
        getBytesInUse: jest.fn().mockResolvedValue(512)
      };

      const usage = await StorageManager.getStorageUsage();
      expect(usage).toEqual({ local: 1024, sync: 512 });
    });

    test('should create and get backup', async () => {
      const vocabulary = [mockVocabularyItem];
      const reviewHistory = [mockReviewSession];

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys.includes('vocabulary')) {
          callback?.({ vocabulary });
        } else if (keys.includes('userConfig')) {
          callback?.({ userConfig: mockUserConfig });
        } else if (keys.includes('reviewHistory')) {
          callback?.({ reviewHistory });
        } else if (keys.includes('learningStats')) {
          callback?.({ learningStats: {} });
        } else if (keys === 'lastBackup') {
          callback?.({
            lastBackup: {
              data: 'backup-data',
              timestamp: Date.now()
            }
          });
        } else {
          callback?.({});
        }
      });

      // Create backup
      await StorageManager.createBackup();
      expect(chrome.storage.local.set).toHaveBeenCalled();
      
      // Get backup
      const backup = await StorageManager.getLastBackup();
      expect(backup).toEqual({
        data: 'backup-data',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle Chrome storage errors gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        // Simulate Chrome error - Chrome storage errors are handled differently in real implementation
        throw new Error('Storage quota exceeded');
      });

      await expect(StorageManager.getVocabulary()).rejects.toThrow('Storage quota exceeded');
    });

    test('should handle malformed stored data', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        // Return malformed data
        callback?.({ vocabulary: "not an array" });
      });

      const vocabulary = await StorageManager.getVocabulary();
      expect(vocabulary).toEqual([]); // Should return empty array as fallback
    });

    test('should handle adding vocabulary item without srsData', async () => {
      const itemWithoutSRS = {
        targetLanguageWord: 'test',
        englishTranslation: 'test',
        tags: ['test']
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback?.({ vocabulary: [] });
      });

      await StorageManager.addVocabularyItem(itemWithoutSRS);

      // Should have been called with SRS data added automatically
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        vocabulary: [expect.objectContaining({
          targetLanguageWord: 'test',
          englishTranslation: 'test',
          id: expect.any(String),
          srsData: expect.objectContaining({
            interval: expect.any(Number),
            repetitions: expect.any(Number),
            easeFactor: expect.any(Number)
          })
        })]
      });
    });
  });
});
