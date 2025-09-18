/**
 * Daily Curriculum Management Types
 * 
 * Defines interfaces for organizing vocabulary content into structured daily lessons
 */

import { VocabularyItem } from './vocabulary';

/**
 * Represents a single daily lesson with vocabulary items
 */
export interface DailyLesson {
  /** Unique identifier for the lesson */
  id: string;
  
  /** Day number in the curriculum (1-based) */
  dayNumber: number;
  
  /** Lesson title/theme */
  title: string;
  
  /** Brief description of the lesson content */
  description?: string;
  
  /** Category/theme of the lesson (e.g., 'fruits', 'greetings', 'colors') */
  category: string;
  
  /** Vocabulary items for this lesson */
  vocabularyItems: VocabularyItem[];
  
  /** Target number of words for this lesson */
  targetWordCount: number;
  
  /** Estimated completion time in minutes */
  estimatedDuration: number;
  
  /** Prerequisites (other lesson IDs that should be completed first) */
  prerequisites?: string[];
  
  /** Difficulty level (1-5) */
  difficultyLevel: number;
  
  /** When this lesson was created */
  createdAt: number;
  
  /** When this lesson was last updated */
  updatedAt: number;
}

/**
 * User's progress on a specific lesson
 */
export interface LessonProgress {
  /** Lesson ID */
  lessonId: string;
  
  /** User ID (for multi-user support in future) */
  userId?: string;
  
  /** Current status of the lesson */
  status: LessonStatus;
  
  /** When the lesson was started */
  startedAt?: number;
  
  /** When the lesson was completed */
  completedAt?: number;
  
  /** Number of words mastered in this lesson */
  wordsCompleted: number;
  
  /** Total words in the lesson */
  totalWords: number;
  
  /** Time spent on this lesson (milliseconds) */
  timeSpent: number;
  
  /** Number of Speed Learn sessions completed for this lesson */
  speedLearnSessions: number;
  
  /** Number of review sessions completed for this lesson */
  reviewSessions: number;
  
  /** Overall accuracy for this lesson (0-1) */
  accuracy: number;
  
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Lesson completion status
 */
export enum LessonStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  MASTERED = 'mastered'
}

/**
 * Curriculum configuration and settings
 */
export interface CurriculumConfig {
  /** Target words per day */
  wordsPerDay: number;
  
  /** Maximum words per lesson */
  maxWordsPerLesson: number;
  
  /** Minimum words per lesson */
  minWordsPerLesson: number;
  
  /** Auto-advance to next lesson when current is completed */
  autoAdvance: boolean;
  
  /** Require mastery of previous lesson before unlocking next */
  requireSequentialCompletion: boolean;
  
  /** Preferred lesson categories in order of priority */
  preferredCategories: string[];
  
  /** Skip weekends in lesson scheduling */
  skipWeekends: boolean;
  
  /** Custom lesson duration preferences */
  preferredLessonDuration: number; // minutes
}

/**
 * Curriculum generation options
 */
export interface CurriculumGenerationOptions {
  /** Source vocabulary to organize into lessons */
  sourceVocabulary: VocabularyItem[];
  
  /** Number of days to create lessons for */
  totalDays: number;
  
  /** Starting date for the curriculum */
  startDate: Date;
  
  /** Curriculum configuration */
  config: CurriculumConfig;
  
  /** Existing lessons to preserve/update */
  existingLessons?: DailyLesson[];
  
  /** Strategy for organizing content */
  organizationStrategy: OrganizationStrategy;
}

/**
 * Strategies for organizing vocabulary into lessons
 */
export enum OrganizationStrategy {
  /** Group by semantic categories (fruits, colors, etc.) */
  BY_CATEGORY = 'by_category',
  
  /** Distribute by difficulty level */
  BY_DIFFICULTY = 'by_difficulty',
  
  /** Mix categories for variety */
  MIXED_CATEGORIES = 'mixed_categories',
  
  /** Frequency-based (common words first) */
  BY_FREQUENCY = 'by_frequency',
  
  /** Custom user-defined order */
  CUSTOM_ORDER = 'custom_order'
}

/**
 * Daily curriculum overview
 */
export interface CurriculumOverview {
  /** Total number of lessons */
  totalLessons: number;
  
  /** Total vocabulary items across all lessons */
  totalVocabulary: number;
  
  /** Estimated total completion time */
  estimatedTotalDuration: number;
  
  /** Lessons by category */
  lessonsByCategory: Record<string, number>;
  
  /** Average words per lesson */
  averageWordsPerLesson: number;
  
  /** Curriculum creation date */
  createdAt: number;
  
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Lesson recommendation based on user progress
 */
export interface LessonRecommendation {
  /** Recommended lesson */
  lesson: DailyLesson;
  
  /** Reason for recommendation */
  reason: RecommendationReason;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Estimated time to complete */
  estimatedTime: number;
  
  /** Prerequisites status */
  prerequisitesMet: boolean;
}

/**
 * Reasons for lesson recommendations
 */
export enum RecommendationReason {
  NEXT_IN_SEQUENCE = 'next_in_sequence',
  REVIEW_DUE = 'review_due',
  CATEGORY_CONTINUATION = 'category_continuation',
  DIFFICULTY_APPROPRIATE = 'difficulty_appropriate',
  TIME_AVAILABLE = 'time_available',
  USER_PREFERENCE = 'user_preference'
}

/**
 * Lesson analytics and insights
 */
export interface LessonAnalytics {
  /** Lesson ID */
  lessonId: string;
  
  /** Completion rate across all users */
  completionRate: number;
  
  /** Average time to complete */
  averageCompletionTime: number;
  
  /** Most challenging words in the lesson */
  challengingWords: string[];
  
  /** Success rate for each word */
  wordSuccessRates: Record<string, number>;
  
  /** Common mistakes or patterns */
  commonMistakes: string[];
  
  /** User feedback/ratings */
  averageRating?: number;
  
  /** Number of users who completed this lesson */
  completionCount: number;
}
