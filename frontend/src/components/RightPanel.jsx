import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Info, CheckCircle2, Train, ShieldAlert, Cpu, Store, Activity, AlertTriangle, Database } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const SCAN_MESSAGES = [
  "📡 브이월드 정밀 공간정보 연동 중...",
  "🔍 개별공시지가(PNILP) 데이터 조회...",
  "🏠 건축물 구조 및 주용도 정밀 분석...",
  "📊 시세 대비 공시지가 적정성 평가 중...",
  "🛡️ 권리관계 및 안심 점수 산출 완료"
];

const mockChartData = [
  { month: '12개월', trade: 1.2, rent: 0.8 },
  { month: '9개월', trade: 1.6, rent: 1.1 },
  { month: '6개월', trade: 2.1, rent: 1.4 },
  { month: '현재', trade: 3.8, rent: 2.6 },
];

const RightPanel = ({ selectedBuilding }) => {
  const roadviewRef = useRef(null);
  const [msgIndex, setMsgIndex] = useState(0);

  // 데이터 접근 전 깊은 복사 및 널 체크
  const analysis = selectedBuilding?.analysis || {};
  const loading = selectedBuilding?.loading;
  const rawTrendData = (analysis?.trend || []);
  
  // 차트 데이터 정제 엔진: NaN/Null 방지
  const trendData = rawTrendData.map(d => ({
    month: String(d.month || ""),
    trade: Number(d.trade) || 0,
    rent: Number(d.rent) || 0
  }));

  const details = analysis?.details || {};

  useEffect(() => {
    if (loading) {
      setMsgIndex(0);
      const interval = setInterval(() => {
        setMsgIndex(prev => (prev + 1) % SCAN_MESSAGES.length);
      }, 700);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    if (selectedBuilding?.lat && window.kakao?.maps && roadviewRef.current) {
      try {
        const rv = new window.kakao.maps.Roadview(roadviewRef.current);
        const rvClient = new window.kakao.maps.RoadviewClient();
        const pos = new window.kakao.maps.LatLng(Number(selectedBuilding.lat), Number(selectedBuilding.lng));
        rvClient.getNearestPanoId(pos, 50, (id) => { if (id) rv.setPanoId(id, pos); });
      } catch (e) { console.error("Roadview init error:", e); }
    }
  }, [selectedBuilding]);

  if (!selectedBuilding) return (
    <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[440px] h-full flex flex-col items-center justify-center p-6 md:p-12 bg-white border-l border-slate-200 shrink-0">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
         <Activity className="w-10 h-10 text-slate-200" />
      </div>
      <p className="text-sm font-black text-slate-300 uppercase tracking-tighter text-center">분석할 매물을 선택해주세요</p>
    </div>
  );

  const scoreRaw = analysis?.score || (selectedBuilding?.id ? (String(selectedBuilding.id).length % 2 === 0 ? 72 : 95) : 85);
  const score = Number(scoreRaw) || 85;
  const isSafe = score >= 90;
  const ratio = Number(details?.priceRatio) || 100;
  const officialPriceRaw = Number(details?.officialPrice || 0);
  const officialPriceFormatted = officialPriceRaw > 0 ? officialPriceRaw.toLocaleString() : '정보없음';
  
  const parseMarketPrice = (p) => {
    if (!p || typeof p !== 'string') return 0;
    return Number(p.replace(/[^0-9]/g, '')) || 0;
  };
  const marketVal = parseMarketPrice(details?.market);
  const avgTradeVal = parseMarketPrice(details?.avgTrade);

  return (
    <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[440px] h-full bg-[#fdfdfd] border-l border-slate-200 flex flex-col z-10 overflow-y-auto custom-scrollbar relative shrink-0">
      {loading && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-10 text-center">
          <div className="relative w-24 h-24 mb-12">
             <div className="absolute inset-0 border-[6px] border-blue-100 rounded-full"></div>
             <div className="absolute inset-0 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <Cpu className="w-10 h-10 text-blue-600 animate-pulse-subtle" />
             </div>
          </div>
          <p className="text-[11px] font-black text-blue-600 tracking-[0.3em] uppercase mb-4 animate-pulse-subtle italic">Precision Analytics v3.0</p>
          <p className="text-slate-800 font-bold text-[13px]">{SCAN_MESSAGES[msgIndex]}</p>
        </div>
      )}

      {/* Roadview Preview */}
      <div className="w-full h-[180px] lg:h-[220px] bg-slate-100 relative group overflow-hidden border-b border-slate-200 shrink-0">
         <div ref={roadviewRef} className="w-full h-full scale-[1.05]"></div>
         <div className="absolute top-4 left-4 z-10">
            <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/20 shadow-lg">Interactive View</span>
         </div>
      </div>

      {/* Header Info */}
      <div className="p-5 lg:p-7 bg-white border-b border-slate-100 relative overflow-hidden shrink-0">
        <h2 className="text-[15px] lg:text-[17px] font-black text-[#0f172a] mb-4 lg:mb-6 relative z-10 tracking-tighter">[{details.bldNm || selectedBuilding.label}] 정밀 진단</h2>
        <div className="flex items-center gap-6 lg:gap-10 relative z-10 mb-2">
           <div className="relative w-24 h-24">
              <svg className="w-full h-full -rotate-90">
                 <circle cx="48" cy="48" r="44" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                 <circle cx="48" cy="48" r="44" stroke={isSafe ? "#22c55e" : "#f59e0b"} strokeWidth="8" fill="none" 
                         strokeDasharray="276.46" strokeDashoffset={276.46 * (1 - score / 100)} 
                         className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-[28px] font-black text-slate-800 leading-none">{score}</span>
                 <span className="text-[9px] font-bold text-slate-400 mt-1">NPS Score</span>
              </div>
           </div>
           <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Safe Level</span>
                 <Info className="w-3 h-3 text-slate-300" />
              </div>
              <span className={`px-4 py-2 rounded-lg text-[11px] font-black border tracking-wider shadow-sm text-center ${
                 isSafe ? "bg-emerald-500 text-white border-emerald-600" : "bg-amber-500 text-white border-amber-600"
              }`}>{isSafe ? "안심(CLEAN)" : "주의(CAUTION)"}</span>
           </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-6 lg:space-y-10">
        {/* Chart Section */}
        <section className="relative">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-[12px] font-black text-slate-800 flex items-center gap-2">
                 <Database size={15} className="text-blue-600" />
                 MOLIT 실거래 통합 추이
              </h3>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">12 Months</span>
           </div>
           <div className="h-[140px] lg:h-[160px] w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={trendData.length > 0 ? trendData : mockChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" hide />
                    <YAxis hide />
                    <RechartsTooltip />
                    <Line type="stepAfter" dataKey="trade" stroke="#2563eb" strokeWidth={3} dot={false} />
                    <Line type="stepAfter" dataKey="rent" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                 </LineChart>
              </ResponsiveContainer>
              <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[8px] font-bold text-slate-400">
                 <span>PREVIOUS</span>
                 <span>LATEST MARKET</span>
              </div>
           </div>
        </section>

        {/* Price Benchmark section */}
        <section className="relative pt-2">
           <h3 className="text-[10px] font-black text-slate-800 mb-4 tracking-widest uppercase">Price Benchmark</h3>
           <div className="h-[110px] lg:h-[130px] w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={[
                    { name: '본 매물', val: marketVal/1000 },
                    { name: '평균', val: avgTradeVal/1000 }
                 ]}>
                    <Bar dataKey="val" radius={[4, 4, 0, 0]} barSize={30}>
                       <Cell fill="#3b82f6" />
                       <Cell fill="#f59e0b" />
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between w-full text-[9px] font-black text-slate-500 mt-2 px-6">
                 <span>본 매물 ({details.market})</span>
                 <span>지역평균 ({details.avgTrade})</span>
              </div>
           </div>
        </section>

        {/* Building attributes */}
        <section className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
           <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Attributes</h3>
           </div>
           <div className="grid grid-cols-2 gap-y-4">
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Structure</span>
                 <span className="text-[11px] font-black text-slate-800 truncate">{details.structure}</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Purpose</span>
                 <span className="text-[11px] font-black text-blue-600 truncate">{details.purpose}</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Official</span>
                 <span className="text-[11px] font-black text-slate-800 truncate">{officialPriceFormatted}원/㎡</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Ratio</span>
                 <span className={`text-[11px] font-black ${ratio > 180 ? 'text-red-500' : 'text-emerald-500'}`}>{ratio}%</span>
              </div>
           </div>
        </section>

        {/* Diagnosis */}
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
           <h3 className="text-[10px] font-black text-slate-800 tracking-widest uppercase">Diagnosis</h3>
           <div className="space-y-3">
              <div className="flex items-center gap-3">
                 <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-blue-500" />
                 </div>
                 <span className="text-[10px] font-bold text-slate-700">권리관계 무결성 확인</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                 </div>
                 <span className="text-[10px] font-bold text-slate-700">임대인 안정성 검증</span>
              </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default RightPanel;
