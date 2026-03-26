import { google } from 'googleapis';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    // 1. חיבור לגוגל דרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth });

    // 2. פנייה ל-Cobalt API (השירות הכי חזק לעקיפת חסימות)
    const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        vQuality: '720', // איכות טובה שחוסכת משאבים
        filenamePattern: 'basic'
      })
    });

    const cobaltData = await cobaltResponse.json();

    // אם Cobalt מחזיר שגיאה או לא מחזיר לינק
    if (!cobaltData || !cobaltData.url) {
      throw new Error("YouTube detected the proxy. Try a different video or wait 5 min.");
    }

    // 3. הורדת הקובץ מהלינק ש-Cobalt נתן והזרמה לדרייב
    const videoRes = await fetch(cobaltData.url);
    if (!videoRes.ok) throw new Error("Failed to stream video from Cobalt");

    const fileMetadata = {
      name: `Download_${Date.now()}.mp4`,
      parents: [process.env.GOOGLE_FOLDER_ID]
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType: 'video/mp4',
        body: videoRes.body
      },
      fields: 'id'
    });

    return res.status(200).json({ success: true, fileId: file.data.id });

  } catch (error) {
    console.error("Final Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
