import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes go here FIRST
  app.post("/api/ai/enhance-bio", async (req, res) => {
    try {
      const { bio, skills, degree } = req.body;
      const { GoogleGenAI } = await import("@google/genai");
      
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "",
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a professional career coach. Enhance the following bio for a B-school student competition platform.
      Original Bio: ${bio}
      Skills: ${skills}
      Degree: ${degree}
      
      Requirements:
      - Make it sound professional, ambitious, and collaborative.
      - Keep it under 300 characters.
      - Highlight the synergy between their skills and degree.
      - Output ONLY the enhanced bio text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      const enhancedBio = response.text?.trim() || "";
      
      res.json({ enhancedBio });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to enhance bio" });
    }
  });

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
