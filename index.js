import express from "express";
import Busboy from "busboy";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";

const app = express();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /upload  – Ampeco will point "location" here
app.post("/upload", (req, res) => {
  const bb = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });

  let tmpPath = "";
  let origName = "";

  bb.on("file", (_, file, info) => {
    origName = info.filename || `diag-${Date.now()}.zip`;
    tmpPath  = path.join("/tmp", origName);
    file.pipe(fs.createWriteStream(tmpPath));
  });

  bb.on("finish", async () => {
    if (!tmpPath) return res.status(400).json({ error: "no file" });

    const stream = fs.createReadStream(tmpPath);

    const { error } = await supabase
      .storage
      .from("diagnostics")
      .upload(origName, stream, { contentType: "application/zip" });

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("proxy listening on", PORT));
