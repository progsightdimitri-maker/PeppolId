import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");

  // Proxy route for Peppol Directory API to bypass CORS
  app.get("/api/peppol/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ error: "Missing query parameter 'q'" });
      }

      const response = await fetch(`https://directory.peppol.eu/search/1.0/json?q=${encodeURIComponent(q as string)}`);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Peppol API error: ${response.statusText}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Internal server error while fetching from Peppol API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, we serve from the 'dist' directory
    // We check both relative to cwd and relative to __dirname (which is in the root for server.ts)
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    
    app.use(express.static(distPath));
    
    // Fallback for SPA routing
    app.get('*', (req, res) => {
      // Disable caching for index.html to avoid hash mismatch issues
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
