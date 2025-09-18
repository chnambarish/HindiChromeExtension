/**
 * HindiEasy Curriculum System
 *
 * Provides automatic curriculum management for Hindi language learning
 * with integrated Speed Learn functionality.
 */

import { CurriculumManager } from './curriculum-manager';
import { CurriculumStorageManager } from './curriculum-storage';
import { VocabularyItem } from '../types/vocabulary';
import { StorageManager } from './storage';

/**
 * Initialize HindiEasy curriculum with fruits data
 * Call this once to set up the curriculum for users
 */
export async function initializeHindiEasyCurriculum(): Promise<void> {
  try {
    console.log('🍎 Initializing HindiEasy curriculum...');

    // Create the curriculum
    const lessons = await CurriculumManager.createHindiEasyCurriculum();

    // Save to storage
    await CurriculumStorageManager.setDailyLessons(lessons);

    // Create and save curriculum overview
    const overview = new CurriculumManager().createCurriculumOverview(lessons);
    await CurriculumStorageManager.setCurriculumOverview(overview);

    // Initialize progress for each lesson
    for (const lesson of lessons) {
      await CurriculumStorageManager.initializeLessonProgress(
        lesson.id,
        lesson.vocabularyItems.length
      );
    }

    // IMPORTANT: Also store vocabulary items in main storage for SpeedLearnEngine
    console.log('📝 Storing vocabulary items in main storage...');
    await StorageManager.initialize();

    // Collect all unique vocabulary items from lessons
    const allVocabularyItems = new Map<string, VocabularyItem>();
    lessons.forEach(lesson => {
      lesson.vocabularyItems.forEach(item => {
        if (!allVocabularyItems.has(item.id)) {
          allVocabularyItems.set(item.id, item);
        }
      });
    });

    // Get existing vocabulary to check for duplicates
    const existingVocabulary = await StorageManager.getVocabulary();
    const existingIds = new Set(existingVocabulary.map(item => item.id));

    // Store each vocabulary item in main storage
    for (const item of allVocabularyItems.values()) {
      try {
        if (existingIds.has(item.id)) {
          // Update existing item
          await StorageManager.updateVocabularyItem(item);
          console.log(`Updated existing vocabulary item: ${item.id}`);
        } else {
          // Add as new item with the original ID preserved
          const vocabulary = await StorageManager.getVocabulary();
          vocabulary.push(item);
          await StorageManager.setVocabulary(vocabulary);
          console.log(`Added new vocabulary item: ${item.id}`);
        }
      } catch (error) {
        console.warn(`Could not store vocabulary item ${item.id}:`, error);
      }
    }

    console.log(`✅ Stored ${allVocabularyItems.size} vocabulary items in main storage`);
    console.log('✅ HindiEasy curriculum initialized successfully!');
    console.log(`� Created ${lessons.length} lessons with ${overview.totalVocabulary} fruit words`);
    console.log('🎯 Users can now start Speed Learn and get automatic curriculum lessons');

  } catch (error) {
    console.error('❌ Failed to initialize HindiEasy curriculum:', error);
    throw error;
  }
}

// Make it available globally for easy access
(window as any).initializeHindiEasyCurriculum = initializeHindiEasyCurriculum;
