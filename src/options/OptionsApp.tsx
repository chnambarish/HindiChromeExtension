import React, { useState, useEffect } from 'react';
import { UserConfig, LearningStats, VocabularyItem } from '@/types';
import { StorageManager } from '@/utils/storage';

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vocabulary' | 'settings' | 'stats'>('vocabulary');
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState({ 
    targetLanguageWord: '', 
    englishTranslation: '', 
    tags: '' 
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Initialize storage if needed
      await StorageManager.initialize();
      
      // Load real data from storage
      const [userConfig, learningStats, vocabularyItems] = await Promise.all([
        StorageManager.getUserConfig(),
        StorageManager.getLearningStats(),
        StorageManager.getVocabulary(),
      ]);
      
      setConfig(userConfig);
      setStats(learningStats);
      setVocabulary(vocabularyItems);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportVocabulary = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      let result;
      if (Array.isArray(importedData)) {
        // Direct vocabulary array import
        result = await StorageManager.importVocabulary(importedData, {
          allowDuplicates: false,
          skipInvalid: true,
        });
        alert(`Successfully imported ${result.imported} vocabulary items. Skipped ${result.skipped} duplicates/invalid items.`);
      } else {
        // Full data import
        result = await StorageManager.importFullData(text, {
          replaceExisting: false,
          skipInvalid: true,
        });
        alert(result.summary);
      }
      
      // Reload data to reflect changes
      await loadData();
    } catch (error) {
      console.error('Failed to import vocabulary:', error);
      alert(`Failed to import vocabulary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Reset the input
    event.target.value = '';
  };

  const handleExportVocabulary = async () => {
    try {
      const exportData = await StorageManager.exportData();
      const dataBlob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `hindi_vocabulary_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export vocabulary:', error);
      alert(`Failed to export vocabulary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddVocabulary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.targetLanguageWord.trim() || !newWord.englishTranslation.trim()) {
      alert('Please fill in both Hindi word and English translation.');
      return;
    }

    try {
      const vocabularyItem = {
        targetLanguageWord: newWord.targetLanguageWord.trim(),
        englishTranslation: newWord.englishTranslation.trim(),
        tags: newWord.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        pronunciationAudioUrl: '',
      };

      await StorageManager.addVocabularyItem(vocabularyItem);
      
      // Reset form and hide it
      setNewWord({ targetLanguageWord: '', englishTranslation: '', tags: '' });
      setShowAddForm(false);
      
      // Reload data
      await loadData();
      
      alert('Vocabulary item added successfully!');
    } catch (error) {
      console.error('Failed to add vocabulary item:', error);
      alert(`Failed to add vocabulary item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteVocabulary = async (itemId: string, word: string) => {
    if (!confirm(`Are you sure you want to delete "${word}"?`)) {
      return;
    }

    try {
      await StorageManager.deleteVocabularyItem(itemId);
      await loadData();
      alert('Vocabulary item deleted successfully!');
    } catch (error) {
      console.error('Failed to delete vocabulary item:', error);
      alert(`Failed to delete vocabulary item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleConfigChange = async (updates: Partial<UserConfig>) => {
    if (!config) return;

    try {
      const updatedConfig = { ...config, ...updates };
      await StorageManager.setUserConfig(updatedConfig);
      setConfig(updatedConfig);
      
      // If review settings changed, reschedule alarms
      if ('dailyReviewTime' in updates || 'reviewRemindersEnabled' in updates) {
        // Send message to background script to reschedule
        try {
          await chrome.runtime.sendMessage({
            type: 'RESCHEDULE_REVIEW_ALARM'
          });
          console.log('Review alarm rescheduled');
        } catch (error) {
          console.warn('Could not reschedule alarm:', error);
        }
      }
    } catch (error) {
      console.error('Failed to update config:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="options-container loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>📚 Hindi Language Learner</h1>
        <p>Manage your vocabulary and settings</p>
      </header>

      <nav className="options-nav">
        <button
          className={`nav-btn ${activeTab === 'vocabulary' ? 'active' : ''}`}
          onClick={() => setActiveTab('vocabulary')}
        >
          📝 Vocabulary
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
        <button
          className={`nav-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
      </nav>

      <main className="options-content">
        {activeTab === 'vocabulary' && (
          <div className="vocabulary-section">
            <div className="section-header">
              <h2>Vocabulary Management</h2>
              <div className="vocabulary-actions">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportVocabulary}
                  style={{ display: 'none' }}
                  id="import-input"
                />
                <label htmlFor="import-input" className="btn btn-secondary">
                  📁 Import JSON
                </label>
                <button className="btn btn-primary" onClick={handleExportVocabulary}>
                  💾 Export
                </button>
              </div>
            </div>

            <div className="vocabulary-stats">
              <div className="stat-card">
                <span className="stat-number">{vocabulary.length}</span>
                <span className="stat-label">Total Words</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats?.dueToday || 0}</span>
                <span className="stat-label">Due Today</span>
              </div>
            </div>

            <div className="vocabulary-list">
              <div className="vocabulary-header">
                <span>Hindi</span>
                <span>English</span>
                <span>Next Review</span>
                <span>Actions</span>
              </div>
              {vocabulary.map((item) => (
                <div key={item.id} className="vocabulary-item">
                  <span className="hindi-word">{item.targetLanguageWord}</span>
                  <span className="english-word">{item.englishTranslation}</span>
                  <span className="next-review">
                    {new Date(item.srsData.nextReviewDate).toLocaleDateString()}
                  </span>
                  <div className="item-actions">
                    <button className="btn-small">✏️</button>
                    <button className="btn-small">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && config && (
          <div className="settings-section">
            <h2>Settings</h2>
            
            <div className="setting-group">
              <h3>🔊 Text-to-Speech</h3>
              <div className="setting-item">
                <label htmlFor="tts-voice">Voice:</label>
                <select id="tts-voice" value={config.ttsVoice}>
                  <option value="Google Hindi">Google Hindi</option>
                  <option value="Microsoft Hindi">Microsoft Hindi</option>
                </select>
              </div>
              <div className="setting-item">
                <label htmlFor="speech-rate">Speech Rate:</label>
                <input
                  type="range"
                  id="speech-rate"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={config.speechRate}
                />
                <span>{config.speechRate}x</span>
              </div>
            </div>

            <div className="setting-group">
              <h3>🔔 Notifications & Reviews</h3>
              <div className="setting-item">
                <label htmlFor="notifications">Enable Notifications:</label>
                <input
                  type="checkbox"
                  id="notifications"
                  checked={config.notificationsEnabled}
                  onChange={(e) => handleConfigChange({ notificationsEnabled: e.target.checked })}
                />
              </div>
              <div className="setting-item">
                <label htmlFor="review-reminders">Daily Review Reminders:</label>
                <input
                  type="checkbox"
                  id="review-reminders"
                  checked={config.reviewRemindersEnabled}
                  onChange={(e) => handleConfigChange({ reviewRemindersEnabled: e.target.checked })}
                />
              </div>
              <div className="setting-item">
                <label htmlFor="review-time">Daily Review Time:</label>
                <input
                  type="time"
                  id="review-time"
                  value={`${config.dailyReviewTime.toString().padStart(2, '0')}:00`}
                  onChange={(e) => {
                    const hour = parseInt(e.target.value.split(':')[0], 10);
                    handleConfigChange({ dailyReviewTime: hour });
                  }}
                  disabled={!config.reviewRemindersEnabled}
                />
              </div>
              <div className="setting-item">
                <label htmlFor="quiet-start">Quiet Hours Start:</label>
                <input
                  type="time"
                  id="quiet-start"
                  value={`${config.quietHoursStart.toString().padStart(2, '0')}:00`}
                  onChange={(e) => {
                    const hour = parseInt(e.target.value.split(':')[0], 10);
                    handleConfigChange({ quietHoursStart: hour });
                  }}
                />
              </div>
              <div className="setting-item">
                <label htmlFor="quiet-end">Quiet Hours End:</label>
                <input
                  type="time"
                  id="quiet-end"
                  value={`${config.quietHoursEnd.toString().padStart(2, '0')}:00`}
                  onChange={(e) => {
                    const hour = parseInt(e.target.value.split(':')[0], 10);
                    handleConfigChange({ quietHoursEnd: hour });
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="stats-section">
            <h2>Learning Statistics</h2>
            
            <div className="stats-grid">
              <div className="stat-card large">
                <span className="stat-number">{stats.totalReviews}</span>
                <span className="stat-label">Total Reviews</span>
              </div>
              <div className="stat-card large">
                <span className="stat-number">{Math.round(stats.accuracyRate * 100)}%</span>
                <span className="stat-label">Accuracy Rate</span>
              </div>
              <div className="stat-card large">
                <span className="stat-number">{stats.streak}</span>
                <span className="stat-label">Day Streak</span>
              </div>
            </div>

            <div className="progress-section">
              <h3>Today's Progress</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${(stats.reviewedToday / (stats.dueToday || 1)) * 100}%` }}
                />
              </div>
              <p>{stats.reviewedToday} of {stats.dueToday} reviews completed today</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};