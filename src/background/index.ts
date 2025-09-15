/**
 * Background service worker for Hindi Language Learner extension
 * Handles initialization, alarms, and notifications
 */

import { VocabularyItem, UserConfig, LearningStats, STORAGE_KEYS } from '@/types';

// Extension installation and initialization
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Hindi Language Learner extension installed/updated');
  
  try {
    // Initialize default configuration
    await initializeDefaultConfig();
    
    // Set up daily review alarm
    await setupDailyReviewAlarm();
    
    // Load initial vocabulary data if none exists
    await initializeVocabulary();
    
    console.log('Extension initialization complete');
  } catch (error) {
    console.error('Error during extension initialization:', error);
  }
});

/**
 * Initialize default user configuration
 */
async function initializeDefaultConfig(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.USER_CONFIG]);
  
  if (!result[STORAGE_KEYS.USER_CONFIG]) {
    const defaultConfig: UserConfig = {
      ttsVoice: 'Google Hindi',
      speechRate: 0.8,
      speechPitch: 1.0,
      notificationsEnabled: true,
      quietHoursStart: 22,
      quietHoursEnd: 8,
      targetLanguage: 'hi-IN',
      newWordRepetitions: 3,
    };
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.USER_CONFIG]: defaultConfig,
    });
    
    console.log('Default configuration initialized');
  }
}

/**
 * Set up daily alarm for review notifications
 */
async function setupDailyReviewAlarm(): Promise<void> {
  // Clear existing alarm
  await chrome.alarms.clear('dailyReviewCheck');
  
  // Create new alarm that fires every day at 9 AM
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(9, 0, 0, 0);
  
  // If 9 AM has passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }
  
  await chrome.alarms.create('dailyReviewCheck', {
    when: scheduledTime.getTime(),
    periodInMinutes: 24 * 60, // Repeat every 24 hours
  });
  
  console.log('Daily review alarm scheduled for:', scheduledTime.toLocaleString());
}

/**
 * Initialize vocabulary with sample data if none exists
 */
async function initializeVocabulary(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.VOCABULARY_DATA]);
  
  if (!result[STORAGE_KEYS.VOCABULARY_DATA] || result[STORAGE_KEYS.VOCABULARY_DATA].length === 0) {
    const sampleVocabulary: VocabularyItem[] = [
      {
        id: '1',
        targetLanguageWord: 'नमस्ते',
        englishTranslation: 'Hello/Goodbye',
        tags: ['greetings', 'basic'],
        srsData: {
          nextReviewDate: Date.now(),
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          lastReviewed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        id: '2',
        targetLanguageWord: 'धन्यवाद',
        englishTranslation: 'Thank you',
        tags: ['gratitude', 'basic'],
        srsData: {
          nextReviewDate: Date.now(),
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          lastReviewed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        id: '3',
        targetLanguageWord: 'कृपया',
        englishTranslation: 'Please',
        tags: ['politeness', 'basic'],
        srsData: {
          nextReviewDate: Date.now(),
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          lastReviewed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    ];
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.VOCABULARY_DATA]: sampleVocabulary,
    });
    
    // Initialize learning stats
    const initialStats: LearningStats = {
      totalItems: sampleVocabulary.length,
      dueToday: sampleVocabulary.length,
      newToday: sampleVocabulary.length,
      reviewedToday: 0,
      accuracyRate: 0,
      streak: 0,
      totalReviews: 0,
    };
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.LEARNING_STATS]: initialStats,
    });
    
    console.log('Sample vocabulary initialized');
  }
}

/**
 * Handle daily review alarm
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReviewCheck') {
    console.log('Daily review check triggered');
    await checkAndNotifyDueReviews();
  }
});

/**
 * Check for due reviews and send notification if needed
 */
async function checkAndNotifyDueReviews(): Promise<void> {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.VOCABULARY_DATA,
      STORAGE_KEYS.USER_CONFIG,
    ]);
    
    const vocabulary: VocabularyItem[] = result[STORAGE_KEYS.VOCABULARY_DATA] || [];
    const config: UserConfig = result[STORAGE_KEYS.USER_CONFIG];
    
    if (!config?.notificationsEnabled) {
      console.log('Notifications are disabled');
      return;
    }
    
    // Check if we're in quiet hours
    const now = new Date();
    const currentHour = now.getHours();
    
    if (config.quietHoursStart <= config.quietHoursEnd) {
      // Normal case: quiet hours don't cross midnight
      if (currentHour >= config.quietHoursStart && currentHour < config.quietHoursEnd) {
        console.log('In quiet hours, skipping notification');
        return;
      }
    } else {
      // Special case: quiet hours cross midnight (e.g., 22:00 to 8:00)
      if (currentHour >= config.quietHoursStart || currentHour < config.quietHoursEnd) {
        console.log('In quiet hours, skipping notification');
        return;
      }
    }
    
    // Count due items
    const dueItems = vocabulary.filter(item => item.srsData.nextReviewDate <= Date.now());
    
    if (dueItems.length > 0) {
      await sendReviewNotification(dueItems.length);
    } else {
      console.log('No reviews due today');
    }
  } catch (error) {
    console.error('Error checking due reviews:', error);
  }
}

/**
 * Send notification about due reviews
 */
async function sendReviewNotification(dueCount: number): Promise<void> {
  const notificationOptions = {
    type: 'basic' as const,
    iconUrl: 'assets/icon-128.png',
    title: 'Hindi Learning Time! 📚',
    message: `You have ${dueCount} word${dueCount > 1 ? 's' : ''} to review. Keep up your learning streak!`,
    buttons: [
      { title: 'Start Review' },
      { title: 'Later' },
    ],
  };
  
  const notificationId = await chrome.notifications.create('reviewReminder', notificationOptions);
  console.log('Review notification sent:', notificationId);
}

/**
 * Handle notification clicks
 */
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId === 'reviewReminder') {
    // Open the extension popup (this will show the review interface)
    await chrome.action.openPopup();
    await chrome.notifications.clear(notificationId);
  }
});

/**
 * Handle notification button clicks
 */
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId === 'reviewReminder') {
    if (buttonIndex === 0) {
      // "Start Review" button
      await chrome.action.openPopup();
    }
    // For "Later" button (index 1), just clear the notification
    await chrome.notifications.clear(notificationId);
  }
});

// Export functions for testing (only in test environment)
// Functions are exported through ES modules when needed
