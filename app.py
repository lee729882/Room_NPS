# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
import re

load_dotenv()

app = Flask(__name__)
CORS(app)

SERVICE_KEY = os.getenv("PUBLIC_DATA_KEY")
VWORLD_KEY = os.getenv("VWORLD_KEY")
VWORLD_DOMAIN = os.getenv("VWORLD_DOMAIN", "http://localhost:5174")

# 4대 실거래가 API 엔드포인트
ENDPOINTS = {
    "RH_TRADE": "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
    "RH_RENT": "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
    "SH_TRADE": "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
    "SH_RENT": "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent"
}

def normalize_jibun(jibun_str):
    if not jibun_str: return ""
    parts = str(jibun_str).split('-')
    normalized = []
    for part in parts:
        try: normalized.append(str(int(part)))
        except: normalized.append(part.strip())
    return '-'.join(normalized)

def clean_building_name(name):
    if not name: return ""
    # "(건물명미상)", "알수없음" 등의 노이즈 제거
    name = re.sub(r'\(.*?\)', '', name).strip()
    return name

def fetch_vworld_data(bjd_code, bun, ji):
    try:
        pnu = f"{bjd_code}1{str(bun).zfill(4)}{str(ji).zfill(4)}"
        bld_url = f"http://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_L_SPGD&key={VWORLD_KEY}&domain={VWORLD_DOMAIN}&attrFilter=pnu:=:{pnu}&format=json"
        price_url = f"http://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_C_UD801&key={VWORLD_KEY}&domain={VWORLD_DOMAIN}&attrFilter=pnu:=:{pnu}&format=json"

        bld_data = requests.get(bld_url, timeout=5).json()
        price_data = requests.get(price_url, timeout=5).json()

        bld_feat = bld_data.get('response', {}).get('result', {}).get('featureCollection', {}).get('features', [])
        price_feat = price_data.get('response', {}).get('result', {}).get('featureCollection', {}).get('features', [])

        bld_info = bld_feat[0].get('properties', {}) if bld_feat else {}
        price_info = price_feat[0].get('properties', {}) if price_feat else {}

        return {
            "structure": bld_info.get('stru_cd_nm', '철근콘크리트'),
            "purpose": bld_info.get('main_purps_cd_nm', '공동주택'),
            "officialPrice": int(price_info.get('pnilp', 0))
        }
    except:
        return {"structure": "철근콘크리트", "purpose": "공동주택", "officialPrice": 2500000}

def fetch_and_parse(url, params):
    try:
        res = requests.get(url, params=params, timeout=10)
        if res.status_code != 200: return []
        root = ET.fromstring(res.content)
        items = root.findall('.//item')
        parsed = []
        for it in items:
            p_val = it.findtext('거래금액', it.findtext('보증금액', it.findtext('deposit', it.findtext('dealAmount', '0'))))
            p_str = p_val.strip().replace(',', '')
            m_val = it.findtext('월세금액', it.findtext('monthlyRent', '0')).strip().replace(',', '')
            area = it.findtext('전용면적', it.findtext('excluUseAr', it.findtext('연면적', '30'))).strip()
            # 4대 API마다 건물명 필드명이 다를 수 있음
            name = it.findtext('연립다세대', it.findtext('mhouseNm', it.findtext('bldNm', it.findtext('대지명칭', '')))).strip()
            jibun = normalize_jibun(it.findtext('지번', '').strip())
            parsed.append({
                "price": int(p_str) if p_str.isdigit() else 0,
                "monthly": int(m_val) if m_val.isdigit() else 0,
                "name": clean_building_name(name), 
                "jibun": jibun, 
                "area": float(area) if area else 30.0,
                "year": it.findtext('건축년도', it.findtext('buildYear', '2015')).strip(),
                "floor": it.findtext('층', '1').strip()
            })
        return parsed
    except: return []

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        bjd_code = data.get('code', '')
        sigungu_cd = bjd_code[:5]
        target_name = clean_building_name(data.get('buildingName', ''))
        target_bun = data.get('bun', '')
        target_ji = data.get('ji', '')
        target_jibun = normalize_jibun(f"{target_bun}-{target_ji}") if target_bun else ""

        vworld = fetch_vworld_data(bjd_code, target_bun, target_ji)
        months = [(datetime.now() - timedelta(days=30*i)).strftime('%Y%m') for i in range(12)]
        months.reverse() 
        
        def fetch_m(m):
            p = {'serviceKey': SERVICE_KEY, 'LAWD_CD': sigungu_cd, 'DEAL_YMD': m}
            # 4대 API 모두 스캔 (연립/단독 x 매매/전세)
            res = []
            for k in ["RH_TRADE", "RH_RENT", "SH_TRADE", "SH_RENT"]:
                res.extend(fetch_and_parse(ENDPOINTS[k], p))
            return m, res

        trend_data, all_matches = [], []
        t_prices, r_prices = [], []
        
        with ThreadPoolExecutor(max_workers=12) as executor:
            for m, total_list in executor.map(fetch_m, months):
                t_list = [x for x in total_list if x['monthly'] == 0]
                r_list = [x for x in total_list if x['monthly'] > 0]
                
                t_avg = sum(x['price'] for x in t_list) // len(t_list) if t_list else 0
                r_avg = sum(x['price'] for x in r_list) // len(r_list) if r_list else 0
                
                trend_data.append({"month": f"{m[4:]}월", "trade": t_avg/1000, "rent": r_avg/1000})
                
                for itm in total_list:
                    if (target_jibun and target_jibun == itm['jibun']) or (target_name and target_name in itm['name']):
                        all_matches.append(itm)
                
                t_prices.extend([x['price'] for x in t_list])
                r_prices.extend([x['price'] for x in r_list])

        best = all_matches[-1] if all_matches else None
        avg_t = sum(t_prices) // len(t_prices) if t_prices else 25000
        avg_r = sum(r_prices) // len(r_prices) if r_prices else 15000
        
        is_real = best is not None
        price_val = best['price'] if is_real else avg_t
        area = best['area'] if best else 30
        total_official = vworld['officialPrice'] * area / 10000 
        
        price_ratio = int((price_val / total_official) * 100) if total_official > 0 else 100
        final_name = target_name if target_name else (best['name'] if best and best['name'] else f"{target_jibun} 인근")

        return jsonify({
            "isEstimated": not is_real,
            "status": "4대 API 통합 분석 완료",
            "trend": trend_data,
            "details": {
                "bldNm": final_name,
                "market": f"{price_val:,}만원",
                "avgTrade": f"{avg_t:,}만원",
                "avgRent": f"{avg_r:,}만원",
                "isSpecific": is_real,
                "officialPrice": vworld['officialPrice'],
                "priceRatio": price_ratio,
                "structure": vworld['structure'],
                "purpose": vworld['purpose']
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/nearby', methods=['GET'])
def get_nearby():
    try:
        bjd_code = request.args.get('code', '')
        if not bjd_code: return jsonify({"error": "No code"}), 400
        sigungu_cd = bjd_code[:5]
        months = [(datetime.now() - timedelta(days=30*i)).strftime('%Y%m') for i in range(12)]
        months.reverse()
        
        def fetch_m(m):
            p = {'serviceKey': SERVICE_KEY, 'LAWD_CD': sigungu_cd, 'DEAL_YMD': m}
            res = []
            for k in ["RH_TRADE", "RH_RENT", "SH_TRADE", "SH_RENT"]:
                res.extend(fetch_and_parse(ENDPOINTS[k], p))
            return res
            
        all_items = []
        with ThreadPoolExecutor(max_workers=12) as executor:
            for total_list in executor.map(fetch_m, months):
                all_items.extend(total_list)
                
        properties = {}
        for itm in all_items:
            # 건물명이 있는 매물 우선, 없으면 지번으로 키 생성
            display_name = itm['name'] if itm['name'] else f"{itm['jibun']} 매물"
            key = f"{display_name}_{itm['jibun']}"
            if key not in properties:
                properties[key] = {
                    "id": key, "label": display_name, "sub": itm['jibun'],
                    "price": f"{itm['price']:,}만원", "raw_price": itm['price'],
                    "year": itm['year'], "code": bjd_code, 
                    "bun": itm['jibun'].split('-')[0], 
                    "ji": itm['jibun'].split('-')[1] if '-' in itm['jibun'] else '0'
                }
        return jsonify({"listings": list(properties.values())[:40], "stats": {"count": len(all_items)}})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
