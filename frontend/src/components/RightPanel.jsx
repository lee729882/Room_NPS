import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Cpu, Activity,
  Database, Trash2, Phone, Clock, Calendar, ShieldAlert, Zap,
  Home, TrendingUp, Info, Car, ArrowUpDown, Building2, Maximize
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// ── 스캔 메시지 ──
const SCAN_MESSAGES = [
  "📡 브이월드 공시지가 연동 중...",
  "🔍 전세가율 안전성 계산 중...",
  "🛡️ 생활안전지도 치안 데이터 수집...",
  "📊 NPS 4개 지표 가중 합산 중...",
  "✅ 공공데이터 기반 팩트 진단 완료",
];

// ── 스켈레톤 ──
const Sk = ({ className }) => (
  <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`} />
);

// ── 데이터 출처 라벨 ──
const SourceLabel = ({ text }) => (
  <p className="text-[7.5px] font-bold text-slate-300 mt-2 text-right tracking-wide">
    출처: {text}
  </p>
);

// ── 점수 색상 ──
const scoreColor = (s) => {
  if (s >= 85) return { stroke: '#22c55e', bg: 'bg-emerald-500', label: '안심 (SAFE)', ring: 'ring-emerald-100' };
  if (s >= 65) return { stroke: '#f59e0b', bg: 'bg-amber-500', label: '주의 (CAUTION)', ring: 'ring-amber-100' };
  return { stroke: '#ef4444', bg: 'bg-red-500', label: '위험 (RISK)', ring: 'ring-red-100' };
};

// ── 쓰레기 배출 카드 ──
const WasteCard = ({ regionName }) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regionName) return;
    const parts = regionName.split(' ');
    const gu = parts.find(p => p.endsWith('구') || p.endsWith('군'));
    const dong = parts.find(p => p.endsWith('동') || p.endsWith('읍') || p.endsWith('면'));
    const q = [gu, dong].filter(Boolean).join(' ');
    if (!q) return;

    setLoading(true);
    fetch(`http://localhost:5000/api/waste?region=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { setInfo(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [regionName]);

  if (loading) return (
    <section className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2"><Trash2 className="w-4 h-4 text-green-500" /><h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">생활 배출 정보</h3></div>
      <Sk className="h-4 w-full" /><Sk className="h-4 w-3/4" /><Sk className="h-4 w-1/2" />
    </section>
  );

  if (!info?.found) return null;

  const fmt = (s) => s ? s.replace(/\+/g, ' · ') : '-';

  return (
    <section className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-green-600" />
        <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">생활 배출 안내</h3>
        <span className="ml-auto text-[8px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{info.sigungu}</span>
      </div>

      {[
        { label: '생활쓰레기', day: info.wasteDay, start: info.wasteStart, end: info.wasteEnd, dot: 'bg-slate-400' },
        { label: '음식물', day: info.foodDay, start: info.foodStart, end: info.foodEnd, dot: 'bg-green-400' },
        { label: '재활용품', day: info.recycleDay, start: info.recycleStart, end: info.recycleEnd, dot: 'bg-blue-400' },
      ].filter(r => r.day).map(row => (
        <div key={row.label} className="bg-white border border-slate-100 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className={`w-2 h-2 rounded-full ${row.dot}`} />
            <span className="text-[10px] font-black text-slate-700">{row.label}</span>
          </div>
          <div className="flex gap-4 text-[9px] font-bold text-slate-500">
            <span className="flex items-center gap-1"><Calendar size={9} /> {fmt(row.day)}</span>
            <span className="flex items-center gap-1"><Clock size={9} /> {row.start} ~ {row.end}</span>
          </div>
        </div>
      ))}

      {info.deptName && (
        <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
          <span className="text-[9px] font-black text-green-700">{info.deptName}</span>
          {info.deptPhone && (
            <a href={`tel:${info.deptPhone}`} className="flex items-center gap-1 text-[9px] font-black text-green-600">
              <Phone size={9} /> {info.deptPhone}
            </a>
          )}
        </div>
      )}
      {info.noCollectDay && <p className="text-[8px] font-bold text-red-400">미수거일: {fmt(info.noCollectDay)}</p>}
      <SourceLabel text="행정안전부 생활쓰레기 배출정보 공공데이터" />
    </section>
  );
};

// ── 메인 컴포넌트 ──
const RightPanel = ({ selectedBuilding, regionName }) => {
  const roadviewRef = useRef(null);
  const [msgIdx, setMsgIdx] = useState(0);

  const analysis = selectedBuilding?.analysis || {};
  const loading = selectedBuilding?.loading;
  const details = analysis?.details || {};
  const safemap = analysis?.safemap || {};
  const building = analysis?.building || {};
  const npsBreak = analysis?.npsBreakdown || {};
  const diagnosis = analysis?.diagnosis || {};

  const zoneStatus = safemap.zoneStatus || 'safe';
  const warningMsg = safemap.warningMsg || '';

  const trendData = (analysis?.trend || []).map(d => ({
    month: String(d.month || ''),
    trade: d.trade !== null && d.trade !== undefined ? Number(d.trade) : null,
    rent: d.rent !== null && d.rent !== undefined ? Number(d.rent) : null,
  }));

  const score = Number(analysis?.npsScore) || 85;
  const colors = scoreColor(score);
  const radarData = safemap.radar || [
    { subject: '치안', score: 70 },
    { subject: '화재안전', score: 60 },
    { subject: '보행안전', score: 75 },
    { subject: '교통안전', score: 65 },
  ];

  // 스캔 메시지 애니메이션
  useEffect(() => {
    if (!loading) return;
    setMsgIdx(0);
    const t = setInterval(() => setMsgIdx(i => (i + 1) % SCAN_MESSAGES.length), 700);
    return () => clearInterval(t);
  }, [loading]);

  // 로드뷰
  useEffect(() => {
    if (!selectedBuilding?.lat || !window.kakao?.maps || !roadviewRef.current) return;
    try {
      const rv = new window.kakao.maps.Roadview(roadviewRef.current);
      const rc = new window.kakao.maps.RoadviewClient();
      const p = new window.kakao.maps.LatLng(Number(selectedBuilding.lat), Number(selectedBuilding.lng));
      rc.getNearestPanoId(p, 50, id => { if (id) rv.setPanoId(id, p); });
    } catch (e) { console.error(e); }
  }, [selectedBuilding]);

  // ── 데이터 미존재/에러 상태 ──
  // Unauthorized 경고가 데이터와 함께 올 경우를 대비해, 핵심 빌딩 정보(구조/용도 등)가 있다면 에러 오버레이를 차단합니다.
  const hasBuildingData = building && building.structure && building.structure !== '현장 확인 필요';
  const isUnauthorized = (analysis?.msg || '').includes('Unauthorized');

  if (selectedBuilding && !loading && (!analysis || Object.keys(analysis).length === 0 || (isUnauthorized && !hasBuildingData))) return (
    <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[440px] h-full flex flex-col items-center justify-center p-12 bg-white border-l border-slate-200 shrink-0">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-2 border-amber-100">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
      </div>
      <p className="text-sm font-black text-amber-600 uppercase tracking-tighter text-center">{isUnauthorized ? '인증 오류' : 'API 서버 응답 대기 중'}</p>
      <p className="text-[10px] text-slate-400 mt-2 text-center">
        {isUnauthorized ? '일시적인 서비스 키 지연입니다. 곧 데이터가 노출됩니다.' : '일시적인 통신 실패입니다. 잠시 후 다시 매물을 클릭해주세요.'}
      </p>
    </div>
  );

  // ── 빈 상태 ──
  if (!selectedBuilding) return (
    <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[440px] h-full flex flex-col items-center justify-center p-12 bg-white border-l border-slate-200 shrink-0">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
        <Activity className="w-10 h-10 text-slate-200" />
      </div>
      <p className="text-sm font-black text-slate-300 uppercase tracking-tighter text-center">분석할 매물을 선택해주세요</p>
    </div>
  );

  // 가격
  const parseNum = (s) => Number(String(s || '').replace(/[^0-9]/g, '')) || 0;
  const marketVal = details.market === '데이터 없음' ? 0 : parseNum(details.market);
  const avgRentVal = details.avgRent === '데이터 없음' ? 0 : parseNum(details.avgRent);
  const avgTradeVal = details.avgTrade === '데이터 없음' ? 0 : parseNum(details.avgTrade);
  const officialTotal = Number(details.officialTotal) || 0;

  // 거래 유형 뱃지
  const txType = details.txType || '전세';
  const isMonthly = txType === '월세';
  const deposit = details.deposit;
  const monthly = details.monthly;

  // 전세가율 색상
  const rs = details.ratioSafe || 'unknown';
  const ratioCls = rs === 'safe' ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
    : rs === 'caution' ? 'bg-amber-50 border-amber-100 text-amber-700'
      : rs === 'danger' ? 'bg-red-50 border-red-100 text-red-700'
        : 'bg-slate-50 border-slate-100 text-slate-600';

  // 위반건축물 뱃지
  const viloIsVio = building.isVilo === '1';
  const viloUnknown = building.isVilo === null || building.isVilo === undefined;

  // 4개 NPS 항목 바
  const breakItems = [
    { label: '건물 노후도', v: npsBreak.age || 0, color: '#3b82f6' },
    { label: '위반 이력', v: npsBreak.violation || 0, color: '#22c55e' },
    { label: '전세가율', v: npsBreak.ratio || 0, color: '#f59e0b' },
    { label: '치안 지수', v: npsBreak.security || 0, color: '#a855f7' },
  ];

  // 치안 소스 라벨
  const safeSource = safemap.source || 'unknown';
  const safeSourceLabel = safeSource === 'analysis_report'
    ? '행정안전부 치안 인프라 거리 데이터 기반 종합 진단'
    : '접근성 평가 데이터 스캐닝 중...';

  // ── 로딩 상태 (전용 화면) ──
  if (loading) return (
    <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[440px] h-full bg-white border-l border-slate-200 flex flex-col items-center justify-center p-10 text-center z-50 relative shrink-0">
      <div className="relative w-24 h-24 mb-10">
        <div className="absolute inset-0 border-[6px] border-blue-100 rounded-full" />
        <div className="absolute inset-0 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Cpu className="w-10 h-10 text-blue-600 animate-pulse" />
        </div>
      </div>
      <p className="text-[10px] font-black text-blue-600 tracking-[0.3em] uppercase mb-3 italic">NPS Analytics v5.0</p>
      <p className="text-slate-800 font-bold text-[14px] mb-1">데이터 분석 중...</p>
      <p className="text-slate-500 font-bold text-[11px]">{SCAN_MESSAGES[msgIdx]}</p>
      <div className="w-full mt-8 space-y-3 opacity-30">
        <Sk className="h-6 w-3/4 mx-auto" /><Sk className="h-20 w-full" /><Sk className="h-4 w-1/2 mx-auto" />
      </div>
    </div>
  );

  return (
    <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[440px] h-full bg-[#fdfdfd] border-l border-slate-200 flex flex-col z-10 overflow-y-auto custom-scrollbar relative shrink-0">

      {/* ── 로드뷰 ── */}
      <div className="w-full h-[180px] lg:h-[220px] bg-slate-100 relative overflow-hidden border-b border-slate-200 shrink-0">
        <div ref={roadviewRef} className="w-full h-full scale-[1.05]" />
        <div className="absolute top-4 left-4 z-10">
          <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/20">Interactive View</span>
        </div>
      </div>

      {/* ── NPS Score Header ── */}
      <div className="p-5 bg-white border-b border-slate-100 shrink-0">

        {/* 추정 경고 */}
        {analysis?.isEstimated && (
          <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <Info size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[9px] font-bold text-amber-700">해당 매물의 직접 거래 기록 없음 — 지역 평균값으로 추정</p>
          </div>
        )}

        <div className="flex items-start gap-1 mb-3">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <h2 className="text-[13px] font-black text-[#0f172a] tracking-tighter leading-tight">
            [{details.bldNm || selectedBuilding.label}] 종합 진단
          </h2>
        </div>

        {/* ── 거래 유형 + 금액 강조 표시 ── */}
        <div className={`rounded-2xl p-4 mb-4 ${isMonthly ? 'bg-orange-50 border border-orange-100' : 'bg-blue-50 border border-blue-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isMonthly ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}>
              {txType}
            </span>
            {analysis?.isEstimated && (
              <span className="text-[8px] font-bold text-slate-400 bg-white/80 px-1.5 py-0.5 rounded-full">추정</span>
            )}
          </div>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-[8px] font-bold text-slate-400 mb-0.5">보증금</p>
              <p className={`text-[26px] font-black leading-none tracking-tighter ${isMonthly ? 'text-orange-600' : 'text-blue-700'}`}>
                {deposit === '데이터 없음' ? '데이터 없음' : (Number(deposit) > 0 ? `${Number(deposit).toLocaleString()}만원` : '데이터 없음')}
              </p>
            </div>
            {isMonthly && (
              <div className="pb-0.5">
                <p className="text-[8px] font-bold text-slate-400 mb-0.5">월세</p>
                <p className="text-[18px] font-black text-orange-500">
                  / {monthly === '데이터 없음' ? '데이터 없음' : (Number(monthly) > 0 ? `${Number(monthly).toLocaleString()}만원` : '없음')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* NPS 원형 + 세부 바 */}
        <div className="flex items-center gap-5">
          <div className="relative w-22 h-22 shrink-0" style={{ width: 88, height: 88 }}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="44" stroke="#f1f5f9" strokeWidth="8" fill="none" />
              <circle cx="48" cy="48" r="44" stroke={colors.stroke} strokeWidth="8" fill="none"
                strokeDasharray="276.46" strokeDashoffset={276.46 * (1 - score / 100)}
                style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[26px] font-black text-slate-800 leading-none">{score}</span>
              <span className="text-[7px] font-bold text-slate-400 mt-0.5">NPS Score</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-1.5">
            <span className={`text-center px-3 py-1.5 rounded-lg text-[10px] font-black text-white mb-1 ${colors.bg}`}>
              {colors.label}
            </span>
            {breakItems.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-400 w-12 shrink-0 truncate">{item.label}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.v}%`, backgroundColor: item.color, transition: 'width 0.7s ease' }} />
                </div>
                <span className="text-[8px] font-black w-5 text-right" style={{ color: item.color }}>{item.v}</span>
              </div>
            ))}
          </div>
        </div>
        <SourceLabel text="국토교통부 실거래가 / 브이월드 / 건축HUB" />
      </div>

      <div className="p-4 lg:p-5 space-y-6">

        {/* ── 실거래 추이 ── */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[12px] font-black text-slate-800 flex items-center gap-2">
              <Database size={13} className="text-blue-600" /> MOLIT 실거래 추이
            </h3>
            <span className="text-[7px] font-bold text-slate-400 uppercase bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">전세·매매 12개월</span>
          </div>
          <div className="h-[120px] bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#94a3b8' }} />
                <YAxis hide />
                <RechartsTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="rent" stroke="#2563eb" strokeWidth={2.5} dot={false} name="전세" connectNulls={true} />
                <Line type="monotone" dataKey="trade" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="매매" connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <SourceLabel text="국토교통부 실거래가정보 (RTMSDataSvc)" />
        </section>

        {/* ── 가격 벤치마크 ── */}
        <section>
          <h3 className="text-[12px] font-black text-slate-800 flex items-center gap-2 mb-3">
            <Home size={13} className="text-blue-600" /> 가격 벤치마크
          </h3>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="h-[90px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: '본 매물', val: marketVal / 1000 },
                    { name: '지역 전세평균', val: avgRentVal / 1000 },
                    ...(officialTotal > 0 ? [{ name: '공시지가 환산', val: officialTotal / 1000 }] : []),
                  ]}
                  barCategoryGap="25%"
                >
                  <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip formatter={v => [`${(v * 1000).toLocaleString()}만원`]} contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                  <Bar dataKey="val" radius={[5, 5, 0, 0]} barSize={26}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#e2e8f0" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 전세가율 진단 */}
            <div className={`rounded-xl px-4 py-2.5 border text-[10px] font-bold ${ratioCls}`}>
              <span className="font-black mr-1">보증금 보호:</span>
              {details.ratioDiagnosis || (officialTotal > 0 ? '공시지가 대비 분석 중' : '지가 정보 미등록')}
            </div>
            <SourceLabel text="브이월드 개별공시지가(LT_C_PH_LANDPRICE) · 국토교통부 실거래가 API" />
          </div>
        </section>

        {/* ── Safety Analysis (Radar & Report) ── */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[12px] font-black text-slate-800 flex items-center gap-2">
              <ShieldAlert size={13} className="text-purple-600" /> 데이터 기반 안심 리포트
            </h3>
            <span className={`text-[7px] font-bold px-2 py-0.5 rounded-full border ${safeSource === 'analysis_report' ? 'bg-purple-50 text-purple-600 border-purple-100'
                  : 'bg-slate-50 text-slate-400 border-slate-100'
              }`}>
              {safeSource === 'analysis_report' ? 'REPORT READY' : 'LOADING...'}
            </span>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            {/* 치안 상태 종합 진단 메시지 카드 */}
            <div className={`rounded-xl px-3 py-2.5 text-[10px] font-bold flex flex-col gap-1.5 ${zoneStatus === 'danger' ? 'bg-red-50 text-red-700 border border-red-100'
                : zoneStatus === 'caution' ? 'bg-amber-50 text-amber-700 border border-amber-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <CheckCircle2 size={13} />
                <span className="text-[11px] font-black tracking-tight">종합 안심 진단 : {zoneStatus === 'danger' ? '방범 취약 (위험)' : zoneStatus === 'caution' ? '일반 (주의)' : '우수 (안전)'}</span>
              </div>
              <span className="font-medium opacity-85 leading-snug">{warningMsg || (loading ? '안전망 평가 진행 중...' : '')}</span>
            </div>

            <div className="flex gap-2 items-center">
              {/* 접근성 팩트체크 배지 */}
              <div className="w-[110px] shrink-0 bg-purple-50 border border-purple-100 rounded-xl p-3 flex flex-col items-center justify-center text-center h-[110px]">
                <ShieldCheck size={22} className="text-purple-500 mb-1.5" />
                <p className="text-[16px] font-black text-purple-700 tracking-tight">{safemap.accessGrade || '-'}</p>
                <p className="text-[8px] font-bold text-purple-500 mt-1">경찰관서 접근성</p>
                <p className="text-[7px] font-medium text-purple-600/60 mt-0.5">({safemap.policeDist ? `${safemap.policeDist}m 내외` : '-'})</p>
              </div>

              {/* 축소된 안전 지수 레이더 차트 */}
              <div className="flex-1 h-[110px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <PolarGrid stroke="#f1f5f9" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8.5, fill: '#64748b', fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="안전지수" dataKey="score" stroke="#9333ea" fill="#a855f7" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <SourceLabel text={safeSourceLabel} />
          </div>
        </section>

        {/* ── 건물 Attributes ── */}
        <section className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">건물 Attributes</h3>
            {/* 위반건축물 뱃지 */}
            <span className={`ml-auto text-[10px] font-black px-2.5 py-1 rounded-full ${viloIsVio ? 'bg-red-600 text-white animate-pulse shadow-md border border-red-700'
                : viloUnknown ? 'bg-slate-100 text-slate-400'
                  : 'bg-emerald-100 text-emerald-600'
              }`}>
              {viloIsVio ? '🚨 위반건축물 등재 이력 있음' : viloUnknown ? '정보없음' : '✓ 정상'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-4">
            {/* ── Structure ── */}
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Structure</span>
              <div className="text-[10px] font-black text-slate-800 truncate">{details.structure || '정보 없음'}</div>
            </div>

            {/* ── Purpose ── */}
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Purpose</span>
              <div className="text-[10px] font-black text-slate-800 truncate">{details.purpose || '정보 없음'}</div>
            </div>

            {/* ── Energy Efficiency (Full Row for better visibility) ── */}
            {building.energy && !['정보 없음', '0', 'None', ''].includes(building.energy) && (
              <div className="col-span-2">
                <div className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 font-black px-2 py-1 rounded-lg text-[9px] border border-orange-200 shadow-sm">
                  <Zap size={11} className="fill-orange-500 text-orange-500" />
                  <span>에너지 효율 등급: {building.energy}</span>
                </div>
              </div>
            )}

            {/* ── Build Year ── */}
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Build Year</span>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-800">
                <Calendar size={13} className="text-slate-400" />
                <span>{details.buildYear ? `${details.buildYear}년 (${details.buildAge}년 경과)` : '정보 없음(현장 확인)'}</span>
              </div>
            </div>

            {/* ── Floors ── */}
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Floors</span>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-800">
                <Building2 size={13} className="text-slate-400" />
                <span className="truncate">{building.floorInfo || details.floorInfo || '정보 없음(현장 확인)'}</span>
              </div>
            </div>

            {/* ── Parking ── */}
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Parking</span>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-800">
                <span>🚗</span>
                <div className="flex items-center gap-1">
                  {(building.parking && building.parking !== '0') ? (
                    <span className="truncate">{isNaN(building.parking) ? building.parking : `총 ${building.parking}대`}</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-[4px] text-[9px] font-bold">정보 없음</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Elevator ── */}
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Elevator</span>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-800">
                <span>🛗</span>
                <div className="flex items-center gap-1">
                  {(building.lifts && building.lifts !== '0' && building.lifts !== '현장 확인 필요') ? (
                    <span className="truncate">{isNaN(building.lifts) ? building.lifts : `승용 ${building.lifts}대`}</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-[4px] text-[9px] font-bold">정보 없음</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Area + 평수 (전체 너비 강조) ── */}
            <div className="col-span-2 mt-1 pt-3 border-t border-slate-100 flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Area</span>
              <div className="flex items-center gap-2 text-[11px]">
                <span>📐</span>
                {(building.area_formatted || details.area_formatted || building.areaFmt) ? (
                  <div className="flex items-baseline gap-1.5 font-black text-slate-800">
                    <span className="text-[12px]">{(building.area_formatted || details.area_formatted || building.areaFmt).split('(')[0].trim()}</span>
                    {(building.area_formatted || details.area_formatted || building.areaFmt).includes('(') && (
                      <span className="font-semibold text-slate-400 text-[9px]">
                         ({(building.area_formatted || details.area_formatted || building.areaFmt).split('(')[1]}
                      </span>
                    )}
                  </div>
                ) : (building.area || details.area) ? (
                  <span className="font-black text-slate-800">
                    {building.area || details.area}m²
                    <span className="font-semibold text-slate-400 ml-1 text-[9px]">(약 {Math.round((building.area || details.area) * 0.3025)}평)</span>
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium italic">정보 미등록</span>
                )}
              </div>
            </div>
          </div>
          <SourceLabel text="브이월드 건물정보 · 건축HUB 건축물대장 API" />
        </section>

        {/* ── 쓰레기 배출 ── */}
        <WasteCard regionName={regionName || selectedBuilding?.regionName} />

        {/* ── 팩트 기반 진단 ── */}
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-[10px] font-black text-slate-800 tracking-widest uppercase flex items-center gap-2">
            <Zap size={12} className="text-blue-600" /> 종합 진단 (공공데이터 팩트)
          </h3>
          {[
            { text: diagnosis.age || '건물 노후도 분석 중', ok: (npsBreak.age || 60) >= 60 },
            { text: diagnosis.violation || '위반건축물 이력 조회 중', ok: !viloIsVio },
            { text: diagnosis.ratio || '전세가율 데이터 조회 중', ok: rs === 'safe' },
            { text: diagnosis.security || '치안 지수 분석 중', ok: (safemap.securityScore || 60) >= 65 },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                {item.ok
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  : <AlertTriangle className="w-3 h-3 text-amber-500" />
                }
              </div>
              <span className="text-[10px] font-bold text-slate-700 leading-relaxed">{item.text}</span>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
};

export default RightPanel;
