import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    // 1. חיבור לגוגל דרייב (כמו תמיד)
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    // 2. חילוץ ה-ID של הסרטון מהקישור
    const videoId = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/)[1];

    // 3. שימוש בשרת מתווך (Invidious) כדי לקבל לינק הורדה ישיר בלי חסימת Bot
    const invidiousInstances = [
      'https://invidious.snopyta.org',
      'https://yewtu.be',
      'https://invidious.kavin.rocks',
      'https://inv.vern.cc'
    ];
    
    let directUrl = null;
    for (let instance of invidiousInstances) {
      try {
        const apiRes = await fetch(`${instance}/api/v1/videos/${videoId}`);
        const data = await apiRes.json();
        if (data.formatStreams && data.formatStreams.length > 0) {
          // לוקח את האיכות הכי גבוהה שזמינה (בד"כ 720p או 360p עם סאונד)
          directUrl = data.formatStreams[data.formatStreams.length - 1].url;
          break;
        }
      } catch (e) { continue; }
    }

    if (!directUrl) throw new Error("YouTube is being very stubborn. Try again in a few minutes.");

    // 4. העלאה לדרייב
    const videoRes = await fetch(directUrl);
    const fileMetadata = {
      name: `Video_${videoId}.mp4`,
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
