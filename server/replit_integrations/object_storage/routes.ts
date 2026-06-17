import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes.
 *
 * NOTE: Cover image uploads now use /api/uploads/cover-image (Supabase Storage).
 * This file only keeps the GET /objects/* route for backward-compatibility
 * with any objects previously stored in Replit Object Storage.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Serve previously-uploaded objects from Replit Object Storage.
   * GET /objects/:objectPath(*)
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
