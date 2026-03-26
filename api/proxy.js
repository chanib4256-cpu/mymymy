import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';
  const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';

  try {
    const videoId = extractVideoId(url);
    
    // 1. קבלת נתונים מ-RapidAPI
    const rapidRes = await fetch(`https://${RAPID_API_HOST}/dl?id=${videoId}`, {
      headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
    });
    const data = await rapidRes.json();
    
    if (data.status !== 'OK') throw new Error(`API Error: ${data.msg || 'Unknown'}`);

    // 2. חילוץ הלינק (חיפוש אגרסיבי בתוך כל ה-JSON)
    const fullJson = JSON.stringify(data);
    const regex = /(https?:\/\/[^" ]+googlevideo[^" ]+)/g;
    const matches = fullJson.match(regex);
    let downloadUrl = matches ? matches[0].replace(/\\u0026/g, '&').replace(/\\/g, '') : null;

    if (!downloadUrl) throw new Error("No download link found");

    // 3. הורדת הסרטון ל-Buffer (פותר את בעיית ה-pipe)
    const videoRes = await fetch(downloadUrl);
    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. התחברות לגוגל דרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    // 5. העלאה לדרייב
    const file = await drive.files.create({
      resource: { 
        name: `Video_${Date.now()}.mp4`, 
        parents: [process.env.GOOGLE_FOLDER_ID] 
      },
      media: {
        mimeType: 'video/mp4',
        body: buffer // שליחה כ-Buffer פותרת את שגיאת ה-pipe
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
