import express from "express";
import Busboy from "busboy";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";

const app = express();

// --- Supabase client --------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,         // e.g. https://zzoovcdpgpggiyzvsnig.supabase.co
  process.env.SUPABASE_SERVICE_KEY  // service-role key
);

// ---------------------------------------------------------------------
// POST  /upload   ← set Ampeco “location” to this URL
// ---------------------------------------------------------------------
app.post("/upload", (req, res) => {
  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: 100 * 1024 * 1024 }   // 100 MB max zip size
  });

  let tmpPath = "";
  let origName = "";

  // save the incoming file to /tmp first
  bb.on("file", (_, file, info) => {
    origName = info.filename || `diag-${Date.now()}.zip`;
    tmpPath  = path.join("/tmp", origName);
    file.pipe(fs.createWriteStream(tmpPath));
  });

  // after streaming to disk, read into a Buffer and push to Supabase
  bb.on("finish", async () => {
    if (!tmpPath) return res.status(400).json({ error: "no file" });

    const dataBuf = fs.readFileSync(tmpPath);              // ← buffer, not stream

    const { error } = await supabase
      .storage
      .from("diagnostics")                                 // bucket name
      .upload(origName, dataBuf, { contentType: "application/zip" });

    if (error) return res.status(500).json({ error: "Supabase upload failed" });

    const { data } = supabase
      .storage
      .from("diagnostics")
      .getPublicUrl(origName);

    console.log("✓ uploaded", data.publicUrl);
    res.json({ success: true, url: data.publicUrl });
  });

  req.pipe(bb);
});

// ---------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("proxy listening on", PORT));
