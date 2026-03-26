import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';
  const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';

  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Video ID not found in URL");

    // פנייה ל-RapidAPI
    const rapidRes = await fetch(`https://${RAPID_API_HOST}/dl?id=${videoId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPID_API_HOST,
        'x-rapidapi-key': RAPID_API_KEY
      }
    });

    const data = await rapidRes.json();

    // לוג לבדיקה ב-Vercel Dashboard
    console.log("RapidAPI Response:", JSON.stringify(data));

    if (data.status !== 'OK') {
      // אם ה-API מחזיר שגיאה, נציג את ההודעה המקורית שלו (למשל: "Rate limit exceeded")
      throw new Error(`RapidAPI Error: ${data.msg || data.message || 'Unknown Error'}`);
    }

    // חילוץ הלינק (חיפוש גמיש יותר בתוך אובייקט ה-link)
    let downloadUrl = null;
    if (data.link) {
        // מנסה למצוא איכות 720p או 360p בפורמט MP4
        const formats = Object.entries(data.link); // [ [key, [type, quality, url]], ... ]
        const found = formats.find(([key, val]) => val[0] === 'mp4' && (val[1] === '720' || val[1] === '360')) || formats[0];
        if (found) downloadUrl = found[1][2];
    }

    if (!downloadUrl) throw new Error("No download link found in API response");

    // חיבור לדרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    const videoStream = await fetch(downloadUrl);
    const fileMetadata = {
      name: `${data.title || 'Video'}.mp4`.replace(/[^\w\s]/gi, ''),
      parents: [process.env.GOOGLE_FOLDER_ID]
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: { mimeType: 'video/mp4', body: videoStream.body },
      fields: 'id'
    });

    return res.status(200).json({ success: true, fileId: file.data.id });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

function extractVideoId(url) {
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
}
