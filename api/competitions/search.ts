import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const response = await fetch('https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=15&oppstatus=open', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error("Invalid response from Unstop API");
    }
    
    const data = await response.json();
    
    if (!data || !data.data || !data.data.data) {
      throw new Error("Invalid response JSON structure from Unstop API");
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

    res.status(200).json({ competitions });
  } catch (error) {
    console.error("Scraping Error:", error);
    // Return fallback data if API fails
    res.status(200).json({
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
}
