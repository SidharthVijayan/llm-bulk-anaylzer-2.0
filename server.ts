import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch and parse URL content (Bypassing CORS)
  app.post("/api/analyze-url", async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        timeout: 10000,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Basic structural analysis
      const h1Count = $("h1").length;
      const h2Count = $("h2").length;
      const h3Count = $("h3").length;
      const listCount = $("ul, ol").length;
      const pCount = $("p").length;
      const text = $("body").text().slice(0, 5000); // Send a snippet to Gemini later if needed

      // Return raw data for the frontend to process or send to Gemini
      res.json({
        url,
        structure: {
          h1: h1Count,
          h2: h2Count,
          h3: h3Count,
          lists: listCount,
          paragraphs: pCount,
        },
        textContent: text,
        title: $("title").text(),
      });
    } catch (error: any) {
      console.error(`Error fetching ${url}:`, error.message);
      res.status(500).json({ error: `Failed to fetch URL: ${error.message}` });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
