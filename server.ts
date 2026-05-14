import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API to search for competitions
  app.post("/api/competitions/search", async (req, res) => {
    try {
      const response = await fetch('https://unstop.com/api/public/opportunity/search-result?opportunity=competitions&page=1&per_page=15&oppstatus=open');
      const data = await response.json();
      
      if (!data || !data.data || !data.data.data) {
        throw new Error("Invalid response from Unstop API");
      }

      const competitions = data.data.data.map((item: any) => ({
        title: item.title,
        organization: item.organisation?.name || 'Unknown Organization',
        date: item.end_date ? new Date(item.end_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric'}) : 'Various dates',
        url: item.seo_url || `https://unstop.com/${item.public_url}`
      }));

      res.json({ competitions });
    } catch (error) {
      console.error("Scraping Error:", error);
      // Return fallback data if API fails
      res.json({
        competitions: [
          {
            title: "Indian Case Challenge 2026 (ICC - Case Study Competition)",
            organization: "Business Club, IIT Kharagpur",
            date: "Jan 05, 2026",
            url: "https://unstop.com/p/indian-case-challenge-2026-icc-case-study-competition-iit-kharagpur-900593"
          },
          {
            title: "Uncharted: Case-Study Competition - 2026",
            organization: "Unstop",
            date: "Mar 30, 2026",
            url: "https://unstop.com/p/uncharted-case-study-competition-901174"
          },
          {
            title: "STRAITS - An International Crisis Management Case Competition - 2026",
            organization: "Indian Institute of Management (IIM), Ahmedabad - Dubai",
            date: "May 07, 2026",
            url: "https://unstop.com/p/straits-an-international-crisis-management-case-competition-iim-ahmedabad-dubai-901046"
          }
        ]
      });
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
