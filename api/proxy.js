import { google } from 'googleapis';

export default async function handler(req, res) {
  // קבלת ה-URL מהשאילתה
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing YouTube URL' });

  // הגדרות ה-API בדיוק לפי ה-CURL שלך
  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';
  const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';

  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL - could not find ID");

    // 1. פנייה ל-RapidAPI
    const rapidRes = await fetch(`https://${RAPID_API_HOST}/dl?id=${videoId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPID_API_HOST,
        'x-rapidapi-key': RAPID_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await rapidRes.json();

    // בדיקה אם ה-API החזיר שגיאה (לפי המבנה של ytstream)
    if (data.status !== 'OK') {
      throw new Error(data.msg || "RapidAPI returned an error status");
    }

    // 2. חילוץ הקישור - ב-API הזה 'link' הוא אובייקט של פורמטים
    // אנחנו מחפשים את פורמט 22 (720p) או 18 (360p) שהם הכי יציבים
    let downloadUrl = null;
    if (data.link) {
      if (data.link['22']) downloadUrl = data.link['22'][2];
      else if (data.link['18']) downloadUrl = data.link['18'][2];
      else {
        // אם אין 22 או 18, ניקח את ה-MP4 הראשון שמוצאים
        const firstFormat = Object.values(data.link).find(f => f[0] === 'mp4');
        if (firstFormat) downloadUrl = firstFormat[2];
      }
    }

    if (!downloadUrl) throw new Error("Could not find a valid MP4 download link");

    // 3. התחברות לגוגל דרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    // 4. הזרמה לדרייב
    const videoRes = await fetch(downloadUrl);
    if (!videoRes.ok) throw new Error("Failed to stream video from the provided link");

    const fileMetadata = {
      name: `${data.title || 'Video'}.mp4`.replace(/[^\w\s\u0590-\u05FF.]/gi, ''),
      parents: [process.env.GOOGLE_FOLDER_ID]
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: { mimeType: 'video/mp4', body: videoRes.body },
      fields: 'id'
    });

    return res.status(200).json({ success: true, fileId: file.data.id });

  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function extractVideoId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}
