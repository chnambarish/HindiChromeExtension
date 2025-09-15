import React, { useState } from 'react';
import { getVocabulary } from '../utils/storage';
import { VocabularyItem } from '../types/srs';

function App() {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadVocabulary = () => {
    setIsLoading(true);
    setError(null);
    getVocabulary()
      .then(data => {
        setVocabulary(data);
        if (data.length === 0) {
          console.log('No vocabulary data found in storage.');
        } else {
          console.log('Successfully retrieved language data from storage:');
          console.table(data);
        }
      })
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
        console.error('Error retrieving language data from storage:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Language Learner Options</h1>
      <p>Click the button to load and display vocabulary from storage.</p>
      <button onClick={handleLoadVocabulary} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Load Vocabulary'}
      </button>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {vocabulary.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h2>Stored Vocabulary</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Target Word</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Translation</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Next Review (Days)</th>
              </tr>
            </thead>
            <tbody>
              {vocabulary.map(item => (
                <tr key={item.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.targetLanguageWord}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.englishTranslation}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.srsData.interval}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
