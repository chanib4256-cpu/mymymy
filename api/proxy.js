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
    
    // שלב 1: השגת לינק ישיר (עוקף חסימות)
    const directUrl = await getSmartLink(url);
    if (!directUrl) throw new Error("YouTube blocked all sources");

    // שלב 2: העלאה לדרייב
    const videoRes = await fetch(directUrl);
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

async function getSmartLink(videoUrl) {
  try {
    const r = await fetch("https://co.wuk.sh/api/json", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ url: videoUrl, vQuality: "720" })
    });
    const d = await r.json();
    return d.url || d.picker?.[0]?.url;
  } catch (e) { return null; }
}
