/**
 * Curriculum Storage Manager
 * 
 * Extends the main storage manager to handle daily lessons and curriculum data
 */

import { StorageManager, STORAGE_KEYS } from './storage';
import { DailyLesson, LessonProgress, LessonStatus, CurriculumConfig, CurriculumOverview } from '../types/curriculum';

/**
 * Additional storage keys for curriculum data
 */
export const CURRICULUM_STORAGE_KEYS = {
  DAILY_LESSONS: 'dailyLessons',
  LESSON_PROGRESS: 'lessonProgress',
  CURRICULUM_CONFIG: 'curriculumConfig',
  CURRICULUM_OVERVIEW: 'curriculumOverview',
  CURRENT_LESSON: 'currentLesson',
} as const;

/**
 * Default curriculum configuration
 */
const DEFAULT_CURRICULUM_CONFIG: CurriculumConfig = {
  wordsPerDay: 10,
  maxWordsPerLesson: 15,
  minWordsPerLesson: 5,
  autoAdvance: true,
  requireSequentialCompletion: false,
  preferredCategories: ['greetings', 'numbers', 'colors', 'family', 'food', 'fruits', 'vegetables', 'animals', 'body', 'clothing'],
  skipWeekends: false,
  preferredLessonDuration: 15
};

/**
 * Curriculum Storage Manager
 */
export class CurriculumStorageManager extends StorageManager {
  
  // =============================================================================
  // DAILY LESSONS MANAGEMENT
  // =============================================================================

  /**
   * Get all daily lessons
   */
  static async getDailyLessons(): Promise<DailyLesson[]> {
    const result = await chrome.storage.local.get(CURRICULUM_STORAGE_KEYS.DAILY_LESSONS);
    return result[CURRICULUM_STORAGE_KEYS.DAILY_LESSONS] || [];
  }

  /**
   * Set all daily lessons (replaces existing)
   */
  static async setDailyLessons(lessons: DailyLesson[]): Promise<void> {
    await chrome.storage.local.set({
      [CURRICULUM_STORAGE_KEYS.DAILY_LESSONS]: lessons,
    });
  }

  /**
   * Add a new daily lesson
   */
  static async addDailyLesson(lesson: DailyLesson): Promise<void> {
    const lessons = await this.getDailyLessons();
    lessons.push(lesson);
    await this.setDailyLessons(lessons);
  }

  /**
   * Update an existing daily lesson
   */
  static async updateDailyLesson(updatedLesson: DailyLesson): Promise<void> {
    const lessons = await this.getDailyLessons();
    const index = lessons.findIndex(lesson => lesson.id === updatedLesson.id);
    
    if (index === -1) {
      throw new Error(`Daily lesson with id ${updatedLesson.id} not found`);
    }

    lessons[index] = {
      ...updatedLesson,
      updatedAt: Date.now(),
    };

    await this.setDailyLessons(lessons);
  }

  /**
   * Delete a daily lesson
   */
  static async deleteDailyLesson(lessonId: string): Promise<void> {
    const lessons = await this.getDailyLessons();
    const filteredLessons = lessons.filter(lesson => lesson.id !== lessonId);
    
    if (filteredLessons.length === lessons.length) {
      throw new Error(`Daily lesson with id ${lessonId} not found`);
    }

    await this.setDailyLessons(filteredLessons);
  }

  /**
   * Get a specific daily lesson by ID
   */
  static async getDailyLesson(lessonId: string): Promise<DailyLesson | null> {
    const lessons = await this.getDailyLessons();
    return lessons.find(lesson => lesson.id === lessonId) || null;
  }

  /**
   * Get lessons by category
   */
  static async getLessonsByCategory(category: string): Promise<DailyLesson[]> {
    const lessons = await this.getDailyLessons();
    return lessons.filter(lesson => lesson.category === category);
  }

  /**
   * Get lessons by day range
   */
  static async getLessonsByDayRange(startDay: number, endDay: number): Promise<DailyLesson[]> {
    const lessons = await this.getDailyLessons();
    return lessons.filter(lesson => 
      lesson.dayNumber >= startDay && lesson.dayNumber <= endDay
    ).sort((a, b) => a.dayNumber - b.dayNumber);
  }

  // =============================================================================
  // LESSON PROGRESS MANAGEMENT
  // =============================================================================

  /**
   * Get all lesson progress data
   */
  static async getLessonProgress(): Promise<LessonProgress[]> {
    const result = await chrome.storage.local.get(CURRICULUM_STORAGE_KEYS.LESSON_PROGRESS);
    return result[CURRICULUM_STORAGE_KEYS.LESSON_PROGRESS] || [];
  }

  /**
   * Set all lesson progress data (replaces existing)
   */
  static async setLessonProgress(progressData: LessonProgress[]): Promise<void> {
    await chrome.storage.local.set({
      [CURRICULUM_STORAGE_KEYS.LESSON_PROGRESS]: progressData,
    });
  }

  /**
   * Get progress for a specific lesson
   */
  static async getLessonProgressById(lessonId: string): Promise<LessonProgress | null> {
    const progressData = await this.getLessonProgress();
    return progressData.find(progress => progress.lessonId === lessonId) || null;
  }

  /**
   * Update progress for a specific lesson
   */
  static async updateLessonProgress(updatedProgress: LessonProgress): Promise<void> {
    const progressData = await this.getLessonProgress();
    const index = progressData.findIndex(progress => progress.lessonId === updatedProgress.lessonId);
    
    const progressToSave = {
      ...updatedProgress,
      lastActivity: Date.now(),
    };

    if (index === -1) {
      // Add new progress entry
      progressData.push(progressToSave);
    } else {
      // Update existing progress
      progressData[index] = progressToSave;
    }

    await this.setLessonProgress(progressData);
  }

  /**
   * Initialize progress for a new lesson
   */
  static async initializeLessonProgress(lessonId: string, totalWords: number): Promise<LessonProgress> {
    const newProgress: LessonProgress = {
      lessonId,
      status: LessonStatus.NOT_STARTED,
      wordsCompleted: 0,
      totalWords,
      timeSpent: 0,
      speedLearnSessions: 0,
      reviewSessions: 0,
      accuracy: 0,
      lastActivity: Date.now(),
    };

    await this.updateLessonProgress(newProgress);
    return newProgress;
  }

  // =============================================================================
  // CURRICULUM CONFIGURATION
  // =============================================================================

  /**
   * Get curriculum configuration
   */
  static async getCurriculumConfig(): Promise<CurriculumConfig> {
    const result = await chrome.storage.sync.get(CURRICULUM_STORAGE_KEYS.CURRICULUM_CONFIG);
    return result[CURRICULUM_STORAGE_KEYS.CURRICULUM_CONFIG] || DEFAULT_CURRICULUM_CONFIG;
  }

  /**
   * Set curriculum configuration
   */
  static async setCurriculumConfig(config: CurriculumConfig): Promise<void> {
    await chrome.storage.sync.set({
      [CURRICULUM_STORAGE_KEYS.CURRICULUM_CONFIG]: config,
    });
  }

  /**
   * Update specific curriculum configuration settings
   */
  static async updateCurriculumConfig(partialConfig: Partial<CurriculumConfig>): Promise<void> {
    const currentConfig = await this.getCurriculumConfig();
    const updatedConfig = { ...currentConfig, ...partialConfig };
    await this.setCurriculumConfig(updatedConfig);
  }

  // =============================================================================
  // CURRICULUM OVERVIEW
  // =============================================================================

  /**
   * Get curriculum overview
   */
  static async getCurriculumOverview(): Promise<CurriculumOverview | null> {
    const result = await chrome.storage.local.get(CURRICULUM_STORAGE_KEYS.CURRICULUM_OVERVIEW);
    return result[CURRICULUM_STORAGE_KEYS.CURRICULUM_OVERVIEW] || null;
  }

  /**
   * Set curriculum overview
   */
  static async setCurriculumOverview(overview: CurriculumOverview): Promise<void> {
    await chrome.storage.local.set({
      [CURRICULUM_STORAGE_KEYS.CURRICULUM_OVERVIEW]: overview,
    });
  }

  // =============================================================================
  // CURRENT LESSON TRACKING
  // =============================================================================

  /**
   * Get current active lesson ID
   */
  static async getCurrentLessonId(): Promise<string | null> {
    const result = await chrome.storage.local.get(CURRICULUM_STORAGE_KEYS.CURRENT_LESSON);
    return result[CURRICULUM_STORAGE_KEYS.CURRENT_LESSON] || null;
  }

  /**
   * Set current active lesson ID
   */
  static async setCurrentLessonId(lessonId: string | null): Promise<void> {
    if (lessonId) {
      await chrome.storage.local.set({
        [CURRICULUM_STORAGE_KEYS.CURRENT_LESSON]: lessonId,
      });
    } else {
      await chrome.storage.local.remove(CURRICULUM_STORAGE_KEYS.CURRENT_LESSON);
    }
  }

  /**
   * Get current active lesson with full data
   */
  static async getCurrentLesson(): Promise<DailyLesson | null> {
    const currentLessonId = await this.getCurrentLessonId();
    if (!currentLessonId) return null;
    
    return await this.getDailyLesson(currentLessonId);
  }

  // =============================================================================
  // CURRICULUM ANALYTICS
  // =============================================================================

  /**
   * Get curriculum completion statistics
   */
  static async getCurriculumStats(): Promise<{
    totalLessons: number;
    completedLessons: number;
    inProgressLessons: number;
    totalWords: number;
    masteredWords: number;
    completionRate: number;
    averageAccuracy: number;
    totalTimeSpent: number;
  }> {
    const [lessons, progressData] = await Promise.all([
      this.getDailyLessons(),
      this.getLessonProgress()
    ]);

    const progressMap = new Map(progressData.map(p => [p.lessonId, p]));
    
    let completedLessons = 0;
    let inProgressLessons = 0;
    let totalWords = 0;
    let masteredWords = 0;
    let totalAccuracy = 0;
    let totalTimeSpent = 0;
    let lessonsWithAccuracy = 0;

    lessons.forEach(lesson => {
      totalWords += lesson.vocabularyItems.length;
      const progress = progressMap.get(lesson.id);
      
      if (progress) {
        if (progress.status === 'completed' || progress.status === 'mastered') {
          completedLessons++;
        } else if (progress.status === 'in_progress') {
          inProgressLessons++;
        }
        
        masteredWords += progress.wordsCompleted;
        totalTimeSpent += progress.timeSpent;
        
        if (progress.accuracy > 0) {
          totalAccuracy += progress.accuracy;
          lessonsWithAccuracy++;
        }
      }
    });

    return {
      totalLessons: lessons.length,
      completedLessons,
      inProgressLessons,
      totalWords,
      masteredWords,
      completionRate: lessons.length > 0 ? completedLessons / lessons.length : 0,
      averageAccuracy: lessonsWithAccuracy > 0 ? totalAccuracy / lessonsWithAccuracy : 0,
      totalTimeSpent
    };
  }

  // =============================================================================
  // DATA IMPORT/EXPORT FOR CURRICULUM
  // =============================================================================

  /**
   * Export curriculum data
   */
  static async exportCurriculumData(): Promise<string> {
    const [lessons, progressData, config, overview] = await Promise.all([
      this.getDailyLessons(),
      this.getLessonProgress(),
      this.getCurriculumConfig(),
      this.getCurriculumOverview()
    ]);

    const exportData = {
      version: chrome.runtime.getManifest().version,
      exportDate: new Date().toISOString(),
      curriculum: {
        lessons,
        progressData,
        config,
        overview
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import curriculum data
   */
  static async importCurriculumData(jsonData: string): Promise<{
    success: boolean;
    message: string;
    imported: {
      lessons: number;
      progressData: number;
      configImported: boolean;
    };
  }> {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.curriculum) {
        throw new Error('Invalid curriculum data format');
      }

      const { lessons, progressData, config } = data.curriculum;
      let importedLessons = 0;
      let importedProgress = 0;
      let configImported = false;

      // Import lessons
      if (lessons && Array.isArray(lessons)) {
        await this.setDailyLessons(lessons);
        importedLessons = lessons.length;
      }

      // Import progress data
      if (progressData && Array.isArray(progressData)) {
        await this.setLessonProgress(progressData);
        importedProgress = progressData.length;
      }

      // Import configuration
      if (config) {
        await this.setCurriculumConfig(config);
        configImported = true;
      }

      return {
        success: true,
        message: `Successfully imported ${importedLessons} lessons, ${importedProgress} progress entries${configImported ? ', and configuration' : ''}`,
        imported: {
          lessons: importedLessons,
          progressData: importedProgress,
          configImported
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        imported: {
          lessons: 0,
          progressData: 0,
          configImported: false
        }
      };
    }
  }

  /**
   * Clear all curriculum data
   */
  static async clearCurriculumData(): Promise<void> {
    await Promise.all([
      chrome.storage.local.remove(CURRICULUM_STORAGE_KEYS.DAILY_LESSONS),
      chrome.storage.local.remove(CURRICULUM_STORAGE_KEYS.LESSON_PROGRESS),
      chrome.storage.local.remove(CURRICULUM_STORAGE_KEYS.CURRICULUM_OVERVIEW),
      chrome.storage.local.remove(CURRICULUM_STORAGE_KEYS.CURRENT_LESSON),
      chrome.storage.sync.remove(CURRICULUM_STORAGE_KEYS.CURRICULUM_CONFIG)
    ]);
  }
}
