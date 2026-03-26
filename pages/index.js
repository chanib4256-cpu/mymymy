'use client';

import { useState } from 'react';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!youtubeUrl) return;

    setLoading(true);
    setError('');
    setDirectUrl('');
    setTitle('');

    try {
      const res = await fetch('/api/direct-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl })
      });

      const data = await res.json();

      if (data.success) {
        setDirectUrl(data.directUrl);
        setTitle(data.title || 'סרטון יוטיוב');
      } else {
        setError(data.error || 'שגיאה לא ידועה');
      }
    } catch (err) {
      setError('שגיאה בחיבור לשרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '700px', margin: '0 auto', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
      <h1>🔗 יוטיוב - קישור ישיר להורדה</h1>
      <p>הדבק קישור מיוטיוב וקבל קישור ישיר להורדה</p>

      <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
        <input
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '15px', 
            fontSize: '16px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            marginBottom: '15px'
          }}
          required
        />
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '15px 40px',
            fontSize: '17px',
            backgroundColor: loading ? '#666' : '#ff0000',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'מעבד...' : 'קבל קישור להורדה'}
        </button>
      </form>

      {error && <p style={{ color: 'red', marginTop: '25px' }}>{error}</p>}

      {directUrl && (
        <div style={{ marginTop: '40px', padding: '25px', backgroundColor: '#f8f8f8', borderRadius: '10px' }}>
          <h3>✅ קישור ישיר להורדה:</h3>
          <p><strong>שם:</strong> {title}</p>
          <a 
            href={directUrl} 
            target="_blank"
            style={{ color: 'blue', wordBreak: 'break-all', fontSize: '15px' }}
          >
            {directUrl}
          </a>
          <br /><br />
          <button 
            onClick={() => window.open(directUrl, '_blank')}
            style={{ padding: '14px 30px', fontSize: '16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px' }}
          >
            📥 הורד עכשיו
          </button>
        </div>
      )}
    </div>
  );
}
