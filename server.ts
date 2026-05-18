import express from "express";
import path from "path";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // FIX: Added Helmet, CORS, and Compression middleware for production security and scalability.
  // Add security headers (relaxed CSP for Vite/React dev and images)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  
  // Enable CORS
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

  // Compress responses
  app.use(compression());

  app.use(express.json());

  // API routes go here FIRST

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, server.cjs is inside dist/
    // Static files are also in dist/
    // So if we run from project root, path.join(process.cwd(), 'dist') is correct.
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
