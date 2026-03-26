import { google } from 'googleapis';
import axios from 'axios';

export default async function handler(req, res) {
  const url = req.method === 'POST' ? req.body.url : req.query.url;

  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    // 1. השגת קישור ישיר
    const directUrl = await getSmartLink(url);
    if (!directUrl) throw new Error("Could not extract download link");

    // 2. הגדרת חיבור לגוגל דרייב
    // חשוב: לוודא שה-PRIVATE KEY בורסל כולל את הגרשיים ואת ה-\n בצורה תקינה
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });

    // 3. הורדה באמצעות axios כ-Stream (יציב יותר ב-Node.js)
    const response = await axios({
      method: 'get',
      url: directUrl,
      responseType: 'stream'
    });

    const fileMetadata = {
      name: `YT_Video_${Date.now()}.mp4`,
      parents: process.env.GOOGLE_FOLDER_ID ? [process.env.GOOGLE_FOLDER_ID] : []
    };

    const media = {
      mimeType: 'video/mp4',
      body: response.data
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name'
    });

    return res.status(200).json({ 
      success: true, 
      fileId: file.data.id,
      link: `https://drive.google.com/file/d/${file.data.id}/view`
    });

  } catch (error) {
    console.error("Error details:", error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      details: "Check if Google Service Account has access to the folder"
    });
  }
}

async function getSmartLink(videoUrl) {
  try {
    const r = await fetch("https://co.wuk.sh/api/json", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ url: videoUrl, vQuality: "720" })
    });
    const d = await r.json();
    return d.url || d.picker?.[0]?.url;
  } catch (e) {
    return null;
  }
}
