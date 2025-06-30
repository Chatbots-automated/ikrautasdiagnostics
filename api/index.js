import express from "express";
import Busboy from "busboy";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";

// -----------------------------------------------------------------------------
//  Config & bootstrap
// -----------------------------------------------------------------------------
const app = express();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("❌  SUPABASE_URL or SUPABASE_SERVICE_KEY env vars are missing");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log("🚀  Proxy starting — bucket 'diagnostics' @", process.env.SUPABASE_URL);

// -----------------------------------------------------------------------------
//  POST  /upload   — Ampeco will send multipart form‑data here
// -----------------------------------------------------------------------------
app.post("/upload", (req, res) => {
  console.log("📥  Incoming request", {
    method: req.method,
    "content-type": req.headers["content-type"],
    "content-length": req.headers["content-length"],
  });

  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  });

  let tmpPath = "";
  let origName = "";

  bb.on("file", (_, fileStream, info) => {
    origName = info.filename || `diag-${Date.now()}.zip`;
    tmpPath  = path.join("/tmp", origName);
    console.log("📂  Streaming →", tmpPath);
    const ws = fs.createWriteStream(tmpPath);
    fileStream.pipe(ws);
  });

  bb.on("error", (err) => {
    console.error("❌  Busboy error", err);
    res.status(500).json({ error: "Parser failed" });
  });

  bb.on("finish", async () => {
    if (!tmpPath) {
      console.error("❌  No file part in form‑data");
      return res.status(400).json({ error: "No file" });
    }

    try {
      const buf = fs.readFileSync(tmpPath); // read into memory — avoids undici duplex flag
      console.log(`↗️   Uploading ${origName} (${(buf.length/1024).toFixed(1)} KB) → Supabase …`);

      const { error } = await supabase
        .storage
        .from("diagnostics")
        .upload(origName, buf, { contentType: "application/zip" });

      if (error) {
        console.error("❌  Supabase upload error", error.message);
        return res.status(500).json({ error: "Supabase upload failed", detail: error.message });
      }

      const { data } = supabase
        .storage
        .from("diagnostics")
        .getPublicUrl(origName);

      console.log("✅  Uploaded", data.publicUrl);
      res.json({ success: true, url: data.publicUrl });
    } catch (err) {
      console.error("❌  Unexpected error", err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  req.pipe(bb);
});

// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🚀  Proxy listening on", PORT));
