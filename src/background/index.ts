/**
 * Background service worker for Hindi Language Learner extension
 * Handles initialization, alarms, and notifications
 */

import { VocabularyItem, UserConfig, LearningStats, STORAGE_KEYS } from '@/types';
import { StorageManager, StorageEventManager } from '@/utils/storage';
import { SM2Engine } from '@/utils/srs-engine';

// Extension installation and initialization
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Hindi Language Learner extension installed/updated:', details.reason);
  
  try {
    // Initialize storage using StorageManager
    await StorageManager.initialize();
    console.log('Storage initialized successfully');
    
    // Initialize storage event manager for cross-tab sync
    StorageEventManager.initialize();
    
    // Set up daily review alarm
    await setupDailyReviewAlarm();
    
    // Create initial backup for new installations
    if (details.reason === 'install') {
      await StorageManager.createBackup();
      console.log('Initial backup created');
    }
    
    console.log('Extension initialization complete');
  } catch (error) {
    console.error('Error during extension initialization:', error);
  }
});


/**
 * Set up daily alarm for review notifications
 */
async function setupDailyReviewAlarm(): Promise<void> {
  try {
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
  } catch (error) {
    console.error('Error setting up daily alarm:', error);
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
    // Get user configuration
    const config = await StorageManager.getUserConfig();
    
    if (!config.notificationsEnabled) {
      console.log('Notifications are disabled');
      return;
    }
    
    // Check if we're in quiet hours
    const now = new Date();
    const currentHour = now.getHours();
    
    if (isQuietHours(currentHour, config.quietHoursStart, config.quietHoursEnd)) {
      console.log('Currently in quiet hours, skipping notification');
      return;
    }
    
    // Get due items using StorageManager and SRS engine
    const dueItems = await StorageManager.getDueVocabulary();
    const newItems = await StorageManager.getNewVocabulary();
    
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
async function sendReviewNotification(totalCount: number, dueCount: number, newCount: number): Promise<void> {
  let message: string;
  
  if (newCount > 0 && dueCount > 0) {
    message = `${dueCount} reviews + ${newCount} new words ready! Keep up your learning streak! 🎆`;
  } else if (newCount > 0) {
    message = `${newCount} new word${newCount > 1 ? 's' : ''} ready to learn! 🌱`;
  } else {
    message = `${dueCount} word${dueCount > 1 ? 's' : ''} ready for review! 💪`;
  }
  
  const notificationOptions = {
    type: 'basic' as const,
    iconUrl: 'assets/icon-128.png',
    title: 'Hindi Learning Time! 📚',
    message,
    buttons: [
      { title: 'Start Review' },
      { title: 'Later' },
    ],
  };
  
  try {
    const notificationId = await chrome.notifications.create('reviewReminder', notificationOptions);
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
      
      // Try to open popup, fallback to creating a popup window
      try {
        await chrome.action.openPopup();
      } catch (popupError) {
        // If popup fails, open in a new popup window
        chrome.windows.create({
          url: chrome.runtime.getURL('popup/popup.html'),
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
            url: chrome.runtime.getURL('popup/popup.html'),
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
function isQuietHours(currentHour: number, startHour: number, endHour: number): boolean {
  if (startHour <= endHour) {
    // Quiet hours within the same day (e.g., 14:00 - 16:00)
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Quiet hours span midnight (e.g., 22:00 - 08:00)
    return currentHour >= startHour || currentHour < endHour;
  }
}

// Handle later reminder alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'laterReminder') {
    console.log('Later reminder triggered');
    await checkAndNotifyDueReviews();
  }
});

// Export functions for testing (only in test environment)
// Functions are exported through ES modules when needed
