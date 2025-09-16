# 🔧 Speed Learn Session Fix Guide

## 🚨 **Issue**: "Failed to start session. Make sure you have vocabulary items added."

This error occurs because existing vocabulary items don't have the new Speed Learn fields required for the feature to work.

---

## ✅ **Quick Fix Options:**

### **Option 1: Use the Migration Button (Recommended)**
1. **Reload the extension** in Chrome (chrome://extensions/ → reload button)
2. **Open the popup** → **Speed Learn tab**
3. **Click the "🔄 Migrate Vocabulary for Speed Learn" button**
4. **Wait for success message**: "Vocabulary migrated successfully!"
5. **Try starting a Speed Learn session** again

### **Option 2: Automatic Migration (If Option 1 doesn't work)**
1. **Open Chrome DevTools** (F12)
2. **Go to Console tab**
3. **Run this command**:
```javascript
chrome.storage.local.get('vocabulary', (result) => {
  const vocabulary = result.vocabulary || [];
  const migrated = vocabulary.map(item => ({
    ...item,
    srsData: {
      ...item.srsData,
      speedLearnStage: 'new',
      exposureCount: 0,
      updatedAt: Date.now()
    }
  }));
  chrome.storage.local.set({vocabulary: migrated}, () => {
    console.log('Vocabulary migrated!');
  });
});
```
4. **Reload the extension**
5. **Try Speed Learn again**

### **Option 3: Add New Vocabulary (Alternative)**
1. **Go to Options page** (⚙️ button)
2. **Add some new vocabulary items**
3. **These will automatically have Speed Learn fields**
4. **Try Speed Learn session**

---

## 🎯 **What the Migration Does:**

The migration adds these required fields to each vocabulary item:
- `speedLearnStage`: 'new' (ready for Speed Learn)
- `exposureCount`: 0 (tracks how many times heard)

After migration, your vocabulary will work perfectly with:
- ✅ Speed Learn auto-play sessions
- ✅ Progress tracking and exposure counting
- ✅ Automatic quiz system after 5 exposures
- ✅ Integration with existing spaced repetition

---

## 📱 **After Migration Success:**

1. **Start a Speed Learn session** - should work immediately
2. **Configure settings** using the sliders (repetitions, speed, etc.)
3. **Enjoy the auto-play experience**: Hindi → English → Next word
4. **Watch for quiz notifications** after 5+ exposures per word

---

## 🔍 **Troubleshooting:**

**If migration still doesn't work:**
1. Check **Chrome console** for error messages
2. Verify you have **vocabulary items** in storage
3. Try **reloading the extension** completely
4. Check that **TTS is enabled** in your browser

**The updated extension with the migration fix is now ready!** 🚀

Simply reload the extension and use the migration button - your Speed Learn will be working in seconds! 🎯