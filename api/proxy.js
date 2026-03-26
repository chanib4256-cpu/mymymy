import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const RAPID_API_KEY = '541c87cb99mshabcdf90a79bcc3ap16beb6jsn68ef8bf404a6';
  const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';

  try {
    const videoId = extractVideoId(url);
    const rapidRes = await fetch(`https://${RAPID_API_HOST}/dl?id=${videoId}`, {
      method: 'GET',
      headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
    });

    const data = await rapidRes.json();
    console.log("Full API Response:", JSON.stringify(data));

    if (data.status !== 'OK') throw new Error(`API Error: ${data.msg || 'Unknown'}`);

    // --- מנגנון חילוץ לינק חכם ---
    let downloadUrl = null;

    // 1. ניסיון לפי המבנה שראינו קודם (data.link)
    if (data.link && typeof data.link === 'object') {
      const formats = Object.values(data.link);
      // מחפש mp4 באיכות 720 או 360
      const best = formats.find(f => f[0] === 'mp4' && (f[1] === '720' || f[1] === '360')) || formats[0];
      if (best && best[2]) downloadUrl = best[2];
    }
    
    // 2. ניסיון גיבוי אם המבנה הוא data.links (ברבים)
    if (!downloadUrl && data.links) {
      downloadUrl = data.links.find(l => l.quality === '720p' || l.quality === '360p')?.link || data.links[0]?.link;
    }

    // 3. מוצא אחרון - חיפוש כל מחרוזת שמתחילה ב-http ומכילה googlevideo
    if (!downloadUrl) {
      const strData = JSON.stringify(data);
      const match = strData.match(/https?:\/\/[^" ]+googlevideo[^" ]+/);
      if (match) downloadUrl = match[0].replace(/\\/g, '');
    }

    if (!downloadUrl) throw new Error("No download link found in the full response");

    // --- העלאה לגוגל דרייב ---
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    const videoStream = await fetch(downloadUrl);
    const file = await drive.files.create({
      resource: { 
        name: `${data.title || 'Video'}.mp4`.replace(/[^\w\s\u0590-\u05FF.]/gi, ''), 
        parents: [process.env.GOOGLE_FOLDER_ID] 
      },
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
