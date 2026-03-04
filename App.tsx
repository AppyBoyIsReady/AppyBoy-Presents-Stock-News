import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Search, 
  Clock, 
  BarChart3, 
  Newspaper, 
  PieChart,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Stock {
  ticker: string;
  price_movement: string;
  todays_news: string;
  pe: string;
  financial_performance: string;
  last_updated: string | null;
}

// Initializing with Tier 1 Key from your Vercel Environment Variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchTicker, setSearchTicker] = useState("");
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      const res = await fetch('/api/stocks');
      const data = await res.json();
      setStocks(data);
    } catch (err) {
      console.error("Failed to fetch stocks", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStockData = async (ticker: string) => {
    setUpdating(ticker);
    try {
      // UPDATED: Using gemini-2.5-flash for stable Tier 1 access
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Research ${ticker} as of today (${new Date().toLocaleDateString()}).
        
        1. **Today's News**: Find any news that could affect an investment thesis based on current or future predictions on revenue, margins, debt, market expansion, market contraction, or market share. Synthesize 3-5 reputable sources (Yahoo, Google News, Seeking Alpha, Barrons, NYT, Morningstar, Argus). Avoid company websites or PR Newswire. Provide a 1-2 sentence update.
        
        2. **Financial Performance**: Check if there has been a quarterly or annual earnings call in the last 7 days. 
           - If YES: Analyze the financial performance from that call, including key statistics (Revenue, Margins, Debt, FCF) and stand-out growth. Include breakdowns by business unit or region if available.
           - If NO: Return the existing financial performance data or "No recent earnings call."
        
        Return ONLY a JSON object with keys "news" (string) and "performance" (string).`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        },
      });

      const result = JSON.parse(response.text || "{}");
      
      await fetch('/api/stocks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          todays_news: result.news || "N/A",
          financial_performance: result.performance || "N/A"
        })
      });

      await fetchStocks();
    } catch (err) {
      console.error(`Failed to update ${ticker}`, err);
    } finally {
      setUpdating(null);
    }
  };

  const runBatchUpdate = async () => {
    const batchSize = 10;
    setBatchProgress({ current: 0, total: stocks.length });
    
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      for (const stock of batch) {
        setBatchProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
        await updateStockData(stock.ticker);
      }
    }
    setBatchProgress(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result as string;
      try {
        const res = await fetch('/api/stocks/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent })
        });
        if (res.ok) {
          await fetchStocks();
          alert("Tickers updated successfully!");
        } else {
          alert("Failed to upload CSV. Ensure it has a 'Stock Ticker' column.");
        }
      } catch (err) {
        console.error("Upload error", err);
        alert("An error occurred during upload.");
      }
    };
    reader.readAsText(file);
  };

  const handleSearch = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const ticker = searchTicker.toUpperCase().trim();
      if (!ticker) return;

      const existingStock = stocks.find(s => s.ticker === ticker);
      if (existingStock) {
        await updateStockData(ticker);
        setSearchTicker("");
      } else {
        setShowAddModal(ticker);
      }
    }
  };

  const handleAddTicker = async (ticker: string) => {
    try {
      const res = await fetch('/api/stocks/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });
      if (res.ok) {
        await fetchStocks();
        await updateStockData(ticker);
        setShowAddModal(null);
        setSearchTicker("");
      }
    } catch (err) {
      console.error("Failed to add ticker", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] p-8 max-w-md w-full shadow-[20px_20px_0px_#141414]"
            >
              <h2 className="text-2xl font-serif italic font-bold mb-4">Silly Goose...</h2>
              <p className="text-sm font-mono mb-8 leading-relaxed">
                Your entry <span className="font-bold underline">{showAddModal}</span> does not match a current ticker, silly. 
                Do you want me to add this ticker?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => handleAddTicker(showAddModal)}
                  className="flex-1 py-3 bg-[#141414] text-[#E4E3E0] font-bold uppercase tracking-widest text-xs hover:bg-opacity-90 transition-all"
                >
                  Yes
                </button>
                <button 
                  onClick={() => setShowAddModal(null)}
                  className="flex-1 py-3 border-2 border-[#141414] font-bold uppercase tracking-widest text-xs hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                >
                  No
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <header className="border-b border-[#141414] p-8 flex justify-between items-end bg-[#E4E3E0] sticky top-0 z-10">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-6xl font-serif italic font-bold tracking-tighter leading-none">Finance Bro</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 font-mono mt-4">Automated Equity Research Terminal</p>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:opacity-100 transition-opacity" />
            <input 
              type="text"
              placeholder="SEARCH OR ADD TICKER..."
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              onKeyDown={handleSearch}
              className="bg-transparent border-b-2 border-[#141414]/20 focus:border-[#141414] pl-10 pr-4 py-2 font-mono text-sm uppercase tracking-widest w-64 outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-4">
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all duration-300 rounded-none text-xs font-bold uppercase tracking-widest"
            >
              <Upload className="w-3 h-3" />
              Upload Tickers (.csv)
            </button>
            <button 
              onClick={runBatchUpdate}
              disabled={!!batchProgress}
              className="flex items-center gap-2 px-8 py-3 bg-[#141414] text-[#E4E3E0] hover:bg-opacity-90 transition-all duration-300 rounded-none text-xs font-bold uppercase tracking-widest disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${batchProgress ? 'animate-spin' : ''}`} />
              Initialize Daily Analysis
            </button>
          </div>
        </div>
      </header>
      <main className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <RefreshCw className="w-8 h-8 animate-spin opacity-10" />
            <p className="font-mono text-[10px] uppercase tracking-[0.5em] opacity-20">Accessing Database...</p>
          </div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-[100px_2fr_2fr] border-b border-[#141414] px-8 py-4 bg-[#E4E3E0]">
              <div className="font-mono text-[10px] uppercase opacity-40">Ticker</div>
              <div className="font-mono text-[10px] uppercase opacity-40">Today's News</div>
              <div className="font-mono text-[10px] uppercase opacity-40">Financial Performance</div>
            </div>
            <AnimatePresence>
              {stocks.map((stock) => (
                <motion.div 
                  key={stock.ticker}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-[100px_2fr_2fr] px-8 py-6 border-b border-[#141414]/10 group hover:bg-[#141414]/5 transition-colors"
                >
                  <div className="font-mono font-bold text-xl tracking-tighter flex items-center gap-2">
                    {stock.ticker}
                    {updating === stock.ticker && <RefreshCw className="w-3 h-3 animate-spin opacity-30" />}
                  </div>
                  <div className="text-[11px] leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity pr-8">
                    {stock.todays_news || "Analysis pending."}
                  </div>
                  <div className="text-[11px] leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                    {stock.financial_performance || "Thesis pending."}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
      <footer className="p-8 border-t border-[#141414] flex justify-between items-center opacity-20 font-mono text-[9px] uppercase tracking-[0.4em]">
        <div>Tickers: {stocks.length}</div>
        <div>Finance Bro Terminal © 2026</div>
      </footer>
    </div>
  );
}
