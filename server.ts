import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
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
    
    console.log(`[DIAGNOSTIC] Environment: PRODUCTION`);
    console.log(`[DIAGNOSTIC] process.cwd(): ${process.cwd()}`);
    console.log(`[DIAGNOSTIC] __dirname: ${__dirname}`);
    console.log(`[DIAGNOSTIC] Expected distPath: ${distPath}`);
    
    import('fs').then(fs => {
      try {
        if (fs.existsSync(distPath)) {
          const files = fs.readdirSync(distPath);
          console.log(`[DIAGNOSTIC] SUCCESS: 'dist' folder found. Contents: ${files.join(', ')}`);
          
          const assetsPath = path.join(distPath, 'assets');
          if (fs.existsSync(assetsPath)) {
            const assetFiles = fs.readdirSync(assetsPath);
            console.log(`[DIAGNOSTIC] SUCCESS: 'dist/assets' found. Contents: ${assetFiles.slice(0, 10).join(', ')}${assetFiles.length > 10 ? '...' : ''}`);
          } else {
            console.error("[DIAGNOSTIC] ERROR: 'dist/assets' folder is MISSING!");
          }

          if (fs.existsSync(indexPath)) {
            console.log("[DIAGNOSTIC] SUCCESS: 'dist/index.html' found.");
            // Log a snippet of index.html to see script tags
            const html = fs.readFileSync(indexPath, 'utf8');
            const scriptMatch = html.match(/<script.*src="([^"]+)".*>/);
            console.log(`[DIAGNOSTIC] index.html script tag: ${scriptMatch ? scriptMatch[0] : 'NOT FOUND'}`);
          } else {
            console.error("[DIAGNOSTIC] ERROR: 'dist/index.html' is MISSING in dist folder!");
          }
        } else {
          console.error("[DIAGNOSTIC] ERROR: 'dist' folder NOT found at expected path.");
          // Try to find it anywhere in root
          const rootFiles = fs.readdirSync(process.cwd());
          console.log(`[DIAGNOSTIC] Root contents: ${rootFiles.join(', ')}`);
        }
      } catch (err) {
        console.error("[DIAGNOSTIC] Unexpected error during startup checks:", err);
      }
    });

    app.use(express.static(distPath));
    
    // Fallback for SPA routing
    app.get('*', (req, res) => {
      // Log only the first few requests to avoid flooding
      if (req.path.startsWith('/assets/')) {
        console.warn(`[DIAGNOSTIC] Asset requested but not found by static provider: ${req.path}`);
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
