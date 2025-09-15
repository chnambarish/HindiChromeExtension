# Testing Guide - Auto-Review System

## 🎯 **Auto-Review System Testing**

Your requested auto-review system is now fully implemented! Here's how to test it:

### **Immediate Testing (Chrome Extensions Page)**

1. **Reload Extension:**
   - Go to `chrome://extensions/`
   - Find "Hindi Language Learner" 
   - Click the reload button (↻)

2. **Check Background Script:**
   - Click "Details" on your extension
   - Click "Inspect views: service worker"
   - Look for console messages like:
     ```
     Daily review alarm scheduled for 9:00 AM daily
     Extension initialization complete
     ```

### **Configuration Testing**

3. **Open Options Page:**
   - Right-click extension icon → "Options"
   - OR go to Settings tab in the extension

4. **Configure Review Settings:**
   - ✅ Enable "Daily Review Reminders"
   - Set "Daily Review Time" (try different times)
   - Set "Quiet Hours" (e.g., 10 PM to 8 AM)
   - Watch console for "Review alarm rescheduled"

### **Quick Notification Test**

5. **Test Immediate Notification** (for development):
   - In service worker console, run:
     ```javascript
     chrome.alarms.create('testAlarm', { when: Date.now() + 5000 }); // 5 seconds
     chrome.alarms.onAlarm.addListener((alarm) => {
       if (alarm.name === 'testAlarm') checkAndNotifyDueReviews();
     });
     ```

### **Real-World Testing**

6. **Set Review Time Soon:**
   - Set review time to 2-3 minutes from now
   - Wait for notification to appear
   - Click "Start Review" button
   - Test "Later" button (reschedules for 2 hours)

### **Vocabulary Testing**

7. **Add Test Vocabulary:**
   - Options → Vocabulary tab
   - Add some Hindi words
   - These will be available for review

8. **Review Process:**
   - Click extension icon to open popup
   - Review vocabulary with quality ratings
   - Check that reviews are processed correctly

---

## 🔧 **Development Testing Commands**

### **In Service Worker Console:**
```javascript
// Force immediate review check
checkAndNotifyDueReviews();

// Check current alarms
chrome.alarms.getAll().then(alarms => console.log('Active alarms:', alarms));

// Clear all alarms
chrome.alarms.clearAll();

// Manual notification test
chrome.notifications.create('test', {
  type: 'basic',
  iconUrl: 'assets/icon-128.png',
  title: 'Test Notification',
  message: '3 Hindi words ready for review!'
});
```

### **Check Storage:**
```javascript
// Check if vocabulary exists
chrome.storage.local.get('vocabulary').then(result => 
  console.log('Vocabulary:', result.vocabulary)
);

// Check user config
chrome.storage.sync.get('userConfig').then(result => 
  console.log('Config:', result.userConfig)
);
```

---

## ✅ **Expected Results:**

1. **Daily alarms scheduled** at your chosen time
2. **Notifications appear** when vocabulary is due
3. **Settings changes** reschedule alarms immediately
4. **Quiet hours respected** - no notifications during those times
5. **Interactive notifications** - buttons work correctly
6. **Vocabulary reviews** process and update SRS data
7. **Statistics update** after reviews

---

## 🚨 **Troubleshooting:**

- **No notifications?** Check if Chrome notifications are enabled for the extension
- **Alarms not working?** Ensure Chrome has permission to run in background
- **Console errors?** Check service worker console for detailed error messages
- **Settings not saving?** Check if sync storage permissions are granted

---

**The auto-review system is now complete and ready for daily use!** 🎉