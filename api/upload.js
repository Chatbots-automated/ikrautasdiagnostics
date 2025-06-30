import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

const supabase = createClient(
  'https://zzoovcdpgpggiyzvsnig.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6b292Y2RwZ3BnZ2l5enZzbmlnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTI5NjE2NSwiZXhwIjoyMDY2ODcyMTY1fQ.9U5MihcPJ5Umk8OnHZ9Qqb2m88iudpsu4QCXscI-8ns'
);

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).send('Only POST or PUT');
  }

  console.log('⇢ Incoming Ampeco upload …');

  const bb = Busboy({ headers: req.headers });
  let tempPath = '';
  let originalName = '';

  bb.on('file', (_, file, info) => {
    originalName = info.filename || `ampeco-${Date.now()}.zip`;
    tempPath = path.join('/tmp', originalName);
    const writeStream = fs.createWriteStream(tempPath);
    file.pipe(writeStream);
  });

  bb.on('finish', async () => {
    if (!tempPath) {
      console.error('✘ No file part found');
      return res.status(400).json({ error: 'No file' });
    }

    console.log('✔ File saved to tmp:', tempPath);

    const fileStream = fs.createReadStream(tempPath);

    const { error } = await supabase
      .storage
      .from('diagnostics')
      .upload(originalName, fileStream, {
        contentType: 'application/zip',
        upsert: false,
      });

    if (error) {
      console.error('✘ Supabase upload error:', error);
      return res.status(500).json({ error: 'Supabase upload failed' });
    }

    const { data } = supabase.storage.from('diagnostics').getPublicUrl(originalName);

    console.log('✔ Uploaded to Supabase:', data.publicUrl);
    return res.status(200).json({ success: true, url: data.publicUrl });
  });

  req.pipe(bb);
}
