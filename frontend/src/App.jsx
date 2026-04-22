import React, { useState, useEffect, useRef } from 'react';
import { Search, Map as MapIcon, ShieldCheck, User, Users, Settings, LayoutGrid, ChevronRight, Filter, Database, Bell, Home, Building2, Cpu } from 'lucide-react';
import RightPanel from './components/RightPanel';

const PropertyItem = ({ item, isSelected, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const thumbnailUrl = item.thumbnail;

  return (
    <div
      onClick={onClick}
      className={`group p-3 rounded-2xl border cursor-pointer transition-all duration-300 ${isSelected
          ? 'bg-blue-50/80 border-blue-200 ring-2 ring-blue-500/20'
          : 'bg-white border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md'
        }`}
    >
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden border border-slate-100 relative shadow-inner group-hover:border-blue-200 transition-all duration-300">
          {/* ── Base Layer: Type-based Theme Icons ── */}
          {(() => {
            const isAptOff = item.apiType?.includes('APT') || item.apiType?.includes('OFF');
            const typeLabel = item.apiType?.includes('APT') ? '아파트' : (item.apiType?.includes('OFF') ? '오피스텔' : '빌라/주택');
            
            return (
              <div className={`flex flex-col items-center justify-center w-full h-full ${
                isAptOff ? 'bg-sky-50' : 'bg-emerald-50'
              }`}>
                {isAptOff ? (
                  <Building2 size={24} className="text-sky-600 mb-1" />
                ) : (
                  <Home size={24} className="text-emerald-600 mb-1" />
                )}
                <span className={`text-[8px] font-black uppercase tracking-tighter ${
                  isAptOff ? 'text-sky-700' : 'text-emerald-700'
                }`}>
                  {typeLabel}
                </span>
              </div>
            );
          })()}

          {/* ── Top Layer: Real Thumbnail (Hidden if Error) ── */}
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={item.label}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                imageError ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'
              }`}
              onError={() => setImageError(true)}
            />
          )}

          {/* Status Indicator Dot */}
          <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white shadow-sm z-10 ${
            item.year > '2015' ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
        </div>

        {/* ── Info Section ── */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <div className="flex justify-between items-start mb-0.5">
              <span className="text-[12.5px] font-black text-slate-800 truncate leading-none uppercase tracking-tighter group-hover:text-blue-700 transition-colors">
                {item.label}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-bold truncate tracking-tight">
              Jibun: {item.jibun || '정보 없음'}
            </p>
          </div>

          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-0.5">
                {item.txType === '월세' ? 'Rent Price' : 'Estimated Price'}
              </span>
              <span className="text-[14px] font-black text-blue-600 tracking-tighter leading-none">
                {item.txType === '월세' 
                  ? `월세 ${item.rawPrice}/${item.monthly}만원` 
                  : `${item.txType} ${item.price}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${item.year > '2015' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                {item.year > '2015' ? 'Safe' : 'Caution'}
              </span>
            </div>
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
  const [filterType, setFilterType] = useState('ALL');
  const [isListLoading, setIsListLoading] = useState(false);
  const showHeatmapRef = useRef(false);
  const fetchIdRef = useRef(0);

  const handleComingSoon = (menuName) => {
    alert(`🚧 [${menuName}] 기능은 현재 개발 로드맵 상 다음 페이스에 예정되어 있습니다!\n\n이번 중간발표에서는 핵심 코어인 'NPS 기반 안심 진단 엔진'과 'AI 법률 리포트' 구현에 100% 집중했습니다. 최종 버전을 기대해 주세요! 🚀`);
  };

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const currentRegionRef = useRef('서울특별시 강남구 역삼동');
  const wmsOverlaysRef = useRef({ crime: null });

  const handleSearch = () => {
    if (!searchQuery.trim() || !window.kakao) return;
    const geocoder = new window.kakao.maps.services.Geocoder();

    setListings([]);
    setSelectedBuilding(null);

    geocoder.addressSearch(searchQuery, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK && mapInstance.current) {
        setIsListLoading(true);
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

      GroundOverlay.prototype.onAdd = function () {
        let panel = this.getPanels().overlayLayer;
        panel.appendChild(this.node);
      };

      GroundOverlay.prototype.draw = function () {
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

      GroundOverlay.prototype.onRemove = function () {
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

    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const bbox = `${sw.getLng().toFixed(6)},${sw.getLat().toFixed(6)},${ne.getLng().toFixed(6)},${ne.getLat().toFixed(6)}`;

    // 래퍼 div 크기로 이미지 요청
    const wrapper = document.getElementById('map-wrapper');
    const w = wrapper ? wrapper.clientWidth : 800;
    const h = wrapper ? wrapper.clientHeight : 600;

    let params = `srs=EPSG:4326&bbox=${bbox}&width=${w}&height=${h}&transparent=TRUE&format=image/png`;
    if (type === 'crime') {
      params += `&cid=IF_0087&layers=A2SM_CRMNLHSPOT_TOT&styles=A2SM_CrmnlHspot_Tot_Tot`;
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
        // [1] 지도 중심 좌표 및 화면 범위(Bounds) 획득
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const requestId = ++fetchIdRef.current;
          setIsListLoading(true);

          const center = map.getCenter();
          const bounds = map.getBounds();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();

          // [2] 중심 좌표 기반 리버스 지오코딩으로 최신 법정동 코드 추출
          geocoder.coord2RegionCode(center.getLng(), center.getLat(), (result, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
              // 법정동(B)이 없으면 첫 번째 결과(행정동 등)라도 사용하도록 폴백 추가
              const bjd = result.find(r => r.region_type === 'B') || result[0];
              if (bjd && bjd.code) {
                currentRegionRef.current = bjd.address_name;

                const spatialParams = {
                  swLat: sw.getLat(),
                  swLng: sw.getLng(),
                  neLat: ne.getLat(),
                  neLng: ne.getLng(),
                  lat: center.getLat(),
                  lng: center.getLng()
                };

                // [3] 추출된 코드와 공간 정보를 결합하여 API 재호출
                fetchNearby(bjd.code, bjd.address_name, spatialParams, requestId);
              } else {
                if (requestId === fetchIdRef.current) setIsListLoading(false);
              }
            } else {
              if (requestId === fetchIdRef.current) setIsListLoading(false);
            }
          });

          // WMS 레이어 갱신
          if (showHeatmapRef.current) updateWmsOverlay('crime', map);
        }, 500);
      });

      // 초기 로드 시 현재 센터 기준으로 주변 매물 조회 (동기성 확보)
      const center = map.getCenter();
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      fetchNearby('1168010100', '서울특별시 강남구 역삼동', {
        swLat: sw.getLat(),
        swLng: sw.getLng(),
        neLat: ne.getLat(),
        neLng: ne.getLng(),
        lat: center.getLat(),
        lng: center.getLng()
      });
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

  const fetchNearby = async (code, regionName, spatial = null, existingRequestId = null) => {
    const requestId = existingRequestId || ++fetchIdRef.current;
    if (!existingRequestId) setIsListLoading(true);

    try {
      let url = `http://localhost:5000/api/nearby?code=${code}&region=${encodeURIComponent(regionName)}`;
      if (spatial) {
        url += `&swLat=${spatial.swLat}&swLng=${spatial.swLng}&neLat=${spatial.neLat}&neLng=${spatial.neLng}&lat=${spatial.lat}&lng=${spatial.lng}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      // 요청 ID가 현재 최신 ID와 일치할 때만 상태 업데이트 (Race Condition 방지)
      if (requestId === fetchIdRef.current) {
        if (data.listings) {
          setListings(data.listings);
          setStats({ ...data.stats, count: data.listings.length });
        }
      }
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      if (requestId === fetchIdRef.current) {
        setIsListLoading(false);
      }
    }
  };
  const updateMarkers = (items) => {
    if (!window.kakao || !mapInstance.current) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const newMarkers = items.map(item => {
      if (!item.lat || !item.lng) return null;
      const isSafe = item.year > '2015';
      const color = isSafe ? '#2563eb' : '#f59e0b';

      const displayPrice = item.txType === '월세' 
        ? `월세 ${item.rawPrice}/${item.monthly}` 
        : `${item.txType} ${item.price.replace('만원', '')}`;

      const content = document.createElement('div');
      content.className = `flex flex-col items-center cursor-pointer transition-transform hover:scale-110`;
      content.innerHTML = `
        <div class="bg-white px-2 py-1 rounded-md shadow-md border-2 border-[${color}] mb-1">
          <span class="text-[10px] font-black pointer-events-none" style="color: ${color}">${displayPrice}</span>
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
    }).filter(m => m !== null);
    markersRef.current = newMarkers;
  };

  // ── 필터링 로직 (Filter Logic) ──
  const filteredListings = listings.filter(item => {
    if (filterType === 'ALL') return true;
    if (filterType === 'APT') return item.apiType?.includes('APT');
    if (filterType === 'VILLA') return item.apiType?.includes('RH') || item.apiType?.includes('SH');
    if (filterType === 'OFF') return item.apiType?.includes('OFF');
    return true;
  });

  // 필터링된 데이터가 변경될 때마다 마커 업데이트
  useEffect(() => {
    if (mapInstance.current) {
      updateMarkers(filteredListings);
    }
  }, [filteredListings, listings]);

  const handleAnalyze = async (item) => {
    if (!item) return;
    setSelectedBuilding({ ...item, loading: true });
    try {
      const bun = item.jibun?.split('-')[0] || '0';
      const ji = item.jibun?.split('-')[1] || '0';
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

        // ── [NEW] AI 법률 리포트 요청 (분석 즉시 시작하여 응답 속도 향상) ──
        setSelectedBuilding({ ...item, analysis: data, loading: false, aiLoading: true });
        
        fetch('http://localhost:5000/api/ai-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nps_score: data.npsScore,
            jeonse_ratio: data.details?.jeonseRatio,
            is_violation: data.building?.isVilo === '1',
            building_name: item.label,
            region_name: currentRegionRef.current,
            runner_pace: (data.npsScore > 80 ? '안정적 페이스' : (data.npsScore > 60 ? '조금 빠른 페이스' : '오버페이스'))
          })
        })
        .then(res => res.json())
        .then(aiData => {
          setSelectedBuilding(prev => ({ ...prev, aiReport: aiData.report, aiLoading: false }));
        })
        .catch(err => {
          console.error("AI Report error:", err);
          setSelectedBuilding(prev => ({ ...prev, aiLoading: false }));
        });

        // ── 실시간 인프라 보정 (백엔드 401 우회) ──
        const ps = new window.kakao.maps.services.Places();
        const pArr = new window.kakao.maps.LatLng(item.lat, item.lng);
        
        const searchFacility = (keyword, bonus) => {
          return new Promise((resolve) => {
            ps.keywordSearch(keyword, (res, status) => {
              if (status === window.kakao.maps.services.Status.OK && res.length > 0) {
                const d = parseInt(res[0].distance);
                resolve({ keyword, distance: d, bonus: d < 500 ? bonus : 0 });
              } else {
                resolve({ keyword, distance: 999, bonus: 0 });
              }
            }, { location: pArr, radius: 2000, sort: window.kakao.maps.services.SortBy.DISTANCE });
          });
        };

        Promise.all([
          searchFacility('지하철역', 10),
          searchFacility('대형마트', 5),
          searchFacility('편의점', 5)
        ]).then(results => {
          // ── 사이드바 리스트 사진 동기화 ──
          if (data.thumbnail) {
            setListings(prev => prev.map(l =>
              (l.id === item.id || (l.label === item.label && l.jibun === item.jibun))
                ? { ...l, thumbnail: data.thumbnail }
                : l
            ));
          }
  
          // ── 실시간 인프라 보정 산식 (생활편의 점수 반영) ──
          const totalBonus = results.reduce((acc, cr) => acc + cr.bonus, 0);
          const targetSafe = data.safemap || {};
          if (totalBonus > 0 && targetSafe.radar) {
            targetSafe.amenityScore = Math.min(100, (targetSafe.amenityScore || 70) + totalBonus);
            const amIdx = targetSafe.radar.findIndex(r => r.subject === '생활편의');
            if (amIdx > -1) targetSafe.radar[amIdx].score = targetSafe.amenityScore;
          }
          
          // 기존 데이터 업데이트 (AI 상태 유지하며)
          setSelectedBuilding(prev => ({ ...prev, analysis: { ...data, safemap: targetSafe } }));
        });
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
            <span className="text-blue-600 flex items-center gap-1.5 cursor-pointer border-b-2 border-blue-600 h-14"><LayoutGrid size={15} /> 대시보드</span>
            <span onClick={() => handleComingSoon('검색')} className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5 transition-colors"><Search size={15} /> 검색</span>
            <span onClick={() => handleComingSoon('내 매물')} className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5 transition-colors"><User size={15} /> 내 매물</span>
            <span onClick={() => handleComingSoon('커뮤니티')} className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5 transition-colors"><Users size={15} /> 커뮤니티</span>
            <span onClick={() => handleComingSoon('설정')} className="hover:text-slate-600 cursor-pointer flex items-center gap-1.5 transition-colors"><Settings size={15} /> 설정</span>
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
                  {stats && <span className="text-blue-600 whitespace-nowrap">검색결과: {filteredListings.length}건</span>}
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'ALL', label: '전체' },
                    { id: 'APT', label: '아파트' },
                    { id: 'VILLA', label: '빌라/다세대' },
                    { id: 'OFF', label: '오피스텔' }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => setFilterType(btn.id)}
                      className={`whitespace-nowrap text-[10px] px-3 py-1.5 rounded-full border transition-all duration-300 ${
                        filterType === btn.id
                          ? 'bg-blue-600 text-white border-blue-700 font-black shadow-md shadow-blue-100'
                          : 'bg-white text-slate-400 border-slate-100 font-bold hover:border-blue-200 hover:text-blue-600'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#fdfdfd] relative">
            {isListLoading && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative w-16 h-16 mb-6">
                  <div className="absolute inset-0 border-4 border-blue-50 rounded-full" />
                  <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-7 h-7 text-blue-600 animate-pulse" />
                  </div>
                </div>
                <p className="text-[9px] font-black text-blue-600 tracking-[0.2em] uppercase mb-2">Discovery Mode</p>
                <h3 className="text-[13px] font-black text-slate-900 tracking-tighter uppercase mb-1">Exploring Neighborhood</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                  실거래가 데이터 및 통합 GIS<br/>인프라를 분석 중입니다
                </p>
              </div>
            )}
            <div className="flex justify-between items-center px-1 mb-1">
              <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-tighter">Nearby Real-Trades</span>
              <span className="text-[9px] font-bold text-blue-600 cursor-pointer tracking-tighter">v3.0 Data Fusion</span>
            </div>
            {filteredListings.length === 0 && !isListLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <Database size={32} />
                <span className="text-[10px] font-bold mt-2">해당 유형의 매물이 이 지역에 없습니다.</span>
              </div>
            ) : (
              filteredListings.map(item => (
                <PropertyItem
                  key={item.id}
                  item={item}
                  isSelected={selectedBuilding?.id === item.id}
                  onClick={() => handleAnalyze(item)}
                />
              ))
            )}
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
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold shadow-sm border transition-all ${showHeatmap
                  ? 'bg-red-600 text-white border-red-700 border-b-2 border-b-red-800 shadow-red-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${showHeatmap ? 'bg-red-200 animate-pulse' : 'bg-slate-300'}`} />
              치안 히트맵
            </button>
          </div>

          {/* 히트맵 범례 */}
          {showHeatmap && (
            <div className="absolute bottom-6 left-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 shadow-lg text-[9px] font-bold" style={{ zIndex: 100 }}>
              <p className="text-slate-700 mb-2 font-black text-[10px]">🔴 범죄주의구간 (전체)</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex gap-0.5">
                  <div className="w-5 h-3 rounded-sm bg-red-700" />
                  <div className="w-5 h-3 rounded-sm bg-red-400" />
                  <div className="w-5 h-3 rounded-sm bg-orange-300" />
                  <div className="w-5 h-3 rounded-sm bg-yellow-100" />
                </div>
                <span className="text-slate-500">주의 구간 → 안전 구간</span>
              </div>
              <p className="text-slate-400">출처: 생활안전지도 IF_0087_WMS</p>
            </div>
          )}
        </div>

        <RightPanel selectedBuilding={selectedBuilding} regionName={currentRegionRef.current} isListLoading={isListLoading} />
      </main>
    </div>
  );
}

export default App;
