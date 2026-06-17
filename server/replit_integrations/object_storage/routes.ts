import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      console.log("[upload] request-url called — body:", { name, size, contentType });

      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
      console.log("[upload] env PRIVATE_OBJECT_DIR:", privateDir ? privateDir.slice(0, 4) + "****" : "(not set)");
      console.log("[upload] env PUBLIC_OBJECT_SEARCH_PATHS:", publicPaths ? publicPaths.slice(0, 4) + "****" : "(not set)");
      console.log("[upload] env DEFAULT_OBJECT_STORAGE_BUCKET_ID:", bucketId ? bucketId.slice(0, 4) + "****" : "(not set)");

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      console.log("[upload] calling getObjectEntityUploadURL...");
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("[upload] getObjectEntityUploadURL succeeded, URL prefix:", uploadURL.slice(0, 40));

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      console.log("[upload] objectPath:", objectPath);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("[upload] ERROR generating upload URL:", error);
      console.error("[upload] error message:", (error as Error).message);
      console.error("[upload] error stack:", (error as Error).stack);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

