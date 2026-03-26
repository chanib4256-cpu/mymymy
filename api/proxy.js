import { google } from 'googleapis';

export default async function handler(req, res) {
  // קבלת ה-URL מהשאילתה (למשל ?url=https://www.youtube.com/watch?v=UxxajLWwzqY)
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing YouTube URL' });
  }

  // המפתח שקיבלת מ-RapidAPI
  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';

  try {
    // 1. חילוץ ה-ID מהקישור
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    console.log(`Processing video ID: ${videoId}`);

    // 2. פנייה ל-RapidAPI לקבלת לינקים להורדה
    const rapidRes = await fetch(`https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${videoId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com',
        'x-rapidapi-key': RAPID_API_KEY
      }
    });

    const data = await rapidRes.json();

    if (data.status !== 'OK') {
      throw new Error(data.msg || "Failed to get download link from RapidAPI");
    }

    // בחירת לינק ההורדה (למשל האיכות הראשונה שמופיעה ברשימה שהיא עם וידאו וסאונד)
    // בדרך כלל זה נמצא ב-data.link. ב-API הזה זה אובייקט של פורמטים.
    const formats = Object.values(data.link);
    const bestFormat = formats.find(f => f[0] === 'mp4' && f[1] === '720') || formats[0];
    const downloadUrl = bestFormat[2]; // הקישור הישיר להורדה

    if (!downloadUrl) throw new Error("No direct download link found");

    // 3. הגדרת חיבור לגוגל דרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    // 4. הזרמת הקובץ ישירות לדרייב
    const videoStream = await fetch(downloadUrl);
    if (!videoStream.ok) throw new Error("Failed to fetch video stream from download URL");

    const fileMetadata = {
      name: `YouTube_${videoId}_${Date.now()}.mp4`,
      parents: [process.env.GOOGLE_FOLDER_ID]
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType: 'video/mp4',
        body: videoStream.body
      },
      fields: 'id'
    });

    console.log(`File created in Drive. ID: ${file.data.id}`);
    return res.status(200).json({ success: true, fileId: file.data.id });

  } catch (error) {
    console.error("Proxy Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// פונקציית עזר לחילוץ ID
function extractVideoId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}
