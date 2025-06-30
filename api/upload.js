import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 🔐 Load your env vars from Vercel dashboard
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('❌ Form parse error:', err);
      return res.status(500).json({ error: 'Failed to parse file' });
    }

    const uploaded = files.file || Object.values(files)[0];
    const fileStream = fs.createReadStream(uploaded.filepath);
    const fileName = `${Date.now()}-${uploaded.originalFilename || uploaded.name}`;

    const { error: uploadError } = await supabase.storage
      .from('diagnostics')
      .upload(fileName, fileStream, {
        contentType: uploaded.mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Supabase upload failed' });
    }

    const { data: urlData } = supabase.storage.from('diagnostics').getPublicUrl(fileName);

    return res.status(200).json({
      success: true,
      fileUrl: urlData.publicUrl,
    });
  });
}
