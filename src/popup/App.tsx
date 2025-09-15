import React from 'react';

function App() {
  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <h2>Language Learner</h2>
      <p>Review session UI coming soon!</p>
      <button onClick={() => chrome.runtime.openOptionsPage()}>
        Go to Options
      </button>
    </div>
  );
}

export default App;
