import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false, // required to handle raw binary
  },
};

// Hardcoded Supabase credentials
const supabase = createClient(
  'https://zzoovcdpgpggiyzvsnig.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6b292Y2RwZ3BnZ2l5enZzbmlnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTI5NjE2NSwiZXhwIjoyMDY2ODcyMTY1fQ.9U5MihcPJ5Umk8OnHZ9Qqb2m88iudpsu4QCXscI-8ns'
);

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).send('Method Not Allowed');
  }

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const buffer = Buffer.concat(chunks);
    const fileName = `diagnostics-${Date.now()}.zip`;

    const { error } = await supabase.storage
      .from('diagnostics')
      .upload(fileName, buffer, {
        contentType: 'application/zip',
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase upload error:', error);
      return res.status(500).json({ error: 'Upload to Supabase failed' });
    }

    const { data: urlData } = supabase.storage
      .from('diagnostics')
      .getPublicUrl(fileName);

    return res.status(200).json({
      success: true,
      fileUrl: urlData.publicUrl,
    });
  });

  req.on('error', err => {
    console.error('❌ Request stream error:', err);
    return res.status(500).json({ error: 'Request error' });
  });
}
