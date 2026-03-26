// api/direct-url.js

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ error: 'יש לשלוח קישור יוטיוב תקין' });
  }

  try {
    // פקודה עם yt-dlp
    const command = `yt-dlp --get-url -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --no-warnings --quiet "${url}"`;

    const { stdout, stderr } = await execPromise(command);

    if (stderr && stderr.includes('ERROR')) {
      throw new Error(stderr);
    }

    const directUrl = stdout.trim();

    if (!directUrl || !directUrl.startsWith('http')) {
      throw new Error('לא נמצא קישור ישיר');
    }

    return res.status(200).json({
      success: true,
      directUrl: directUrl
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message || 'שגיאה בהשגת הקישור'
    });
  }
}
