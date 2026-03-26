// api/direct-url.js
import ytdl from 'ytdl-core';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ error: 'יש לשלוח קישור יוטיוב תקין' });
  }

  try {
    const info = await ytdl.getInfo(url);
    
    // בוחר את הפורמט הטוב ביותר (איכות גבוהה + mp4)
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highest',
      filter: format => format.container === 'mp4'
    });

    if (!format || !format.url) {
      throw new Error('לא נמצא קישור ישיר');
    }

    return res.status(200).json({
      success: true,
      directUrl: format.url,
      title: info.videoDetails.title
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message || 'שגיאה בהשגת הקישור'
    });
  }
}
