export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing YouTube URL' });

  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';
  const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';

  try {
    const videoId = extractVideoId(url);
    
    // 1. פנייה ל-RapidAPI לקבלת המידע
    const rapidRes = await fetch(`https://${RAPID_API_HOST}/dl?id=${videoId}`, {
      headers: { 
        'x-rapidapi-host': RAPID_API_HOST,
        'x-rapidapi-key': RAPID_API_KEY 
      }
    });
    
    const data = await rapidRes.json();
    if (data.status !== 'OK') throw new Error(data.msg || 'API Error');

    // 2. חילוץ הלינק הישיר (מחפש בתוך האובייקט link)
    let downloadUrl = null;
    if (data.link) {
      // ננסה לקחת איכות 720p (מפתח 22) או 360p (מפתח 18)
      const linkObj = data.link['22'] || data.link['18'] || Object.values(data.link)[0];
      if (linkObj) downloadUrl = linkObj[2];
    }

    // גיבוי: חיפוש טקסט חופשי אם המבנה השתנה
    if (!downloadUrl) {
      const match = JSON.stringify(data).match(/(https?:\/\/[^" ]+googlevideo[^" ]+)/);
      if (match) downloadUrl = match[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
    }

    if (!downloadUrl) throw new Error("Could not extract download link");

    // 3. החזרת הקישור בלבד למשתמש
    return res.status(200).json({ 
      success: true, 
      downloadUrl: downloadUrl,
      title: data.title 
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

function extractVideoId(url) {
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
}
