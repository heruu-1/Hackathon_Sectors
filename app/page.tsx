"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  AlertTriangle,
  TrendingUp,
  Activity,
  BarChart2,
  Search,
  ShieldAlert,
  ChevronRight,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const ANOMALIES = [
  {
    id: "UMA-102",
    ticker: "BUMI",
    name: "PT Bumi Resources Tbk",
    risk: 92,
    price: "Rp 145",
    change: "+24.5%",
    volumeSpike: "850%",
    status: "CRITICAL",
    time: "2 mins ago",
    reason: "Massive volume spike without fundamental news. Price action highly detached from sector trend.",
  },
  {
    id: "UMA-103",
    ticker: "GOTO",
    name: "PT GoTo Gojek Tokopedia Tbk",
    risk: 75,
    price: "Rp 65",
    change: "+15.2%",
    volumeSpike: "320%",
    status: "WARNING",
    time: "15 mins ago",
    reason: "Sudden order book imbalance and rapid sequential buying indicating potential pump.",
  },
  {
    id: "UMA-104",
    ticker: "BRMS",
    name: "PT Bumi Resources Minerals Tbk",
    risk: 88,
    price: "Rp 210",
    change: "+18.0%",
    volumeSpike: "600%",
    status: "HIGH",
    time: "32 mins ago",
    reason: "Unusual block trade activity followed by retail frenzy.",
  },
];

export default function Home() {
  const [selectedAnomaly, setSelectedAnomaly] = useState(ANOMALIES[0]);
  const [isScanning, setIsScanning] = useState(true);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-rose-500/30 overflow-hidden relative">
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-orange-500 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
              <Radar className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">
                RASI
              </h1>
              <p className="text-[10px] text-rose-400 font-medium tracking-widest uppercase">
                Report Analisis Saham Indonesia
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              System Active
            </div>
            <button className="h-10 px-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm font-medium">
              <Search className="w-4 h-4 text-slate-400" />
              Analyze Ticker
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Live Feed */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-500" />
                Live Anomaly Feed
              </h2>
              <button 
                onClick={() => setIsScanning(!isScanning)}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <RefreshCcw className={cn("w-3 h-3", isScanning && "animate-spin")} />
                {isScanning ? "Scanning..." : "Paused"}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <AnimatePresence>
                {ANOMALIES.map((anomaly, idx) => (
                  <motion.div
                    key={anomaly.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => setSelectedAnomaly(anomaly)}
                    className={cn(
                      "p-4 rounded-2xl border cursor-pointer transition-all duration-300",
                      selectedAnomaly.id === anomaly.id
                        ? "bg-rose-500/10 border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.15)]"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-lg">{anomaly.ticker}</span>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider",
                            anomaly.status === 'CRITICAL' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                            anomaly.status === 'HIGH' ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                            "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                          )}>
                            {anomaly.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 truncate w-48">{anomaly.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-mono">{anomaly.price}</div>
                        <div className="text-emerald-400 text-sm font-medium">{anomaly.change}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-300">
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        Risk Score: <span className="text-white font-bold">{anomaly.risk}%</span>
                      </div>
                      <span className="text-xs text-slate-500">{anomaly.time}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Detailed Analysis */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedAnomaly.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 relative overflow-hidden"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div>
                    <h3 className="text-3xl font-bold text-white mb-2">{selectedAnomaly.ticker} Analysis</h3>
                    <p className="text-slate-400">{selectedAnomaly.name}</p>
                  </div>
                  <div className="w-20 h-20 rounded-full border-[4px] border-rose-500/20 flex items-center justify-center relative">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle 
                        cx="36" cy="36" r="34" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        className="text-rose-500"
                        strokeDasharray="213"
                        strokeDashoffset={213 - (213 * selectedAnomaly.risk) / 100}
                      />
                    </svg>
                    <div className="text-center">
                      <div className="text-xl font-bold text-white">{selectedAnomaly.risk}</div>
                      <div className="text-[10px] text-rose-400 uppercase font-bold">Risk</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <BarChart2 className="w-4 h-4" />
                      Volume Spike
                    </div>
                    <div className="text-3xl font-bold text-white">{selectedAnomaly.volumeSpike}</div>
                    <div className="text-sm text-rose-400 mt-1">vs 30-day average</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <TrendingUp className="w-4 h-4" />
                      Price Action
                    </div>
                    <div className="text-3xl font-bold text-white">{selectedAnomaly.change}</div>
                    <div className="text-sm text-rose-400 mt-1">Intraday movement</div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 relative z-10">
                  <h4 className="flex items-center gap-2 text-rose-400 font-semibold mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    AI Manipulation Warning
                  </h4>
                  <p className="text-slate-300 leading-relaxed text-sm">
                    {selectedAnomaly.reason}
                  </p>
                  
                  <div className="mt-6 pt-6 border-t border-rose-500/10 flex justify-between items-center">
                    <div className="text-sm text-slate-400">
                      Fundamental Health: <span className="text-white font-medium">Poor</span>
                    </div>
                    <button className="flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 font-medium transition-colors">
                      View Fundamental Report <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
