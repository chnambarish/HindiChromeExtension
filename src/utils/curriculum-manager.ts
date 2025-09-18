/**
 * Curriculum Manager
 * 
 * Handles the creation, management, and organization of daily vocabulary lessons
 */

import { VocabularyItem, SpeedLearnStage } from '../types/vocabulary';
import {
  DailyLesson,
  LessonProgress,
  LessonStatus,
  CurriculumConfig,
  CurriculumGenerationOptions,
  OrganizationStrategy,
  CurriculumOverview,
  LessonRecommendation,
  RecommendationReason
} from '../types/curriculum';
import { SM2Engine } from './srs-engine';
import { CurriculumStorageManager } from './curriculum-storage';

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
  preferredLessonDuration: 15 // minutes
};

/**
 * Curriculum Manager Class
 */
export class CurriculumManager {
  private config: CurriculumConfig;

  constructor(config: Partial<CurriculumConfig> = {}) {
    this.config = { ...DEFAULT_CURRICULUM_CONFIG, ...config };
  }

  /**
   * Generate a complete curriculum from vocabulary data
   */
  generateCurriculum(options: CurriculumGenerationOptions): DailyLesson[] {
    const { sourceVocabulary, totalDays, startDate, organizationStrategy } = options;
    
    if (!sourceVocabulary || sourceVocabulary.length === 0) {
      throw new Error('Source vocabulary cannot be empty');
    }

    // Organize vocabulary based on strategy
    const organizedVocabulary = this.organizeVocabulary(sourceVocabulary, organizationStrategy);
    
    // Calculate words per lesson
    const totalWords = sourceVocabulary.length;
    const wordsPerLesson = Math.min(
      Math.max(Math.ceil(totalWords / totalDays), this.config.minWordsPerLesson),
      this.config.maxWordsPerLesson
    );

    // Generate lessons
    const lessons: DailyLesson[] = [];
    let currentIndex = 0;
    let dayNumber = 1;

    while (currentIndex < organizedVocabulary.length && dayNumber <= totalDays) {
      const lessonWords = organizedVocabulary.slice(currentIndex, currentIndex + wordsPerLesson);
      
      if (lessonWords.length === 0) break;

      const lesson = this.createDailyLesson({
        dayNumber,
        vocabularyItems: lessonWords,
        startDate: new Date(startDate.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000)
      });

      lessons.push(lesson);
      currentIndex += wordsPerLesson;
      dayNumber++;
    }

    return lessons;
  }

  /**
   * Create a single daily lesson
   */
  private createDailyLesson(params: {
    dayNumber: number;
    vocabularyItems: VocabularyItem[];
    startDate: Date;
  }): DailyLesson {
    const { dayNumber, vocabularyItems, startDate } = params;
    
    // Determine lesson category based on vocabulary tags
    const category = this.determineLessonCategory(vocabularyItems);
    
    // Calculate difficulty level
    const difficultyLevel = this.calculateLessonDifficulty(vocabularyItems);
    
    // Estimate duration
    const estimatedDuration = this.estimateLessonDuration(vocabularyItems.length);

    return {
      id: this.generateLessonId(dayNumber),
      dayNumber,
      title: this.generateLessonTitle(category, dayNumber),
      description: this.generateLessonDescription(category, vocabularyItems.length),
      category,
      vocabularyItems,
      targetWordCount: vocabularyItems.length,
      estimatedDuration,
      difficultyLevel,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Organize vocabulary based on different strategies
   */
  private organizeVocabulary(vocabulary: VocabularyItem[], strategy: OrganizationStrategy): VocabularyItem[] {
    switch (strategy) {
      case OrganizationStrategy.BY_CATEGORY:
        return this.organizeByCategory(vocabulary);
      
      case OrganizationStrategy.BY_DIFFICULTY:
        return this.organizeByDifficulty(vocabulary);
      
      case OrganizationStrategy.MIXED_CATEGORIES:
        return this.organizeMixedCategories(vocabulary);
      
      case OrganizationStrategy.BY_FREQUENCY:
        return this.organizeByFrequency(vocabulary);
      
      case OrganizationStrategy.CUSTOM_ORDER:
        return [...vocabulary]; // Keep original order
      
      default:
        return this.organizeByCategory(vocabulary);
    }
  }

  /**
   * Organize vocabulary by semantic categories
   */
  private organizeByCategory(vocabulary: VocabularyItem[]): VocabularyItem[] {
    const categorized = new Map<string, VocabularyItem[]>();
    const uncategorized: VocabularyItem[] = [];

    // Group by categories
    vocabulary.forEach(item => {
      const category = this.extractPrimaryCategory(item);
      if (category) {
        if (!categorized.has(category)) {
          categorized.set(category, []);
        }
        categorized.get(category)!.push(item);
      } else {
        uncategorized.push(item);
      }
    });

    // Order categories by preference
    const orderedVocabulary: VocabularyItem[] = [];
    
    // Add preferred categories first
    this.config.preferredCategories.forEach(category => {
      if (categorized.has(category)) {
        orderedVocabulary.push(...categorized.get(category)!);
        categorized.delete(category);
      }
    });

    // Add remaining categories
    Array.from(categorized.values()).forEach(items => {
      orderedVocabulary.push(...items);
    });

    // Add uncategorized items at the end
    orderedVocabulary.push(...uncategorized);

    return orderedVocabulary;
  }

  /**
   * Organize vocabulary by difficulty level
   */
  private organizeByDifficulty(vocabulary: VocabularyItem[]): VocabularyItem[] {
    return [...vocabulary].sort((a, b) => {
      const difficultyA = this.calculateWordDifficulty(a);
      const difficultyB = this.calculateWordDifficulty(b);
      return difficultyA - difficultyB;
    });
  }

  /**
   * Organize vocabulary with mixed categories for variety
   */
  private organizeMixedCategories(vocabulary: VocabularyItem[]): VocabularyItem[] {
    const categorized = this.organizeByCategory(vocabulary);
    const mixed: VocabularyItem[] = [];
    
    // Create category buckets
    const categoryBuckets = new Map<string, VocabularyItem[]>();
    categorized.forEach(item => {
      const category = this.extractPrimaryCategory(item) || 'uncategorized';
      if (!categoryBuckets.has(category)) {
        categoryBuckets.set(category, []);
      }
      categoryBuckets.get(category)!.push(item);
    });

    // Interleave items from different categories
    const bucketArrays = Array.from(categoryBuckets.values());
    let maxLength = Math.max(...bucketArrays.map(arr => arr.length));
    
    for (let i = 0; i < maxLength; i++) {
      bucketArrays.forEach(bucket => {
        if (i < bucket.length) {
          mixed.push(bucket[i]);
        }
      });
    }

    return mixed;
  }

  /**
   * Organize vocabulary by frequency (common words first)
   */
  private organizeByFrequency(vocabulary: VocabularyItem[]): VocabularyItem[] {
    // For now, use word length as a proxy for frequency (shorter = more common)
    // In a real implementation, you'd use actual frequency data
    return [...vocabulary].sort((a, b) => {
      const lengthA = a.targetLanguageWord.length;
      const lengthB = b.targetLanguageWord.length;
      return lengthA - lengthB;
    });
  }

  /**
   * Extract primary category from vocabulary item
   */
  private extractPrimaryCategory(item: VocabularyItem): string | null {
    if (!item.tags || item.tags.length === 0) {
      return null;
    }

    // Find the first tag that matches a preferred category
    for (const preferredCategory of this.config.preferredCategories) {
      if (item.tags.includes(preferredCategory)) {
        return preferredCategory;
      }
    }

    // Return the first tag if no preferred category matches
    return item.tags[0];
  }

  /**
   * Calculate word difficulty based on various factors
   */
  private calculateWordDifficulty(item: VocabularyItem): number {
    let difficulty = 1;

    // Length factor (longer words are generally harder)
    const wordLength = item.targetLanguageWord.length;
    if (wordLength > 8) difficulty += 2;
    else if (wordLength > 5) difficulty += 1;

    // SRS data factor (items with more repetitions are easier)
    if (item.srsData.repetitions > 5) difficulty -= 1;
    else if (item.srsData.repetitions > 2) difficulty -= 0.5;

    // Speed Learn stage factor
    if (item.srsData.speedLearnStage === SpeedLearnStage.MASTERED) {
      difficulty -= 2;
    } else if (item.srsData.speedLearnStage === SpeedLearnStage.PASSIVE_LEARNING) {
      difficulty -= 1;
    }

    return Math.max(1, Math.min(5, difficulty));
  }

  /**
   * Calculate overall lesson difficulty
   */
  private calculateLessonDifficulty(vocabularyItems: VocabularyItem[]): number {
    if (vocabularyItems.length === 0) return 1;

    const totalDifficulty = vocabularyItems.reduce((sum, item) => {
      return sum + this.calculateWordDifficulty(item);
    }, 0);

    return Math.round(totalDifficulty / vocabularyItems.length);
  }

  /**
   * Determine lesson category based on vocabulary items
   */
  private determineLessonCategory(vocabularyItems: VocabularyItem[]): string {
    if (vocabularyItems.length === 0) return 'mixed';

    // Count category occurrences
    const categoryCount = new Map<string, number>();
    
    vocabularyItems.forEach(item => {
      const category = this.extractPrimaryCategory(item) || 'uncategorized';
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    });

    // Find the most common category
    let maxCount = 0;
    let dominantCategory = 'mixed';
    
    categoryCount.forEach((count, category) => {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = category;
      }
    });

    // If no single category dominates (>50%), call it mixed
    if (maxCount <= vocabularyItems.length / 2) {
      return 'mixed';
    }

    return dominantCategory;
  }

  /**
   * Generate lesson title based on category and day
   */
  private generateLessonTitle(category: string, dayNumber: number): string {
    const categoryTitles: Record<string, string> = {
      'greetings': 'Greetings & Politeness',
      'numbers': 'Numbers & Counting',
      'colors': 'Colors & Descriptions',
      'family': 'Family & Relationships',
      'food': 'Food & Dining',
      'fruits': 'Fruits & Natural Foods',
      'vegetables': 'Vegetables & Cooking',
      'animals': 'Animals & Nature',
      'body': 'Body Parts & Health',
      'clothing': 'Clothing & Appearance',
      'mixed': 'Mixed Vocabulary',
      'uncategorized': 'Essential Words'
    };

    const categoryTitle = categoryTitles[category] || 'Vocabulary Practice';
    return `Day ${dayNumber}: ${categoryTitle}`;
  }

  /**
   * Generate lesson description
   */
  private generateLessonDescription(category: string, wordCount: number): string {
    const descriptions: Record<string, string> = {
      'greetings': 'Learn essential greetings and polite expressions for daily conversations.',
      'numbers': 'Master numbers and counting for practical communication.',
      'colors': 'Discover colors and descriptive words to express yourself better.',
      'family': 'Build vocabulary around family relationships and social connections.',
      'food': 'Explore food-related vocabulary for dining and cooking conversations.',
      'fruits': 'Learn names of fruits and natural foods for healthy living discussions.',
      'vegetables': 'Master vegetable names and cooking-related vocabulary.',
      'animals': 'Discover animal names and nature-related vocabulary.',
      'body': 'Learn body parts and health-related expressions.',
      'clothing': 'Build vocabulary around clothing and personal appearance.',
      'mixed': 'Practice a variety of vocabulary from different categories.',
      'uncategorized': 'Essential vocabulary for everyday communication.'
    };

    const baseDescription = descriptions[category] || 'Expand your Hindi vocabulary with essential words.';
    return `${baseDescription} This lesson contains ${wordCount} carefully selected words.`;
  }

  /**
   * Estimate lesson completion time
   */
  private estimateLessonDuration(wordCount: number): number {
    // Base time: 1 minute per word for Speed Learn + review
    const baseTime = wordCount * 1;
    
    // Add overhead for navigation and breaks
    const overhead = Math.max(5, wordCount * 0.2);
    
    return Math.round(baseTime + overhead);
  }

  /**
   * Generate unique lesson ID
   */
  private generateLessonId(dayNumber: number): string {
    return `lesson_day_${dayNumber.toString().padStart(3, '0')}_${Date.now()}`;
  }

  /**
   * Create curriculum overview
   */
  createCurriculumOverview(lessons: DailyLesson[]): CurriculumOverview {
    const totalVocabulary = lessons.reduce((sum, lesson) => sum + lesson.vocabularyItems.length, 0);
    const totalDuration = lessons.reduce((sum, lesson) => sum + lesson.estimatedDuration, 0);
    
    // Count lessons by category
    const lessonsByCategory: Record<string, number> = {};
    lessons.forEach(lesson => {
      lessonsByCategory[lesson.category] = (lessonsByCategory[lesson.category] || 0) + 1;
    });

    return {
      totalLessons: lessons.length,
      totalVocabulary,
      estimatedTotalDuration: totalDuration,
      lessonsByCategory,
      averageWordsPerLesson: totalVocabulary / lessons.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Get lesson recommendations based on user progress
   */
  getLessonRecommendations(
    lessons: DailyLesson[], 
    progressData: LessonProgress[], 
    currentTime: number = Date.now()
  ): LessonRecommendation[] {
    const recommendations: LessonRecommendation[] = [];
    
    // Find next lesson in sequence
    const completedLessons = new Set(
      progressData
        .filter(p => p.status === LessonStatus.COMPLETED || p.status === LessonStatus.MASTERED)
        .map(p => p.lessonId)
    );

    // Find the next uncompleted lesson
    const nextLesson = lessons.find(lesson => !completedLessons.has(lesson.id));
    
    if (nextLesson) {
      recommendations.push({
        lesson: nextLesson,
        reason: RecommendationReason.NEXT_IN_SEQUENCE,
        confidence: 0.9,
        estimatedTime: nextLesson.estimatedDuration,
        prerequisitesMet: true
      });
    }

    // Find lessons with items due for review
    const reviewDueLessons = lessons.filter(lesson => {
      const hasReviewDue = lesson.vocabularyItems.some(item => 
        item.srsData.nextReviewDate <= currentTime
      );
      return hasReviewDue && completedLessons.has(lesson.id);
    });

    reviewDueLessons.forEach(lesson => {
      recommendations.push({
        lesson,
        reason: RecommendationReason.REVIEW_DUE,
        confidence: 0.8,
        estimatedTime: Math.ceil(lesson.estimatedDuration * 0.6), // Reviews are typically faster
        prerequisitesMet: true
      });
    });

    // Sort by confidence and return top recommendations
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }



  /**
   * Create HindiEasy curriculum with Chapter 1 - Fruits
   */
  static createHindiEasyFruitsVocabulary(): VocabularyItem[] {
    const fruitsData = [
      ['अंगूर', 'Grapes'],
      ['अंजीर', 'Fig'],
      ['अखरोट', 'Walnut'],
      ['अनन्नास', 'Pineapple'],
      ['अनार', 'Pomegranate'],
      ['अमरूद', 'Guava'],
      ['आड़ू', 'Peach'],
      ['आम', 'Mango'],
      ['आलू बुखारा', 'Plum'],
      ['किशमिश', 'Raisin'],
      ['केला', 'Banana'],
      ['खरबूजा', 'Musk melon'],
      ['खुबानी', 'Apricot'],
      ['चकोतरा', 'Pompelmousse'],
      ['जामुन', 'Rose-apple'],
      ['तरबूज', 'Water melon'],
      ['नारियल', 'Coconut'],
      ['नाशपाती', 'Pear'],
      ['नींबू', 'Lime'],
      ['पपीता', 'Papaya'],
      ['पिस्ता', 'Pistachio-nut'],
      ['फालसा', 'Gronia'],
      ['बादाम', 'Almond'],
      ['बेर', 'Jujube'],
      ['मूंगफली', 'Ground-nut'],
      ['मौसमी', 'Mozambique'],
      ['शरीफा', 'Custard apple'],
      ['शहतूत', 'Mulberry'],
      ['संतरा', 'Orange'],
      ['सेब', 'Apple']
    ];

    // Use a fixed timestamp for consistent IDs
    const fixedTimestamp = 1758133397959; // Fixed timestamp for consistent IDs

    return fruitsData.map((item, index) => ({
      id: `hindieasy_fruits_${index}_${fixedTimestamp}`,
      targetLanguageWord: item[0],
      englishTranslation: item[1],
      tags: ['hindieasy', 'fruits', 'chapter1', 'food', 'natural'],
      srsData: SM2Engine.createInitialSRSData()
    }));
  }

  /**
   * Create complete HindiEasy curriculum
   */
  static async createHindiEasyCurriculum(): Promise<DailyLesson[]> {
    console.log('🍎 Creating HindiEasy curriculum...');

    // Get fruits vocabulary for Chapter 1
    const fruitsVocabulary = this.createHindiEasyFruitsVocabulary();
    console.log(`📚 Loaded ${fruitsVocabulary.length} fruit words for Chapter 1`);

    // Create curriculum manager with optimized settings for HindiEasy
    const curriculumManager = new CurriculumManager({
      wordsPerDay: 6,           // 6 words per day (optimal for focused learning)
      maxWordsPerLesson: 6,     // Exactly 6 words per lesson
      minWordsPerLesson: 6,     // Exactly 6 words per lesson
      preferredLessonDuration: 8 // 8 minutes per lesson (6 words × ~1.3 min each)
    });

    // Generate curriculum for fruits chapter
    const lessons = curriculumManager.generateCurriculum({
      sourceVocabulary: fruitsVocabulary,
      totalDays: Math.ceil(fruitsVocabulary.length / 6), // Auto-calculate days needed
      startDate: new Date(),
      config: await CurriculumStorageManager.getCurriculumConfig(),
      organizationStrategy: OrganizationStrategy.BY_CATEGORY
    });

    console.log(`📅 Generated ${lessons.length} daily lessons for HindiEasy Chapter 1`);

    // Update lesson titles to include chapter info and continuation
    lessons.forEach((lesson, index) => {
      const isContinuation = index > 0;
      lesson.title = isContinuation ? 'Fruits continuation' : 'Fruits';
      lesson.description = isContinuation
        ? `Continue learning fruit names in Hindi (Chapter 1, Day ${index + 1})`
        : `Learn essential fruit names in Hindi (Chapter 1, Day ${index + 1})`;
      lesson.category = 'hindieasy_fruits';
    });

    return lessons;
  }

  /**
   * Legacy method for backward compatibility
   */
  static createFruitsVocabulary(): VocabularyItem[] {
    return this.createHindiEasyFruitsVocabulary();
  }
}
