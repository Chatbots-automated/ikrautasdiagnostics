import express from "express";
import Busboy  from "busboy";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ------------------------------------------------------------------
//  Supabase client  (env vars MUST be set in Render dashboard)
// ------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log("🚀  Ampeco proxy booted — bucket 'diagnostics'");

// ------------------------------------------------------------------
//  POST  /upload  – Ampeco points here
// ------------------------------------------------------------------
app.post("/upload", (req, res) => {
  console.log("📥  request", {
    "content-type": req.headers["content-type"],
    bytes: req.headers["content-length"]
  });

  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: 100 * 1024 * 1024 }  // 100 MB
  });

  let fileName   = "";
  let fileBuffer = null;

  bb.on("file", (_, file, info) => {
    fileName = info.filename || `diag-${Date.now()}.zip`;
    const chunks = [];

    file.on("data", chunk => chunks.push(chunk));
    file.on("end",  ()    => {
      fileBuffer = Buffer.concat(chunks);
      console.log(`🗂️  buffered ${fileBuffer.length/1024} KB → ${fileName}`);
    });
  });

  bb.on("finish", async () => {
    if (!fileBuffer) {
      console.error("❌  no file in form-data");
      return res.status(400).json({ error: "no file" });
    }

    try {
      console.log("↗️   uploading to Supabase …");
      const { error } = await supabase
        .storage.from("diagnostics")           // bucket
        .upload(fileName, fileBuffer, { contentType: "application/zip" });

      if (error) {
        console.error("❌  Supabase:", error.message);
        return res.status(500).json({ error: "Supabase upload failed", detail: error.message });
      }

      const { data } = supabase
        .storage.from("diagnostics")
        .getPublicUrl(fileName);

      console.log("✅  uploaded", data.publicUrl);
      res.json({ success: true, url: data.publicUrl });
    } catch (err) {
      console.error("❌  unexpected:", err);
      res.status(500).json({ error: "server crash" });
    }
  });

  req.pipe(bb);
});

// ------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🔊  listening on", PORT));
