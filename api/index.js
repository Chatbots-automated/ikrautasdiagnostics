import express from "express";
import Busboy from "busboy";
import { createClient } from "@supabase/supabase-js";

const app = express();

// -----------------------------------------------------------------------------
// Supabase init (env vars MUST be set in Render)
// -----------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log("🚀  Ampeco proxy booted — bucket 'diagnostics'");

// -----------------------------------------------------------------------------
// POST /upload — Ampeco charger will multipart‑POST here
// -----------------------------------------------------------------------------
app.post("/upload", (req, res) => {
  console.log("📥  new request", {
    "content-type": req.headers["content-type"],
    bytes: req.headers["content-length"]
  });

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: 100 * 1024 * 1024 }  // 100 MB
  });

  let fileName = "";
  let fileBuffer = null;

  busboy.on("file", (_, file, info) => {
    fileName = info.filename || `diag-${Date.now()}.zip`;
    const chunks = [];

    file.on("data", chunk => chunks.push(chunk));
    file.on("end",   ()   => {
      fileBuffer = Buffer.concat(chunks);
      console.log(`🗂️  buffered ${fileBuffer.length/1024} KB → ${fileName}`);
    });
  });

  busboy.on("finish", async () => {
    if (!fileBuffer) {
      console.error("❌  No file in payload");
      return res.status(400).json({ error: "no file" });
    }

    try {
      console.log("↗️   Uploading to Supabase …");
      const { error } = await supabase
        .storage
        .from("diagnostics")
        .upload(fileName, fileBuffer, { contentType: "application/zip" });

      if (error) {
        console.error("❌  Supabase", error.message);
        return res.status(500).json({ error: "Supabase upload failed", detail: error.message });
      }

      const { data } = supabase
        .storage
        .from("diagnostics")
        .getPublicUrl(fileName);

      console.log("✅  uploaded", data.publicUrl);
      res.json({ success: true, url: data.publicUrl });
    } catch (err) {
      console.error("❌  unexpected", err);
      res.status(500).json({ error: "server crash" });
    }
  });

  req.pipe(busboy);
});

// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🔊  listening on", PORT));
