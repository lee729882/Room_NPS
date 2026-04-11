import React, { useState, useEffect, useRef } from 'react';
import { Search, Map as MapIcon, ShieldCheck, User, Users, Settings, LayoutGrid, ChevronRight, Filter, Database, Bell } from 'lucide-react';
import RightPanel from './components/RightPanel';

const PropertyItem = ({ item, isSelected, onClick }) => {
  const rvRef = useRef(null);
  const [hasPhoto, setHasPhoto] = useState(false);

  useEffect(() => {
    if (window.kakao && window.kakao.maps && rvRef.current) {
      // 기존 내용 초기화 (중복 방지)
      rvRef.current.innerHTML = '';
      
      const rv = new window.kakao.maps.Roadview(rvRef.current);
      const rvClient = new window.kakao.maps.RoadviewClient();
      const pos = new window.kakao.maps.LatLng(item.lat, item.lng);
      
      rvClient.getNearestPanoId(pos, 50, (id) => {
        if (id) {
          rv.setPanoId(id, pos);
          // 0.5초 후 시점 조정 (로드 완료 대기)
          setTimeout(() => {
             rv.setViewpoint({ pan: 0, tilt: 0, zoom: 0 });
             setHasPhoto(true);
          }, 500);
        }
      });
    }
  }, [item.lat, item.lng]);

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
        <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200 relative">
          <div 
            ref={rvRef} 
            className={`w-[200%] h-[200%] scale-[0.5] origin-top-left rv-thumbnail transition-opacity duration-500 ${hasPhoto ? 'opacity-100' : 'opacity-0'}`}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-slate-50/50">
             <MapIcon size={18} className="text-slate-300 opacity-40" />
          </div>
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
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

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

  useEffect(() => {
    if (window.kakao && window.kakao.maps && !mapInstance.current) {
      const options = {
        center: new window.kakao.maps.LatLng(37.492361, 127.035544),
        level: 4
      };
      const map = new window.kakao.maps.Map(mapRef.current, options);
      mapInstance.current = map;

      const geocoder = new window.kakao.maps.services.Geocoder();

      window.kakao.maps.event.addListener(map, 'idle', () => {
        const center = map.getCenter();
        geocoder.coord2RegionCode(center.getLng(), center.getLat(), (result, status) => {
          if (status === window.kakao.maps.services.Status.OK) {
            const bjd = result.find(r => r.region_type === 'B');
            if (bjd) {
              fetchNearby(bjd.code, bjd.address_name);
            }
          }
        });
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
            // 법정동 + 건물명 또는 법정동 + 지번으로 가장 정확한 위치 검색
            // "본 매물" 같은 더미 단어가 포함되지 않은 진짜 건물명을 우선시함
            const cleanLabel = label.includes('매물') ? "" : label;
            const fullAddr = regionName ? `${regionName} ${cleanLabel || addr}` : (cleanLabel || addr);
            
            if (!addr.trim() && !cleanLabel.trim()) {
               return resolve({ ...item, lat: center.getLat(), lng: center.getLng() });
            }
            geocoder.addressSearch(fullAddr, (result, status) => {
              if (status === window.kakao.maps.services.Status.OK) {
                // 매물간 변별력을 위해 정밀한 오차 부여 (0.00005도 ~= 약 5m)
                const offsetLat = (Math.random() - 0.5) * 0.00005;
                const offsetLng = (Math.random() - 0.5) * 0.00005;
                resolve({ ...item, lat: parseFloat(result[0].y) + offsetLat, lng: parseFloat(result[0].x) + offsetLng });
              } else {
                // 실패 시 검색 지역 중심부 주변에 분산 배치
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

        // 1km 반경 필터링
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
          ji: ji 
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

        <div ref={mapRef} className="flex-1 min-w-0 bg-slate-200 relative overflow-hidden">
           <div className="absolute top-4 left-4 z-10 flex gap-1">
              <button className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-[10px] font-bold shadow-sm flex items-center gap-1.5 text-blue-600 border-b-2 border-b-blue-600 uppercase tracking-tighter">Verified Area</button>
              <button className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-[10px] font-bold shadow-sm text-slate-600">Building Filter</button>
           </div>
        </div>

        <RightPanel selectedBuilding={selectedBuilding} />
      </main>
    </div>
  );
}

export default App;
