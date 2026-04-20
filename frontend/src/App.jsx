import React, { useState, useEffect, useRef } from 'react';
import { Search, Map as MapIcon, ShieldCheck, User, Users, Settings, LayoutGrid, ChevronRight, Filter, Database, Bell } from 'lucide-react';
import RightPanel from './components/RightPanel';

const PropertyItem = ({ item, isSelected, onClick }) => {
  // Roadview 제거 - 성능 최적화 (목록에 수십개의 로드뷰를 띄우는 것이 렉의 주원인)
  return (
    <div 
      onClick={onClick}
      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
        isSelected 
          ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300' 
          : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
      }`}
    >
      <div className="flex gap-2.5">
        <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200 relative flex items-center justify-center">
            <MapIcon size={24} className="text-slate-300 opacity-40" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <span className="text-[11.5px] font-black text-slate-800 truncate leading-tight uppercase tracking-tighter">{item.label}</span>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mb-1 truncate tracking-tighter">Jibun: {item.sub}</p>
          <div className="flex justify-between items-end">
             <span className="text-[12.5px] font-black text-blue-600 tracking-tighter">{item.price}</span>
             <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                item.year > '2015' ? 'bg-[#22c55e] text-white' : 'bg-[#f59e0b] text-white'
             }`}>{item.year > '2015' ? 'Safe' : 'Caution'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('강남구 역삼동');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showCctv, setShowCctv] = useState(false);
  const showHeatmapRef = useRef(false);
  const showCctvRef = useRef(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const currentRegionRef = useRef('서울특별시 강남구 역삼동');
  const wmsOverlaysRef = useRef({ crime: null, cctv: null });

  const handleSearch = () => {
    if (!searchQuery.trim() || !window.kakao) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    
    setListings([]);
    setSelectedBuilding(null);
    
    geocoder.addressSearch(searchQuery, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK && mapInstance.current) {
        const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
        mapInstance.current.panTo(coords);
        mapInstance.current.setLevel(4);
      } else {
        alert('검색 결과가 없습니다. 지역명을 정확히 입력해주세요.');
      }
    });
  };

  // ── 커스텀 GroundOverlay 클래스 팩토리 ──
  const getGroundOverlayClass = () => {
    if (window.KaKaoGroundOverlayClass) return window.KaKaoGroundOverlayClass;

    function GroundOverlay(bounds, imgSrc, zIndex, opacity) {
        this.bounds = bounds;
        let node = document.createElement('div');
        node.style.position = 'absolute';
        node.style.zIndex = zIndex || 1;
        let img = document.createElement('img');
        img.src = imgSrc;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.opacity = opacity || 1;
        img.style.pointerEvents = 'none';
        node.appendChild(img);
        this.node = node;
    }

    if (window.kakao && window.kakao.maps) {
        GroundOverlay.prototype = new window.kakao.maps.AbstractOverlay();
        
        GroundOverlay.prototype.onAdd = function() {
            let panel = this.getPanels().overlayLayer;
            panel.appendChild(this.node);
        };

        GroundOverlay.prototype.draw = function() {
            if (!this.getMap()) return;
            let projection = this.getProjection();
            let ne = projection.pointFromCoords(this.bounds.getNorthEast());
            let sw = projection.pointFromCoords(this.bounds.getSouthWest());
            
            let width = ne.x - sw.x;
            let height = sw.y - ne.y;
            
            this.node.style.top = ne.y + 'px';
            this.node.style.left = sw.x + 'px';
            this.node.style.width = width + 'px';
            this.node.style.height = height + 'px';
        };

        GroundOverlay.prototype.onRemove = function() {
            if (this.node && this.node.parentNode) {
                this.node.parentNode.removeChild(this.node);
            }
        };
    }

    window.KaKaoGroundOverlayClass = GroundOverlay;
    return GroundOverlay;
  };

  // ── WMS 오버레이 업데이트 (범죄 히트맵 / CCTV) ──
  const updateWmsOverlay = (type, map) => {
    if (!map) return;

    // 이전 오버레이 제거 (잔상/메모리 누수 방지)
    if (wmsOverlaysRef.current[type]) {
      wmsOverlaysRef.current[type].setMap(null);
      wmsOverlaysRef.current[type] = null;
    }

    const bounds  = map.getBounds();
    const sw      = bounds.getSouthWest();
    const ne      = bounds.getNorthEast();
    const bbox    = `${sw.getLng().toFixed(6)},${sw.getLat().toFixed(6)},${ne.getLng().toFixed(6)},${ne.getLat().toFixed(6)}`;
    
    // 래퍼 div 크기로 이미지 요청
    const wrapper = document.getElementById('map-wrapper');
    const w = wrapper ? wrapper.clientWidth  : 800;
    const h = wrapper ? wrapper.clientHeight : 600;

    let params = `srs=EPSG:4326&bbox=${bbox}&width=${w}&height=${h}&transparent=TRUE&format=image/png`;
    if (type === 'crime') {
      params += `&cid=IF_0087&layers=A2SM_CRMNLHSPOT_TOT&styles=A2SM_CrmnlHspot_Tot_Tot`;
    } else {
      // CCTV 레이어
      params += `&cid=IF_0073&layers=A2SM_Cctv_Tot&styles=A2SM_Cctv_Tot`;
    }

    const src = `http://localhost:5000/api/safemap/proxy?${params}`;

    // 디버깅: 개발자가 브라우저에서 직접 확인할 수 있도록 전체 URL 출력
    console.log(`[WMS 디버깅] ${type} 레이어 전체 URL:\n${src}\n(해당 URL을 브라우저에 직접 입력하여 이미지가 표시되는지 확인하세요.)`);

    // 카카오맵 AbstractOverlay를 상속한 GroundOverlay로 띄우기
    const GroundOverlayClass = getGroundOverlayClass();
    const zIndex = type === 'crime' ? 1 : 2;
    const opacity = type === 'crime' ? 0.55 : 0.8;
    
    // Bounds 기반으로 새로운 GroundOverlay를 생성 (잔상 및 줌 문제 해결)
    const overlay = new GroundOverlayClass(bounds, src, zIndex, opacity);

    overlay.setMap(map);
    wmsOverlaysRef.current[type] = overlay;
  };

  // State 변경 시 최신 상태를 ref에 동기화 & 토글 OFF 시 오버레이 즉시 제거
  useEffect(() => {
    showHeatmapRef.current = showHeatmap;
    if (showHeatmap && mapInstance.current) {
      updateWmsOverlay('crime', mapInstance.current);
    } else if (!showHeatmap && wmsOverlaysRef.current.crime) {
      wmsOverlaysRef.current.crime.setMap(null);
      wmsOverlaysRef.current.crime = null;
    }
  }, [showHeatmap]);

  useEffect(() => {
    showCctvRef.current = showCctv;
    if (showCctv && mapInstance.current) {
      updateWmsOverlay('cctv', mapInstance.current);
    } else if (!showCctv && wmsOverlaysRef.current.cctv) {
      wmsOverlaysRef.current.cctv.setMap(null);
      wmsOverlaysRef.current.cctv = null;
    }
  }, [showCctv]);

  useEffect(() => {
    if (window.kakao && window.kakao.maps && !mapInstance.current) {
      const options = {
        center: new window.kakao.maps.LatLng(37.492361, 127.035544),
        level: 4
      };
      const map = new window.kakao.maps.Map(mapRef.current, options);
      mapInstance.current = map;

      const geocoder = new window.kakao.maps.services.Geocoder();

      let searchTimeout;
      window.kakao.maps.event.addListener(map, 'idle', () => {
        // Debounce: 500ms 동안 멈춰있을 때만 호출
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const center = map.getCenter();
          geocoder.coord2RegionCode(center.getLng(), center.getLat(), (result, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
              const bjd = result.find(r => r.region_type === 'B');
              if (bjd) {
                currentRegionRef.current = bjd.address_name;
                fetchNearby(bjd.code, bjd.address_name);
              }
            }
          });
          // 히트맵/CCTV 활성화되어 있으면 지도 이동 시 갱신
          if (showHeatmapRef.current) updateWmsOverlay('crime', map);
          if (showCctvRef.current)    updateWmsOverlay('cctv', map);
        }, 500);
      });

      fetchNearby('1168010100', '서울특별시 강남구 역삼동'); 
    }
  }, []);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 지오코딩 결과 캐시 (성능 최적화)
  const geocodeCache = useRef({});

  const fetchNearby = async (code, regionName) => {
    try {
      const res = await fetch(`http://localhost:5000/api/nearby?code=${code}`);
      const data = await res.json();
      if (data.listings) {
        const geocoder = new window.kakao.maps.services.Geocoder();
        const center = mapInstance.current.getCenter();
        
        const enrichedListings = await Promise.all(data.listings.map(item => {
          return new Promise((resolve) => {
            const addr = item.sub || "";
            const label = item.label || "";
            const cleanLabel = label.includes('매물') ? "" : label;
            const fullAddr = regionName ? `${regionName} ${cleanLabel || addr}` : (cleanLabel || addr);
            
            // 캐시 확인
            if (geocodeCache.current[fullAddr]) {
              return resolve({ ...item, ...geocodeCache.current[fullAddr] });
            }

            if (!addr.trim() && !cleanLabel.trim()) {
               return resolve({ ...item, lat: center.getLat(), lng: center.getLng() });
            }

            geocoder.addressSearch(fullAddr, (result, status) => {
              if (status === window.kakao.maps.services.Status.OK) {
                const offsetLat = (Math.random() - 0.5) * 0.00005;
                const offsetLng = (Math.random() - 0.5) * 0.00005;
                const coords = { lat: parseFloat(result[0].y) + offsetLat, lng: parseFloat(result[0].x) + offsetLng };
                // 캐시에 저장
                geocodeCache.current[fullAddr] = coords;
                resolve({ ...item, ...coords });
              } else {
                const spread = 0.003;
                resolve({ 
                  ...item, 
                  lat: center.getLat() + (Math.random() - 0.5) * spread, 
                  lng: center.getLng() + (Math.random() - 0.5) * spread 
                });
              }
            });
          });
        }));

        const filtered = enrichedListings.filter(item => {
          const dist = getDistance(center.getLat(), center.getLng(), item.lat, item.lng);
          return dist <= 1.0; 
        });

        setListings(filtered);
        setStats({ ...data.stats, count: filtered.length });
        updateMarkers(filtered);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
  };

  const updateMarkers = (items) => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    
    const newMarkers = items.map(item => {
      const isSafe = item.year > '2015';
      const color = isSafe ? '#2563eb' : '#f59e0b';
      
      const content = document.createElement('div');
      content.className = `flex flex-col items-center cursor-pointer transition-transform hover:scale-110`;
      content.innerHTML = `
        <div class="bg-white px-2 py-1 rounded-md shadow-md border-2 border-[${color}] mb-1">
          <span class="text-[10px] font-black pointer-events-none" style="color: ${color}">${item.price}</span>
        </div>
        <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style="border-t-color: ${color}"></div>
      `;
      
      content.onclick = () => handleAnalyze(item);

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(item.lat, item.lng),
        content: content,
        yAnchor: 1.0
      });

      overlay.setMap(mapInstance.current);
      return overlay;
    });
    markersRef.current = newMarkers;
  };

  const handleAnalyze = async (item) => {
    if (!item) return;
    setSelectedBuilding({ ...item, loading: true });
    try {
      const bun = item.sub?.split('-')[0] || '0';
      const ji = item.sub?.split('-')[1] || '0';
      const res = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: item.code || '1168010100', 
          buildingName: item.label || '', 
          bun: bun, 
          ji: ji,
          lat: item.lat || 37.5,
          lng: item.lng || 127.0,
          regionName: currentRegionRef.current || '',
        })
      });
      const data = await res.json();
      setSelectedBuilding({ ...item, analysis: data, loading: false });
    } catch (e) {
      console.error("Analysis error:", e);
      setSelectedBuilding({ ...item, loading: false });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden text-slate-900">
      <header className="h-14 px-3 md:px-5 bg-white border-b border-slate-200 flex items-center justify-between z-20">
        <div className="flex items-center gap-4 lg:gap-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center text-white">
              <ShieldCheck size={18} strokeWidth={3} />
            </div>
            <h1 className="text-sm md:text-base font-extrabold text-[#1a2b4b] tracking-tighter truncate max-w-[120px] md:max-w-none">주거시설 통합 안심 진단</h1>
          </div>
          <nav className="hidden md:flex items-center gap-4 lg:gap-7 text-[12px] lg:text-[13px] font-bold text-slate-400">
            <span className="text-blue-600 flex items-center gap-1.5 cursor-pointer border-b-2 border-blue-600 h-14"><LayoutGrid size={15}/> 대시보드</span>
            <span className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5"><Search size={15}/> 검색</span>
            <span className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5"><User size={15}/> 내 매물</span>
            <span className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5"><Users size={15}/> 커뮤니티</span>
            <span className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5"><Settings size={15}/> 설정</span>
          </nav>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <Bell className="w-5 h-5 text-slate-300 cursor-pointer" />
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
            <User size={18} />
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-64 lg:w-72 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-300" size={15} />
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-12 text-xs font-bold focus:outline-none"
                  placeholder="지역구, 건물명 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button 
                  onClick={handleSearch}
                  className="absolute right-1.5 top-1.5 bg-blue-600 text-white p-1 rounded-md"
                >
                   <Search size={14} />
                </button>
             </div>
             <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                   <span className="text-slate-400">매물 유형</span>
                   {stats && <span className="text-blue-600 whitespace-nowrap">검색결과: {stats.count}건</span>}
                </div>
                <div className="flex gap-1">
                   <button className="bg-blue-50 text-blue-600 text-[10px] font-bold px-3 py-1.5 rounded-full border border-blue-100 uppercase">Multi-Family</button>
                   <button className="bg-white text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-full border border-slate-100">Apartment</button>
                </div>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#fdfdfd]">
            <div className="flex justify-between items-center px-1 mb-1">
               <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-tighter">Nearby Real-Trades</span>
               <span className="text-[9px] font-bold text-blue-600 cursor-pointer tracking-tighter">v3.0 Data Fusion</span>
            </div>
            {listings.map(item => (
              <PropertyItem 
                key={item.id} 
                item={item} 
                isSelected={selectedBuilding?.id === item.id} 
                onClick={() => handleAnalyze(item)} 
              />
            ))}
          </div>
        </aside>

        {/* ── 지도 + 오버레이 래퍼 ── */}
        <div className="flex-1 min-w-0 relative overflow-hidden bg-slate-200" id="map-wrapper">
          {/* Kakao 지도 컨테이너 (Kakao가 내부 DOM 생성) */}
          <div ref={mapRef} className="absolute inset-0" />

          {/* ── 지도 컨트롤 버튼 ── */}
          <div className="absolute top-4 left-4 flex gap-1.5 flex-wrap" style={{ zIndex: 100 }}>
            <button className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-[10px] font-bold shadow-sm flex items-center gap-1.5 text-blue-600 border-b-2 border-b-blue-600 uppercase tracking-tighter">
              Verified Area
            </button>
            
            {/* 범죄 히트맵 토글 */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold shadow-sm border transition-all ${
                showHeatmap
                  ? 'bg-red-600 text-white border-red-700 border-b-2 border-b-red-800 shadow-red-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showHeatmap ? 'bg-red-200 animate-pulse' : 'bg-slate-300'}`}/>
              치안 히트맵
            </button>

            {/* CCTV 토글 */}
            <button
              onClick={() => setShowCctv(!showCctv)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold shadow-sm border transition-all ${
                showCctv
                  ? 'bg-indigo-600 text-white border-indigo-700 border-b-2 border-b-indigo-800 shadow-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showCctv ? 'bg-indigo-200 animate-pulse' : 'bg-slate-300'}`}/>
              CCTV 위치
            </button>
          </div>

          {/* 히트맵 범례 */}
          {showHeatmap && (
            <div className="absolute bottom-6 left-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 shadow-lg text-[9px] font-bold" style={{ zIndex: 100 }}>
              <p className="text-slate-700 mb-2 font-black text-[10px]">🔴 범죄주의구간 (전체)</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex gap-0.5">
                  <div className="w-5 h-3 rounded-sm bg-red-700"/>
                  <div className="w-5 h-3 rounded-sm bg-red-400"/>
                  <div className="w-5 h-3 rounded-sm bg-orange-300"/>
                  <div className="w-5 h-3 rounded-sm bg-yellow-100"/>
                </div>
                <span className="text-slate-500">주의 구간 → 안전 구간</span>
              </div>
              <p className="text-slate-400">출처: 생활안전지도 IF_0087_WMS</p>
            </div>
          )}
        </div>

        <RightPanel selectedBuilding={selectedBuilding} regionName={currentRegionRef.current} />
      </main>
    </div>
  );
}

export default App;
