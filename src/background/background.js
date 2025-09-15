/**
 * Background service worker for Hindi Language Learner extension
 * Plain JavaScript version for Chrome service worker compatibility
 */

// Storage keys
const STORAGE_KEYS = {
  VOCABULARY: 'vocabulary',
  USER_CONFIG: 'userConfig',
  REVIEW_HISTORY: 'reviewHistory',
  LEARNING_STATS: 'learningStats',
  LAST_BACKUP: 'lastBackup',
  INSTALLATION_DATE: 'installationDate',
  VERSION: 'version',
};

// Default user configuration
const DEFAULT_CONFIG = {
  ttsVoice: 'default',
  speechRate: 1.0,
  speechPitch: 1.0,
  notificationsEnabled: true,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  targetLanguage: 'hi-IN',
  newWordRepetitions: 3,
  dailyReviewTime: 9,
  reviewRemindersEnabled: true,
};

// Extension installation and initialization
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Hindi Language Learner extension installed/updated:', details.reason);
  
  try {
    // Initialize storage
    await initializeStorage();
    console.log('Storage initialized successfully');
    
    // Set up daily review alarm
    await setupDailyReviewAlarm();
    
    console.log('Extension initialization complete');
  } catch (error) {
    console.error('Error during extension initialization:', error);
  }
});

/**
 * Initialize storage for first-time installations
 */
async function initializeStorage() {
  try {
    // Check if user config exists
    const result = await chrome.storage.sync.get(STORAGE_KEYS.USER_CONFIG);
    if (!result[STORAGE_KEYS.USER_CONFIG]) {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.USER_CONFIG]: DEFAULT_CONFIG
      });
    }
    
    // Initialize vocabulary if empty
    const vocabResult = await chrome.storage.local.get(STORAGE_KEYS.VOCABULARY);
    if (!vocabResult[STORAGE_KEYS.VOCABULARY] || vocabResult[STORAGE_KEYS.VOCABULARY].length === 0) {
      const defaultVocab = [
        {
          id: 'default-1',
          targetLanguageWord: 'नमस्ते',
          englishTranslation: 'hello/goodbye',
          tags: ['greeting', 'common'],
          srsData: createInitialSRSData(),
        },
        {
          id: 'default-2',
          targetLanguageWord: 'धन्यवाद',
          englishTranslation: 'thank you',
          tags: ['gratitude', 'common'],
          srsData: createInitialSRSData(),
        },
        {
          id: 'default-3',
          targetLanguageWord: 'माफ़ करें',
          englishTranslation: 'excuse me/sorry',
          tags: ['apology', 'common'],
          srsData: createInitialSRSData(),
        }
      ];
      
      await chrome.storage.local.set({
        [STORAGE_KEYS.VOCABULARY]: defaultVocab
      });
    }
    
    // Initialize review history
    const historyResult = await chrome.storage.local.get(STORAGE_KEYS.REVIEW_HISTORY);
    if (!historyResult[STORAGE_KEYS.REVIEW_HISTORY]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.REVIEW_HISTORY]: []
      });
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

/**
 * Create initial SRS data for new vocabulary items
 */
function createInitialSRSData() {
  const now = Date.now();
  return {
    nextReviewDate: now + 60000, // 1 minute from now for immediate review
    interval: 1,
    repetitions: 0,
    easeFactor: 2.5,
    lastReviewed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Set up daily alarm for review notifications
 */
async function setupDailyReviewAlarm() {
  try {
    // Clear existing alarm
    await chrome.alarms.clear('dailyReviewCheck');
    
    // Get user's preferred review time
    const result = await chrome.storage.sync.get(STORAGE_KEYS.USER_CONFIG);
    const config = result[STORAGE_KEYS.USER_CONFIG] || DEFAULT_CONFIG;
    
    if (!config.reviewRemindersEnabled) {
      console.log('Review reminders are disabled');
      return;
    }
    
    // Create new alarm that fires every day at user's preferred time
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(config.dailyReviewTime, 0, 0, 0);
    
    // If the review time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    await chrome.alarms.create('dailyReviewCheck', {
      when: scheduledTime.getTime(),
      periodInMinutes: 24 * 60, // Repeat every 24 hours
    });
    
    const timeString = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    console.log(`Daily review alarm scheduled for ${timeString} daily`);
  } catch (error) {
    console.error('Error setting up daily alarm:', error);
  }
}

/**
 * Reschedule daily review alarm
 */
async function rescheduleReviewAlarm() {
  console.log('Rescheduling review alarm based on updated settings');
  await setupDailyReviewAlarm();
}

/**
 * Handle daily review alarm
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReviewCheck') {
    console.log('Daily review check triggered');
    await checkAndNotifyDueReviews();
  } else if (alarm.name === 'laterReminder') {
    console.log('Later reminder triggered');
    await checkAndNotifyDueReviews();
  }
});

/**
 * Check for due reviews and send notification if needed
 */
async function checkAndNotifyDueReviews() {
  try {
    // Get user configuration
    const configResult = await chrome.storage.sync.get(STORAGE_KEYS.USER_CONFIG);
    const config = configResult[STORAGE_KEYS.USER_CONFIG] || DEFAULT_CONFIG;
    
    if (!config.notificationsEnabled || !config.reviewRemindersEnabled) {
      console.log('Notifications or review reminders are disabled');
      return;
    }
    
    // Check if we're in quiet hours
    const now = new Date();
    const currentHour = now.getHours();
    
    if (isQuietHours(currentHour, config.quietHoursStart, config.quietHoursEnd)) {
      console.log('Currently in quiet hours, skipping notification');
      return;
    }
    
    // Get due items
    const vocabResult = await chrome.storage.local.get(STORAGE_KEYS.VOCABULARY);
    const vocabulary = vocabResult[STORAGE_KEYS.VOCABULARY] || [];
    
    const currentTime = Date.now();
    const dueItems = vocabulary.filter(item => 
      item.srsData && item.srsData.nextReviewDate <= currentTime
    );
    
    const newItems = vocabulary.filter(item => 
      item.srsData && item.srsData.repetitions === 0
    );
    
    // Limit new items to avoid overwhelming the user
    const todayNewItems = Math.min(newItems.length, 5);
    const totalDueItems = dueItems.length + todayNewItems;
    
    if (totalDueItems > 0) {
      await sendReviewNotification(totalDueItems, dueItems.length, todayNewItems);
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
async function sendReviewNotification(totalCount, dueCount, newCount) {
  let message;
  
  if (newCount > 0 && dueCount > 0) {
    message = `${dueCount} reviews + ${newCount} new words ready! Keep up your learning streak! 🎆`;
  } else if (newCount > 0) {
    message = `${newCount} new word${newCount > 1 ? 's' : ''} ready to learn! 🌱`;
  } else {
    message = `${dueCount} word${dueCount > 1 ? 's' : ''} ready for review! 💪`;
  }
  
  const notificationOptions = {
    type: 'basic',
    iconUrl: 'assets/icon-128.png',
    title: 'Hindi Learning Time! 📚',
    message,
    buttons: [
      { title: 'Start Review' },
      { title: 'Later' },
    ],
  };
  
  try {
    await chrome.notifications.create('reviewReminder', notificationOptions);
    console.log(`Review notification sent: ${dueCount} due, ${newCount} new items`);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Handle notification clicks
 */
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId === 'reviewReminder') {
    try {
      // Clear the notification
      await chrome.notifications.clear(notificationId);
      
      // Try to open popup
      try {
        await chrome.action.openPopup();
      } catch (popupError) {
        // Fallback to popup window
        chrome.windows.create({
          url: chrome.runtime.getURL('src/popup/popup.html'),
          type: 'popup',
          width: 400,
          height: 600,
          focused: true,
        });
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  }
});

/**
 * Handle notification button clicks
 */
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId === 'reviewReminder') {
    try {
      if (buttonIndex === 0) {
        // "Start Review" button
        try {
          await chrome.action.openPopup();
        } catch (popupError) {
          // Fallback to popup window
          chrome.windows.create({
            url: chrome.runtime.getURL('src/popup/popup.html'),
            type: 'popup',
            width: 400,
            height: 600,
            focused: true,
          });
        }
      } else if (buttonIndex === 1) {
        // "Later" button - set a reminder for 2 hours
        chrome.alarms.create('laterReminder', {
          when: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
        });
        console.log('Later reminder set for 2 hours');
      }
      
      // Clear the notification
      await chrome.notifications.clear(notificationId);
    } catch (error) {
      console.log('Error handling notification button click:', error);
    }
  }
});

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(currentHour, startHour, endHour) {
  if (startHour <= endHour) {
    // Quiet hours within the same day (e.g., 14:00 - 16:00)
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Quiet hours span midnight (e.g., 22:00 - 08:00)
    return currentHour >= startHour || currentHour < endHour;
  }
}

/**
 * Handle messages from options page
 */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'RESCHEDULE_REVIEW_ALARM') {
    try {
      await rescheduleReviewAlarm();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error rescheduling alarm:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    return true; // Keep the message channel open for async response
  }
});

console.log('Background script loaded successfully');