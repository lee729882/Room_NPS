import React from 'react';
import { Search, MapPin, Building2, ShieldCheck, ChevronRight } from 'lucide-react';

function Sidebar({ onSelectBuilding }) {
  const mockBuildings = [
    { 
      id: 1, 
      name: "Mokpo University Dorm", 
      address: "Muan-gun, Cheonggye-myeon", 
      safetyGrade: "우수",
      lat: 34.912, lng: 126.438 
    },
    { 
      id: 2, 
      name: "Chunggye Studio A", 
      address: "Muan-gun, Cheonggye-ro 12", 
      safetyGrade: "보통",
      lat: 34.915, lng: 126.440 
    }
  ];

  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl">
      <div className="p-6">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="건물명 또는 주소 검색..." 
            className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
          />
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h2 className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Recommended Buildings</h2>
        
        <div className="space-y-3">
          {mockBuildings.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBuilding(b)}
              className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-300 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Building2 className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate mb-1">{b.name}</h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{b.address}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 mt-1" />
              </div>
              
              <div className="mt-3 flex items-center justify-between">
                <span className={`status-badge status-${b.safetyGrade === '우수' ? 'excellent' : 'normal'}`}>
                  {b.safetyGrade}
                </span>
                <span className="text-[10px] font-bold text-blue-600">진단 가능</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100">
        <div className="glass p-4 rounded-xl flex items-center gap-3 border-blue-100">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <div className="text-[10px] text-slate-600 font-medium leading-tight">
            NPS 알고리즘 기반으로 실시간 대학가 원룸 건물의 안전도를 분석합니다.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
