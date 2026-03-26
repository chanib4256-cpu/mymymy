import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  
  if (!url) return res.status(400).json({ error: 'Missing YouTube URL' });

  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';

  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    // 1. פנייה ל-RapidAPI
    const rapidRes = await fetch(`https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${videoId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com',
        'x-rapidapi-key': RAPID_API_KEY
      }
    });

    const data = await rapidRes.json();

    // בדיקה אם ה-API החזיר הצלחה
    if (data.status !== 'OK') {
      throw new Error(data.msg || "RapidAPI returned an error status");
    }

    // 2. חילוץ הקישור - ה-API הזה מחזיר אובייקט 'link' שבו המפתחות הם מספרי פורמט
    let downloadUrl = null;
    if (data.link) {
      // אנחנו מחפשים קישור שיש בו "mp4" ואיכות "720" או "360"
      const formats = Object.values(data.link);
      // פורמט 22 הוא בד"כ MP4 720p עם סאונד - הכי בטוח
      const bestFormat = formats.find(f => f[0] === 'mp4' && (f[1] === '720' || f[1] === '360')) || formats[0];
      
      if (bestFormat && bestFormat[2]) {
        downloadUrl = bestFormat[2];
      }
    }

    if (!downloadUrl) {
      console.error("Data received:", JSON.stringify(data));
      throw new Error("Could not find a valid MP4 download link in the API response");
    }

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
    if (!videoRes.ok) throw new Error("Failed to reach the video file from the provided link");

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
    return res.status(500).json({ success: false, error: error.message });
  }
}

function extractVideoId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}
