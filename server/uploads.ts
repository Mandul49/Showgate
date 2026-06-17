import type { Express } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import ws from "ws";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
  }
  return createClient(url, key, {
    realtime: { transport: ws as any },
  });
}

export function registerUploadRoutes(app: Express) {
  app.post("/api/uploads/cover-image", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const supabase = getSupabaseClient();
      const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error("[uploads] Supabase upload error:", uploadError.message);
        return res.status(500).json({ error: "Upload failed", message: uploadError.message });
      }

      const { data: { publicUrl } } = supabase.storage
        .from("covers")
        .getPublicUrl(fileName);

      return res.json({ url: publicUrl });
    } catch (err: any) {
      console.error("[uploads] cover-image error:", err.message);
      return res.status(500).json({ error: "Upload failed", message: err.message });
    }
  });
}
