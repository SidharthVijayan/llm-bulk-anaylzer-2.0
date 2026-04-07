/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BarChart3, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Play, 
  Loader2,
  Globe,
  FileText,
  Zap,
  ArrowRight,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AnalysisResult {
  url: string;
  title: string;
  score: number;
  achievable: number;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  error?: string;
  insights?: {
    readiness: string;
    opportunities: string[];
    visibility: string;
  };
}

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const analyzeWithGemini = async (data: any) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    const prompt = `
      Analyze the following webpage data for "LLM Readiness". 
      LLM Readiness means how easily an AI (like Gemini or GPT) can extract, parse, and cite this content.
      
      URL: ${data.url}
      Title: ${data.title}
      Structure:
      - H1s: ${data.structure.h1}
      - H2s: ${data.structure.h2}
      - H3s: ${data.structure.h3}
      - Lists: ${data.structure.lists}
      - Paragraphs: ${data.structure.paragraphs}
      
      Content Snippet:
      ${data.textContent.substring(0, 2000)}
      
      Provide a JSON response with:
      1. score (0-100): Overall LLM readiness.
      2. achievable (0-100): Potential score if optimized.
      3. insights: 
         - readiness: A 1-sentence summary of current state.
         - opportunities: Array of 3 specific optimization tips.
         - visibility: A 1-sentence estimate of AI citation potential.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              achievable: { type: Type.NUMBER },
              insights: {
                type: Type.OBJECT,
                properties: {
                  readiness: { type: Type.STRING },
                  opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  visibility: { type: Type.STRING }
                }
              }
            },
            required: ["score", "achievable", "insights"]
          }
        }
      });

      return JSON.parse(response.text || '{}');
    } catch (err) {
      console.error("Gemini analysis failed", err);
      return null;
    }
  };

  const handleAnalyze = async () => {
    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));

    if (urls.length === 0) return;

    setIsAnalyzing(true);
    setProgress(0);
    
    const initialResults: AnalysisResult[] = urls.map(url => ({
      url,
      title: 'Pending...',
      score: 0,
      achievable: 0,
      status: 'pending'
    }));
    
    setResults(initialResults);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'analyzing' } : r
      ));

      try {
        const proxyRes = await fetch('/api/analyze-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        if (!proxyRes.ok) throw new Error('Proxy fetch failed');
        const rawData = await proxyRes.json();

        const aiData = await analyzeWithGemini(rawData);

        if (!aiData) throw new Error('AI analysis failed');

        setResults(prev => prev.map((r, idx) => 
          idx === i ? { 
            ...r, 
            title: rawData.title || url,
            score: aiData.score,
            achievable: aiData.achievable,
            insights: aiData.insights,
            status: 'completed' 
          } : r
        ));
      } catch (err: any) {
        setResults(prev => prev.map((r, idx) => 
          idx === i ? { ...r, status: 'error', error: err.message } : r
        ));
      }

      setProgress(((i + 1) / urls.length) * 100);
    }

    setIsAnalyzing(false);
  };

  const exportCSV = () => {
    const headers = ['URL', 'Title', 'LLM Score', 'Achievable', 'Insights'];
    const rows = results.map(r => [
      r.url,
      r.title,
      r.score,
      r.achievable,
      r.insights?.readiness || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'llm_analysis.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Zap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">LLM Bulk Analyzer</h1>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">AI Readiness Auditor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {results.length > 0 && (
              <button 
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-blue-500 w-5 h-5" />
                <h2 className="font-semibold text-white">Target URLs</h2>
              </div>
              
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste URLs here (one per line)...&#10;https://example.com/blog-post"
                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all resize-none"
              />
              
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !urlInput.trim()}
                className={cn(
                  "w-full mt-6 py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
                  isAnalyzing || !urlInput.trim() 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 active:scale-[0.98]"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play size={20} fill="currentColor" />
                    Run Bulk Analysis
                  </>
                )}
              </button>

              {isAnalyzing && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-400">
                    <span>Overall Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-500/5 rounded-2xl border border-blue-500/10 p-6">
              <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                <BarChart3 size={18} />
                Analysis Criteria
              </h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                  <span>Heading hierarchy (H1-H3) for semantic structure</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                  <span>Content segmentation & list usage</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                  <span>AI citation potential & visibility score</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Layout className="text-slate-400 w-5 h-5" />
                  <h2 className="font-semibold text-white">Analysis Results</h2>
                </div>
                <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {results.length} URLs Processed
                </span>
              </div>

              <div className="divide-y divide-slate-800">
                <AnimatePresence mode="popLayout">
                  {results.length === 0 ? (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-20 text-center space-y-4"
                    >
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                        <FileText className="text-slate-600 w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium">No analysis data yet</p>
                        <p className="text-sm text-slate-500">Enter URLs on the left to begin the audit</p>
                      </div>
                    </motion.div>
                  ) : (
                    results.map((result, index) => (
                      <motion.div
                        key={result.url}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-6 hover:bg-slate-800/30 transition-colors group"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {result.status === 'completed' ? (
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                              ) : result.status === 'error' ? (
                                <AlertCircle className="text-rose-500 shrink-0" size={18} />
                              ) : (
                                <Loader2 className="text-blue-500 animate-spin shrink-0" size={18} />
                              )}
                              <h3 className="font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                                {result.title}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500 font-mono truncate mb-4">{result.url}</p>
                            
                            {result.insights && (
                              <div className="space-y-4">
                                <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                                  <p className="text-sm text-slate-300 leading-relaxed italic">
                                    "{result.insights.readiness}"
                                  </p>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Opportunities</p>
                                    <ul className="space-y-1">
                                      {result.insights.opportunities.map((opt, i) => (
                                        <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                                          <ArrowRight size={10} className="text-blue-500" />
                                          {opt}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Visibility Potential</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                      {result.insights.visibility}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {result.status === 'error' && (
                              <div className="bg-rose-500/10 text-rose-400 text-xs p-3 rounded-lg border border-rose-500/20">
                                Error: {result.error}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-row md:flex-col gap-4 shrink-0">
                            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-center min-w-[100px]">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">LLM Score</p>
                              <p className={cn(
                                "text-3xl font-black",
                                result.score >= 80 ? "text-emerald-500" : 
                                result.score >= 50 ? "text-amber-500" : 
                                result.score > 0 ? "text-rose-500" : "text-slate-700"
                              )}>
                                {result.score || '--'}
                              </p>
                            </div>
                            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-center min-w-[100px]">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Achievable</p>
                              <p className="text-3xl font-black text-blue-500">
                                {result.achievable || '--'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-800 text-center">
        <p className="text-sm text-slate-500">
          Powered by Gemini 3 Flash • Built for Content Intelligence at Scale
        </p>
      </footer>
    </div>
  );
}
