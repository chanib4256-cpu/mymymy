import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';
  const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';

  try {
    const videoId = extractVideoId(url);
    
    // 1. קבלת הלינק מ-RapidAPI
    const rapidRes = await fetch(`https://${RAPID_API_HOST}/dl?id=${videoId}`, {
      headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
    });
    const data = await rapidRes.json();
    if (data.status !== 'OK') throw new Error(`API Error: ${data.msg || 'Unknown'}`);

    let downloadUrl = null;
    if (data.link) {
      const formats = Object.values(data.link);
      // מחפש MP4 - מעדיף 360p בבדיקה הזו כדי לוודא שלא חורגים מזמן הריצה של Vercel
      const found = formats.find(f => f[0] === 'mp4' && f[1] === '360') || 
                    formats.find(f => f[0] === 'mp4' && f[1] === '720') || 
                    formats[0];
      if (found) downloadUrl = found[2];
    }
    if (!downloadUrl) throw new Error("No download link found");

    // 2. הורדת הקובץ לזיכרון (Buffer) - הכי בטוח למניעת שגיאות Pipe
    const videoRes = await fetch(downloadUrl);
    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. התחברות לגוגל דרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    // 4. העלאה לדרייב
    const fileMetadata = {
      name: `${data.title || 'Video'}.mp4`.replace(/[^\w\s\u0590-\u05FF.]/gi, ''),
      parents: [process.env.GOOGLE_FOLDER_ID]
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType: 'video/mp4',
        body: buffer // העלאה ישירה של ה-Buffer
      },
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
