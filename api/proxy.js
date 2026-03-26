import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });
    
    // ניסיון להשיג לינק הורדה ממקור חלופי
    const directUrl = await getBackupLink(url);
    if (!directUrl) throw new Error("כל מקורות ההורדה חסומים כרגע עובדים על פתרון");

    // העלאה לדרייב
    const videoRes = await fetch(directUrl);
    if (!videoRes.ok) throw new Error("Failed to fetch video stream");

    const fileMetadata = {
      name: `Video_${Date.now()}.mp4`,
      parents: [process.env.GOOGLE_FOLDER_ID]
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: { mimeType: 'video/mp4', body: videoRes.body },
      fields: 'id'
    });

    return res.status(200).json({ success: true, fileId: file.data.id });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function getBackupLink(videoUrl) {
  try {
    // שימוש ב-API חלופי של ddownr או מקור דומה
    const response = await fetch(`https://loader.to/api/getRouting?url=${encodeURIComponent(videoUrl)}`);
    const data = await response.json();
    
    // מחפש את הלינק של ה-MP4 (בדרך כלל ב-720p)
    if (data && data.url) return data.url;
    
    // ניסיון נוסף עם cobalt בפורמט שונה
    const cobaltRes = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ url: videoUrl, vQuality: "720", isAudioOnly: false })
    });
    const cobaltData = await cobaltRes.json();
    return cobaltData.url;
  } catch (e) {
    return null;
  }
}
