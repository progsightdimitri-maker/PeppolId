import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

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
    const distPath = path.join(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    
    console.log(`[DIAGNOSTIC] Current working directory (cwd): ${process.cwd()}`);
    console.log(`[DIAGNOSTIC] __dirname: ${path.dirname(new URL(import.meta.url).pathname)}`);
    console.log(`[DIAGNOSTIC] Attempting to serve assets from: ${distPath}`);
    
    // Check if dist exists and list its contents
    import('fs').then(fs => {
      try {
        if (fs.existsSync(distPath)) {
          const files = fs.readdirSync(distPath);
          console.log(`[DIAGNOSTIC] 'dist' folder exists. Contents: ${files.join(', ')}`);
          if (fs.existsSync(indexPath)) {
            console.log("[DIAGNOSTIC] 'dist/index.html' found.");
          } else {
            console.error("[DIAGNOSTIC] 'dist/index.html' is MISSING!");
          }
        } else {
          console.error("[DIAGNOSTIC] 'dist' folder is MISSING! Listing root directory instead:");
          const rootFiles = fs.readdirSync(process.cwd());
          console.log(`[DIAGNOSTIC] Root contents: ${rootFiles.join(', ')}`);
        }
      } catch (err) {
        console.error("[DIAGNOSTIC] Error while checking directories:", err);
      }
    });

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/assets/')) {
        console.warn(`[DIAGNOSTIC] Asset not found in static middleware, falling back to index.html for: ${req.path}`);
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
