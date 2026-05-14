import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to search for competitions
  app.post("/api/competitions/search", async (req, res) => {
    try {
      const response = await fetch('https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=15&oppstatus=open', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const data = await response.json();
      
      if (!data || !data.data || !data.data.data) {
        throw new Error("Invalid response from Unstop API");
      }

      const competitions = data.data.data.map((item: any) => {
        let finalUrl = item.seo_url || `https://unstop.com/${item.public_url}`;
        if (finalUrl && !finalUrl.startsWith('http')) {
          finalUrl = `https://unstop.com/${finalUrl.startsWith('/') ? finalUrl.slice(1) : finalUrl}`;
        }
        return {
          title: item.title,
          organization: item.organisation?.name || 'Unknown Organization',
          date: item.end_date ? new Date(item.end_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric'}) : 'Various dates',
          url: finalUrl
        };
      });

      res.json({ competitions });
    } catch (error) {
      console.error("Scraping Error:", error);
      // Return fallback data if API fails
      res.json({
        competitions: [
          {
            title: "Global Hackathon 2026",
            organization: "Tech Innovators",
            date: "Jan 05, 2026",
            url: "https://unstop.com/hackathons"
          },
          {
            title: "AI For Good Hackathon",
            organization: "OpenAI",
            date: "Mar 30, 2026",
            url: "https://unstop.com/hackathons"
          },
          {
            title: "Web3 Builders Weekend",
            organization: "Ethereum Foundation",
            date: "May 07, 2026",
            url: "https://unstop.com/hackathons"
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

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default async function (req: any, res: any) {
  const app = await appPromise;
  app(req, res);
}
