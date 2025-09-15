import React, { useState, useEffect } from 'react';
import { UserConfig, LearningStats, VocabularyItem } from '@/types';

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vocabulary' | 'settings' | 'stats'>('vocabulary');
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // TODO: Load data from storage
      
      // Mock data for now
      const mockConfig: UserConfig = {
        ttsVoice: 'Google Hindi',
        speechRate: 0.8,
        speechPitch: 1.0,
        notificationsEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        targetLanguage: 'hi-IN',
        newWordRepetitions: 3,
      };

      const mockStats: LearningStats = {
        totalItems: 25,
        dueToday: 5,
        newToday: 2,
        reviewedToday: 8,
        accuracyRate: 0.87,
        streak: 12,
        totalReviews: 156,
      };

      const mockVocabulary: VocabularyItem[] = [
        {
          id: '1',
          targetLanguageWord: 'नमस्ते',
          englishTranslation: 'Hello',
          tags: ['greetings'],
          srsData: {
            nextReviewDate: Date.now() + 86400000,
            interval: 2,
            repetitions: 1,
            easeFactor: 2.5,
            lastReviewed: Date.now() - 86400000,
            createdAt: Date.now() - 172800000,
            updatedAt: Date.now() - 86400000,
          },
        },
      ];

      setConfig(mockConfig);
      setStats(mockStats);
      setVocabulary(mockVocabulary);
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
      // TODO: Validate and import vocabulary
      console.log('Importing vocabulary:', importedData);
    } catch (error) {
      console.error('Failed to import vocabulary:', error);
      alert('Failed to import vocabulary. Please check the file format.');
    }
  };

  const handleExportVocabulary = () => {
    const dataStr = JSON.stringify(vocabulary, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hindi_vocabulary.json';
    link.click();
    
    URL.revokeObjectURL(url);
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
              <h3>🔔 Notifications</h3>
              <div className="setting-item">
                <label htmlFor="notifications">Enable Notifications:</label>
                <input
                  type="checkbox"
                  id="notifications"
                  checked={config.notificationsEnabled}
                />
              </div>
              <div className="setting-item">
                <label htmlFor="quiet-start">Quiet Hours Start:</label>
                <input
                  type="time"
                  id="quiet-start"
                  value={`${config.quietHoursStart.toString().padStart(2, '0')}:00`}
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