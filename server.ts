import express from 'express';
import { db } from '@vercel/postgres';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Gemini with your Tier 1 API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// Using the stable 2.5 Flash model for guaranteed Tier 1 quota recognition
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 1. GET all stocks from Postgres
app.get('/api/stocks', async (req, res) => {
  try {
    const client = await db.connect();
    const { rows } = await client.sql`SELECT * FROM stocks ORDER BY ticker ASC`;
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

// 2. POST to add a new ticker
app.post('/api/stocks/add', async (req, res) => {
  const { ticker } = req.body;
  try {
    const client = await db.connect();
    await client.sql`
      INSERT INTO stocks (ticker, todays_news, financial_performance, last_updated)
      VALUES (${ticker.toUpperCase()}, 'Pending analysis...', 'Pending thesis...', NOW())
      ON CONFLICT (ticker) DO NOTHING
    `;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to add ticker" });
  }
});

// 3. POST to update stock data using Gemini
app.post('/api/stocks/update', async (req, res) => {
  const { ticker, todays_news, financial_performance } = req.body;
  try {
    const client = await db.connect();
    await client.sql`
      UPDATE stocks 
      SET todays_news = ${todays_news}, 
          financial_performance = ${financial_performance}, 
          last_updated = NOW()
      WHERE ticker = ${ticker}
    `;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
