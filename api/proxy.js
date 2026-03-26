import { google } from 'googleapis';

export default async function handler(req, res) {
  // תמיכה גם ב-GET וגם ב-POST לנוחותך
  const url = req.method === 'POST' ? req.body.url : req.query.url;

  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    // 1. השגת קישור ישיר להורדה (עוקף את החסימה של ytdl-core)
    const directUrl = await getSmartLink(url);
    if (!directUrl) throw new Error("כל מקורות ההורדה נכשלו");

    // 2. הגדרת חיבור לגוגל דרייב
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });

    // 3. הורדה מהמקור והזרמה ישירה לדרייב
    const videoRes = await fetch(directUrl);
    if (!videoRes.ok) throw new Error("נכשל שלב הורדת הקובץ מהמקור");

    const fileMetadata = {
      name: `YT_Download_${Date.now()}.mp4`,
      parents: [process.env.GOOGLE_FOLDER_ID]
    };

    const media = {
      mimeType: 'video/mp4',
      body: videoRes.body // הזרמה ישירה לחיסכון בזיכרון של ורסל
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name'
    });

    return res.status(200).json({ 
      success: true, 
      message: "הקובץ הועלה לדרייב בהצלחה!",
      fileId: file.data.id 
    });

  } catch (error) {
    console.error("Master Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// פונקציה חכמה שמנסה כמה מקורות כדי לעקוף חסימות
async function getSmartLink(videoUrl) {
  const sources = [
    // מקור 1: Cobalt (הכי חזק כרגע)
    async () => {
      const r = await fetch("https://co.wuk.sh/api/json", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ url: videoUrl, vQuality: "720" })
      });
      const d = await r.json();
      return d.url || d.picker?.[0]?.url;
    },
    // מקור 2: OceanSaver
    async () => {
      const r = await fetch("https://p.oceansaver.in/ajax/download.php?url=" + encodeURIComponent(videoUrl));
      const d = await r.json();
      return d.url;
    }
  ];

  for (const source of sources) {
    try {
      const link = await source();
      if (link && link.startsWith("http")) return link;
    } catch (e) { continue; }
  }
  return null;
}
