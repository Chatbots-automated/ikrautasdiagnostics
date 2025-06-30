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

// POST /upload  (Ampeco points `location` here)
app.post("/upload", (req, res) => {
  const bb = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

  let savedPath = "";
  let origName  = "";

  bb.on("file", (_, file, info) => {
    origName  = info.filename || `diag-${Date.now()}.zip`;
    savedPath = path.join("/tmp", origName);
    const ws  = fs.createWriteStream(savedPath);
    file.pipe(ws);
  });

  bb.on("finish", async () => {
    if (!savedPath) return res.status(400).json({ error: "No file" });

    const stream = fs.createReadStream(savedPath);
    const { error } = await supabase
      .storage
      .from("diagnostics")          // bucket name
      .upload(origName, stream, { contentType: "application/zip" });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ error: "Upload failed" });
    }

    const { data } = supabase
      .storage
      .from("diagnostics")
      .getPublicUrl(origName);

    console.log("✓ Uploaded:", data.publicUrl);
    res.json({ success: true, url: data.publicUrl });
  });

  req.pipe(bb);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Proxy listening on", PORT));
