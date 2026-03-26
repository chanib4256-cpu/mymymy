import { google } from 'googleapis';
import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    // 1. התחברות לגוגל דרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });

    // 2. חילוץ לינק ישיר מיוטיוב (באיכות הכי טובה שיש וידאו+אודיו יחד)
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });
    
    if (!format || !format.url) throw new Error("לא נמצא פורמט מתאים להורדה");

    // 3. הזרמה ישירות לדרייב (כדי לא לחרוג מהזיכרון של ורסל)
    const videoStream = await fetch(format.url);
    
    const fileMetadata = {
      name: `${info.videoDetails.title.replace(/[^\w\s]/gi, '')}.mp4`,
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

    return res.status(200).json({ success: true, fileId: file.data.id });

  } catch (error) {
    console.error("Error details:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: error.message.includes('403') ? "YouTube blocked this request (403)" : error.message 
    });
  }
}
