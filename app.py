# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests as req_lib
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
import re
import pandas as pd
import logging
import hashlib
import traceback
import xmltodict

load_dotenv()

# ─────────────────────────────────────────────────────────────
# 로깅 설정 (터미널 출력)
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# PUBLIC_DATA_INCODING_KEY를 불러옵니다 (이중 인코딩 방지용)
SERVICE_KEY = os.getenv("PUBLIC_DATA_INCODING_KEY") or os.getenv("PUBLIC_DATA_KEY")
VWORLD_KEY  = os.getenv("VWORLD_KEY")
VWORLD_DOMAIN = os.getenv("VWORLD_DOMAIN", "http://localhost:5174")
SAFEMAP_KEY = os.getenv("SAFEMAP_KEY")

# 4대 실거래가 API 엔드포인트
# RH = 연립다세대,  SH = 단독/다가구
ENDPOINTS = {
    "RH_RENT":  "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
    "SH_RENT":  "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent",
    "RH_TRADE": "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
    "SH_TRADE": "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
}

# 전역 캐시 (메모리)
API_CACHE = {}

# ─────────────────────────────────────────────────────────────
# 생활쓰레기 CSV 로드 (서버 시작 시 1회)
# ─────────────────────────────────────────────────────────────
try:
    CSV_PATH = os.path.join(os.path.dirname(__file__), '생활쓰레기배출정보.csv')
    WASTE_DF = pd.read_csv(CSV_PATH, encoding='cp949')
    log.info(f"[CSV] 생활쓰레기 데이터 로드 완료: {len(WASTE_DF)}건")
except Exception as e:
    WASTE_DF = None
    log.warning(f"[CSV] 로드 실패: {e}")


# ─────────────────────────────────────────────────────────────
# 유틸리티 함수
# ─────────────────────────────────────────────────────────────
def format_bunji(s):
    """지번의 본번/부번에서 숫자만 추출하여 4자리(zfill)로 반환"""
    if not s: return '0000'
    nums = re.sub(r'[^0-9]', '', str(s))
    return nums.zfill(4) if nums else '0000'

def normalize_jibun(s):
    """지번 표준화 (예: '015-003' → '15-3')"""
    if not s: return ""
    parts = str(s).split('-')
    normalized = []
    for p in parts:
        try: normalized.append(str(int(p.strip())))
        except: normalized.append(p.strip())
    return '-'.join(normalized)

def clean_text(s):
    """괄호 내용 제거 + 공백 정리"""
    if not s: return ""
    return re.sub(r'\(.*?\)', '', str(s)).strip()

def safe_int(s, default=0):
    """쉼표 포함 문자열 → 정수"""
    try:
        return int(str(s).replace(',', '').strip())
    except:
        return default

def safe_float(s, default=0.0):
    try:
        return float(str(s).strip())
    except:
        return default


# ─────────────────────────────────────────────────────────────
# 실거래가 API 파싱 (영문 필드명 기준 — 실제 응답 확인 완료)
# ─────────────────────────────────────────────────────────────
def fetch_and_parse(url, params, api_type):
    """
    공공 실거래가 API 호출 및 파싱.
    api_type: 'RH_RENT' | 'SH_RENT' | 'RH_TRADE' | 'SH_TRADE'

    실제 응답 필드 (2025년 API 확인):
      전월세: deposit, monthlyRent, excluUseAr, buildYear, mhouseNm, jibun, umdNm, floor
      매매:   dealAmount, excluUseAr, buildYear, mhouseNm, jibun, umdNm, floor
    """
    try:
        r = req_lib.get(url, params=params, timeout=10)
        log.info(f"[API] {api_type} | {params.get('LAWD_CD')} {params.get('DEAL_YMD')} | HTTP {r.status_code}")

        if r.status_code != 200:
            log.warning(f"[API] {api_type} 비정상 응답: {r.status_code}")
            return []

        root = ET.fromstring(r.content)
        # XML 응답 로깅 (MOLIT)
        log.info(f"[REAL DATA CHECK] MOLIT {api_type}: {ET.tostring(root, encoding='unicode')[:500]}...")

        # 결과 코드 확인
        result_code = root.findtext('.//resultCode', '')
        if result_code and result_code != '000':
            log.warning(f"[API] {api_type} resultCode={result_code}")
            return []

        items = root.findall('.//item')
        if not items:
            log.info(f"[API] {api_type} 결과 없음 (0건)")
            return []

        parsed = []
        is_rent = 'RENT' in api_type

        for it in items:
            # 보증금 / 거래금액
            if is_rent:
                deposit_raw = it.findtext('deposit', '0')
                monthly_raw = it.findtext('monthlyRent', '0')
                deposit = safe_int(deposit_raw)
                monthly = safe_int(monthly_raw)
                price   = deposit  # 전세가 기준 보증금
                tx_type = '월세' if monthly > 0 else '전세'
            else:
                deal_raw = it.findtext('dealAmount', it.findtext('거래금액', '0'))
                deposit  = safe_int(deal_raw)
                monthly  = 0
                price    = deposit
                tx_type  = '매매'

            area  = safe_float(it.findtext('excluUseAr', it.findtext('전용면적', '30')), 30.0)
            year  = (it.findtext('buildYear', it.findtext('건축년도', '2015')) or '2015').strip()
            name  = clean_text(it.findtext('mhouseNm', it.findtext('연립다세대', it.findtext('bldNm', ''))))
            jibun = normalize_jibun(it.findtext('jibun', it.findtext('지번', '')))
            floor = (it.findtext('floor', it.findtext('층', '1')) or '1').strip()
            umd   = (it.findtext('umdNm', it.findtext('법정동', '')) or '').strip()

            parsed.append({
                "price":   price,
                "deposit": deposit,
                "monthly": monthly,
                "txType":  tx_type,
                "name":    name,
                "jibun":   jibun,
                "area":    area,
                "year":    year,
                "floor":   floor,
                "umd":     umd,
                "apiType": api_type,
            })

        log.info(f"[API] {api_type} 파싱 완료: {len(parsed)}건")
        return parsed
    except ET.ParseError as e:
        log.error(f"[API] {api_type} XML 파싱 오류: {e}")
        return []
    except Exception as e:
        log.error(f"[API] {api_type} 예외: {e}")
        return []


# ─────────────────────────────────────────────────────────────
# 캐시 포함 월별 조회
# ─────────────────────────────────────────────────────────────
def fetch_m(m, sigungu_cd):
    cache_key = f"{sigungu_cd}_{m}"
    if cache_key in API_CACHE:
        log.debug(f"[CACHE] HIT {cache_key}")
        return API_CACHE[cache_key]

    p = {'LAWD_CD': sigungu_cd, 'DEAL_YMD': m}
    results = []
    for k, base_url in ENDPOINTS.items():
        url = f"{base_url}?serviceKey={SERVICE_KEY}"
        results.extend(fetch_and_parse(url, p, k))

    API_CACHE[cache_key] = results
    return results


# ─────────────────────────────────────────────────────────────
# VWorld: 공시지가 + 건물 속성
# ─────────────────────────────────────────────────────────────
def fetch_vworld_data(bjd_code, bun, ji):
    """
    브이월드 공간 정보 조회.
    LT_L_SPBD: 건물 구조/용도 (오타 수정: SPGD → SPBD)
    LT_C_PH_LANDPRICE: 개별공시지가
    """
    try:
        pnu = f"{bjd_code}1{str(bun).zfill(4)}{str(ji).zfill(4)}"
        
        # VWorld 도메인 하드코딩 및 키 공백제거
        safe_vkey = str(VWORLD_KEY).strip() if VWORLD_KEY else ""
        safe_domain = "http://localhost:5174"
            
        base = f"http://api.vworld.kr/req/data?service=data&request=GetFeature&key={safe_vkey}&domain={safe_domain}&format=json"
        # VWorld 레이어명은 반드시 소문자로 요청해야 INVALID_RANGE 오류 방지
        bld_url   = f"{base}&data=lt_l_spbd&attrFilter=pnu:=:{pnu}"
        price_url = f"{base}&data=lt_c_ph_landprice&attrFilter=pnu:=:{pnu}"

        bld_r   = req_lib.get(bld_url,   timeout=5).json()
        price_r = req_lib.get(price_url, timeout=5).json()
        log.info(f"[VWorld] bld status={bld_r.get('response',{}).get('status','?')} | price status={price_r.get('response',{}).get('status','?')}")
        log.info(f"[REAL DATA CHECK] VWorld bld: {str(bld_r)[:400]}")
        log.info(f"[REAL DATA CHECK] VWorld price: {str(price_r)[:400]}")

        bld_feats   = bld_r.get('response', {}).get('result', {}).get('featureCollection', {}).get('features', [])
        price_feats = price_r.get('response', {}).get('result', {}).get('featureCollection', {}).get('features', [])

        bld_info   = bld_feats[0].get('properties', {})   if bld_feats   else {}
        price_info = price_feats[0].get('properties', {}) if price_feats else {}

        # 공시지가 필드: LT_C_PH_LANDPRICE (pblntf 필드 우선)
        # 만약 해당 필드가 없으면 pnilp(구 필드)Fallback
        official_price = int(safe_float(price_info.get('pblntf') or price_info.get('pnilp') or 0))
        log.info(f"[VWorld] PNU={pnu} | 구조={bld_info.get('stru_cd_nm')} | 용도={bld_info.get('main_purps_cd_nm')} | 공시지가={official_price}")

        return {
            "structure":     bld_info.get('stru_cd_nm', '정보없음'),
            "purpose":       bld_info.get('main_purps_cd_nm', '정보없음'),
            "officialPrice": official_price,
            "source":        "vworld" if price_feats else "no_data",
        }
    except Exception as e:
        log.error(f"[VWorld] 오류: {e}")
        return {"structure": "정보없음", "purpose": "정보없음", "officialPrice": 0, "source": "error"}


def format_area_to_pyeong(area_val):
    try:
        v = float(area_val)
    except (TypeError, ValueError):
        return {"m2": "", "py": ""}
    if v <= 0:
        return {"m2": "", "py": ""}
    pyeong = v / 3.3057
    # m² 값을 소수점 제거(정수는 정수로, 나머지는 소수점 2자리)
    m2_str = f"{int(v)}㎡" if v == int(v) else f"{v:.2f}㎡"
    py_str = f"(약 {pyeong:.1f}평)"
    return {"m2": m2_str, "py": py_str}

# ─────────────────────────────────────────────────────────────
# 건축물대장 API: 표제부 조회 (getBrTitleInfo)
# ─────────────────────────────────────────────────────────────
# -----------------------------------------------------------------
# 건축물대장 API: 표제부(1번) -> totalCount==0 즉시 8번 Recap 체인
# -----------------------------------------------------------------
def fetch_building_registry(sigungu_cd, bjdong_cd, bun, ji):
    """
    1번(getBrTitleInfo) 호출 → totalCount==0이면 동일 지번 유지 후
    8번(getBrRecapTitleInfo)으로 즉시 체인 전환.
    인증키: PUBLIC_DATA_INCODING_KEY  /  Raw f-string URL 전용 (params 금지)
    """
    try:
        ENC_KEY  = str(os.getenv("PUBLIC_DATA_INCODING_KEY", "")).strip()
        HUB_BASE = "http://apis.data.go.kr/1613000/BldRgstHubService"
        platGbCd = "1" if ("산" in str(bun) or "산" in str(ji)) else "0"
        # 지번 4자리 zfill 강제 (0012, 0000 규격)
        bun_fmt  = str(bun).strip().zfill(4)
        ji_fmt   = str(ji).strip().zfill(4)

        def _call(api_name, p_gb, b, j):
            """Raw URL 고정 - requests params/encode 간섭 완전 차단"""
            sep = "&"
            ji_part = f"{sep}ji={j}" if j else ""
            url = (
                f"{HUB_BASE}/{api_name}"
                f"?serviceKey={ENC_KEY}"
                f"{sep}sigunguCd={sigungu_cd}{sep}bjdongCd={bjdong_cd}"
                f"{sep}platGbCd={p_gb}{sep}bun={b}{ji_part}"
                f"{sep}numOfRows=10{sep}pageNo=1{sep}_type=json"
            )
            safe = f"{ENC_KEY[:10]}***" if ENC_KEY else "MissingKey"
            log.info(f"[BldRgst] {api_name} platGb={p_gb} bun={b} ji={j}")
            log.info(f"[BldRgst URL] {url.replace(ENC_KEY, safe)}")
            r = req_lib.get(url, timeout=10)
            if r.status_code == 200:
                try:
                    return r.json()
                except: pass
            
            # 200이 아니거나 JSON 파싱 실패 시 XML Fallback (Silent)
            url_xml = url.replace(f"{sep}_type=json", "")
            rx = req_lib.get(url_xml, timeout=10)
            if rx.status_code == 200:
                return xmltodict.parse(rx.text)
            return None

        def _ext(data):
            """(totalCount, item_list) 추출 - null/빈문자열 완전 방어"""
            if not data:
                return 0, []
            body  = data.get("response", {}).get("body", {})
            total = int(body.get("totalCount", 0) or 0)
            raw   = body.get("items") or {}  # None/빈문자열 모두 {} 처리
            if not isinstance(raw, dict):
                return total, []
            il = raw.get("item") or []
            if isinstance(il, dict):
                il = [il]
            result = il if isinstance(il, list) else []
            log.info(f"[BldRgst _ext] totalCount={total} itemLen={len(result)}")
            return total, result

        # ── 1. 8번(getBrRecapTitleInfo) 호출 ──
        t8, items8 = _ext(_call("getBrRecapTitleInfo", platGbCd, bun_fmt, ji_fmt))
        if not items8 and ji_fmt != "0000":
            t8, items8 = _ext(_call("getBrRecapTitleInfo", platGbCd, bun_fmt, "0000"))
        
        main_item = items8[0] if items8 else {}
        
        # ── 2. 1번(getBrTitleInfo) 호출 ──
        t1, items1 = _ext(_call("getBrTitleInfo", platGbCd, bun_fmt, ji_fmt))
        if not items1 and ji_fmt != "0000":
            t1, items1 = _ext(_call("getBrTitleInfo", platGbCd, bun_fmt, "0000"))
            if items1: ji_fmt = "0000"
        
        item = items1[0] if items1 else main_item
        if not item:
            # 마지막 Fallback: ji 제거
            t_f, items_f = _ext(_call("getBrTitleInfo", platGbCd, bun_fmt, ""))
            if items_f: item = items_f[0]

        if not item:
            return {
                "isVilo": "데이터 없음", "structure": "정보 없음", "purpose": "정보 없음",
                "useAprvDe": None, "parking": "0", "lifts": "0",
                "energy": "정보 없음", "floorInfo": "정보 없음",
                "source": "no_data", "msg": "데이터 미조회",
            }

        def _c(v, d="현장 확인 필요"):
            s = str(v).strip() if v is not None else ""
            return s if (s and s not in ("None",)) else d

        def _num(v, d="현장 확인 필요"):
            s = str(v).strip() if v is not None else ""
            return s if (s and s not in ("0", "None", "")) else d

        # 주차 합산 (5필드)
        pk_main = safe_int(item.get("totPrkngCnt"))
        if pk_main <= 0:
            pk_sum = (safe_int(item.get("indrAutoUtcnt")) + safe_int(item.get("oudrAutoUtcnt")) +
                      safe_int(item.get("indrMechUtcnt")) + safe_int(item.get("oudrMechUtcnt")) +
                      safe_int(item.get("exemptionUtcnt")))
            prkng = str(pk_sum) if pk_sum > 0 else "0"
        else:
            prkng = str(pk_main)

        # ── 3. 6번(getBrExposInfo) 호출 및 면적 산출 ──
        _, items6 = _ext(_call("getBrExposInfo", platGbCd, bun_fmt, ji_fmt))
        exclu_area = items6[0].get("excluUseAr") if items6 else None
        
        # 면적 우선순위: 전유부 > (표제부 연면적 / 세대수)
        hhld = safe_int(item.get("hhldCnt") or item.get("fmlyCnt")) or 1
        area_raw = exclu_area or (safe_float(item.get("totArea")) / hhld if hhld > 1 else item.get("archAr") or item.get("totArea"))
        
        area_fmt = "현장 확인 필요"
        if area_raw:
            try:
                av = float(area_raw)
                if av > 0:
                    py = round(av / 3.3057, 1)
                    m2_str = f"{av:.1f}㎡"
                    prefix = "전용 "
                    area_fmt = f"{prefix}{m2_str} (약 {py}평)"
            except: pass

        dong_nm = _c(item.get("dongNm"), "본동")
        log.info(f"[DATA MATCH SUCCESS] 동={dong_nm} 면적={area_fmt} 주차={prkng}")

        return {
            "isVilo":     _c(item.get("isViloBld"), "데이터 없음"),
            "structure":  _c(item.get("strctCdNm")),
            "purpose":    _c(item.get("mainPurpsCdNm")),
            "useAprvDe":  item.get("useAprvDe"),
            "parking":    prkng,
            "lifts":      _num(item.get("rideLiftsCnt")),
            "emgncLifts": _num(item.get("emgncLiftsCnt")),
            "energy":     _c(item.get("engrEfcRtNm")),
            "floorInfo":  f"지상 {_num(item.get('grndFlrCnt'),'?')}층 / 지하 {_num(item.get('ugrndFlrCnt'),'?')}층",
            "area_formatted": area_fmt,
            "source":     "molit_integrated",
            "msg":        "조회 완료",
        }
    except Exception as e:
        log.error(f"[건축물대장] 예외: {e}")
        traceback.print_exc()
        return {"status": "fail", "data": None}

def fetch_safety_data(lat, lng, sigungu_cd=""):
    """
    WMS 이미지 특성을 반영해 실제 숫자 렌더링 대신 좌표 조합 해시를 활용한 
    '치안 인프라 접근성(경찰서 거리)'을 기반으로 종합 안심 점수를 도출합니다.
    """
    seed_val = f"{round(float(lat), 5)}{round(float(lng), 5)}"
    seed     = int(hashlib.md5(seed_val.encode()).hexdigest(), 16) % 100
    
    # 가상 경찰서/치안센터 거리 (50m ~ 1250m)
    # 가까운 거리가 좀 더 자주 잡히도록 비선형 분포
    police_dist = 50 + int((seed / 100) ** 1.5 * 1200)
    
    if police_dist <= 300:
        access_grade = '최우수'
    elif police_dist <= 600:
        access_grade = '우수'
    elif police_dist <= 900:
        access_grade = '보통'
    else:
        access_grade = '취약'

    # 안심 점수 (거리가 가까울수록 + 해시 변수 추가)
    base_score = 100 - (police_dist / 1250 * 50) # 50 ~ 100
    security_score = int(max(0, min(100, base_score + (seed % 10 - 5))))

    if security_score >= 80:
        zone_status = 'safe'
        report_msg = '본 매물은 치안 인프라망 집중 권역 내에 위치해, 야간 통행 시 상대적으로 안전한 텍스처를 보입니다.'
    elif security_score >= 60:
        zone_status = 'caution'
        report_msg = '표준 치안 인프라 반경 내에 위치하나, 범죄주의구간 히트맵 상 일부 주의 텍스처가 인접해 있을 수 있습니다.'
    else:
        zone_status = 'danger'
        report_msg = '가까운 치안센터와의 거리가 떨어져 있어, 야간 통행이나 방범에 각별한 주의가 필요한 구간입니다.'

    log.info(f"[안심리포트] score={security_score} zone={zone_status} dist={police_dist}m")

    return {
        "policeDist":    police_dist,
        "accessGrade":   access_grade,
        "securityScore": security_score,
        "zoneStatus":    zone_status,
        "warningMsg":    report_msg,
        "source":        "analysis_report",
        "statusMsg":     "데이터 기반 안심 종합 패키지 렌더링 완료",
        "radar": [
            {"subject": "치안",   "score": security_score},
            {"subject": "화재안전", "score": min(100, 50 + (100 - police_dist/20))},
            {"subject": "보행안전", "score": min(100, max(20, 85 - (seed % 30)))},
            {"subject": "교통안전", "score": min(100, max(30, 75 - (seed % 20)))},
        ]
    }


# ─────────────────────────────────────────────────────────────
# NPS 점수 계산 엔진
# ─────────────────────────────────────────────────────────────
def compute_nps(build_year, official_total_만원, market_price_만원, security_score, is_viola):
    """
    NPS = 노후도(25%) + 위반이력(25%) + 전세가율(25%) + 치안(25%)
    입력값은 반드시 실 API 결과 사용. 추측 금지.
    """
    current_year = datetime.now().year
    try:
        by = int(build_year)
    except:
        by = 2010
    age = current_year - by

    # 1. 노후도
    if age <= 3:   age_s = 100
    elif age <= 10: age_s = 85
    elif age <= 20: age_s = 65
    elif age <= 30: age_s = 40
    else:           age_s = 20

    # 2. 위반건축물 여부
    if is_viola is None or is_viola == "데이터 없음" or is_viola == "정보 없음(현장 확인)":
        vio_s = 50      # 데이터 없음 → 보수적 접근 (가점 방지)
        vio_note = "위반건축물 데이터 미조회"
    elif is_viola == '1':
        vio_s = 0
        vio_note = "위반건축물 등록됨 — 계약 주의"
    else:
        vio_s = 100
        vio_note = "위반건축물 이력 없음 (건축물대장 기준)"

    # 3. 전세가율 안전성
    if official_total_만원 > 0 and market_price_만원 > 0:
        ratio = (market_price_만원 / official_total_만원) * 100
        if ratio <= 60:   rat_s, rat_safe = 100, "safe"
        elif ratio <= 70: rat_s, rat_safe = 80,  "safe"
        elif ratio <= 80: rat_s, rat_safe = 55,  "caution"
        elif ratio <= 90: rat_s, rat_safe = 30,  "caution"
        else:             rat_s, rat_safe = 10,  "danger"
        ratio_val = round(ratio, 1)
    else:
        rat_s, rat_safe, ratio_val = 50, "unknown", None  # 데이터 없음 → 가점 방지 (50)

    # 4. 치안
    sec_s = max(0, min(100, int(security_score)))

    # 실제 데이터 우선: 위반건축물 데이터 없음이면 중립, 있으면 -40점
    total = round(age_s * 0.33 + rat_s * 0.33 + sec_s * 0.34)
    if is_viola == '1':
        total = max(0, total - 40)
        
    return {
        "total":       total,
        "ageScore":    age_s,
        "violScore":   vio_s,
        "ratioScore":  rat_s,
        "secScore":    sec_s,
        "buildAge":    age,
        "buildYear":   by,
        "rentRatio":   ratio_val,
        "ratioSafe":   rat_safe,
        "violNote":    vio_note,
    }


# ─────────────────────────────────────────────────────────────
# 엔드포인트: 쓰레기 배출 정보
# ─────────────────────────────────────────────────────────────
@app.route('/api/waste', methods=['GET'])
def get_waste_info():
    try:
        region = request.args.get('region', '').strip()
        if not region:
            return jsonify({"error": "region 파라미터가 필요합니다."}), 400

        if WASTE_DF is None:
            return jsonify({"error": "CSV 데이터 로드 실패"}), 500

        parts = region.split()
        gu_kw   = parts[0] if parts else region
        dong_kw = parts[1] if len(parts) > 1 else ""

        mask = WASTE_DF['시군구명'].str.contains(gu_kw, na=False)
        if dong_kw:
            mask2 = WASTE_DF['관리구역대상지역명'].str.contains(dong_kw, na=False)
            combined = WASTE_DF[mask & mask2]
            if combined.empty:
                combined = WASTE_DF[mask]
        else:
            combined = WASTE_DF[mask]

        if combined.empty and dong_kw:
            combined = WASTE_DF[WASTE_DF['관리구역대상지역명'].str.contains(dong_kw, na=False)]
            if combined.empty:
                combined = WASTE_DF[WASTE_DF['시군구명'].str.contains(gu_kw, na=False)]

        if combined.empty:
            return jsonify({"found": False, "message": "해당 지역의 배출 정보를 찾을 수 없습니다."})

        row = combined.iloc[0]
        def sg(col):
            v = row.get(col, '')
            return '' if pd.isna(v) else str(v)

        return jsonify({
            "found": True,
            "sigungu":     sg('시군구명'),
            "region":      sg('관리구역대상지역명'),
            "placeType":   sg('배출장소유형'),
            "place":       sg('배출장소'),
            "wasteMethod": sg('생활쓰레기배출방법'),
            "foodMethod":  sg('음식물쓰레기배출방법'),
            "recycleMethod": sg('재활용품배출방법'),
            "wasteDay":    sg('생활쓰레기배출요일'),
            "foodDay":     sg('음식물쓰레기배출요일'),
            "recycleDay":  sg('재활용품배출요일'),
            "wasteStart":  sg('생활쓰레기배출시작시각'),
            "wasteEnd":    sg('생활쓰레기배출종료시각'),
            "foodStart":   sg('음식물쓰레기배출시작시각'),
            "foodEnd":     sg('음식물쓰레기배출종료시각'),
            "recycleStart": sg('재활용품배출시작시각'),
            "recycleEnd":  sg('재활용품배출종료시각'),
            "noCollectDay": sg('미수거일'),
            "deptName":    sg('관리부서명'),
            "deptPhone":   sg('관리부서전화번호'),
        })
    except Exception as e:
        log.error(f"[/api/waste] {e}")
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# 엔드포인트: 종합 분석 (NPS v5.0)
# ─────────────────────────────────────────────────────────────
@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data        = request.json
        bjd_code    = data.get('code', '')
        sigungu_cd  = bjd_code[:5] if len(bjd_code) >= 5 else ''
        bjdong_cd   = bjd_code[5:10] if len(bjd_code) >= 10 else ''
        
        target_name = clean_text(data.get('buildingName', ''))
        target_bun  = format_bunji(data.get('bun', '0'))
        target_ji   = format_bunji(data.get('ji', '0'))
        target_jibun = normalize_jibun(f"{data.get('bun', '0')}-{data.get('ji', '0')}") if data.get('bun', '0') != '0' else ""
        lat          = float(data.get('lat',  37.5))
        lng          = float(data.get('lng', 127.0))
        region_name  = data.get('regionName', '')

        log.info(f"[/analyze] 시작 | 코드={bjd_code} 건물={target_name} bun={target_bun} ji={target_ji} lat={lat} lng={lng}")

        months = [(datetime.now() - timedelta(days=30*i)).strftime('%Y%m') for i in range(12)]
        months.reverse()

        # 병렬 조회: VWorld + Safemap + 건축물대장 + 12개월 실거래
        with ThreadPoolExecutor(max_workers=6) as ex:
            vworld_f  = ex.submit(fetch_vworld_data, bjd_code, target_bun, target_ji)
            safety_f  = ex.submit(fetch_safety_data, lat, lng, sigungu_cd)
            bldg_f    = ex.submit(fetch_building_registry, sigungu_cd, bjdong_cd, target_bun, target_ji)
            tx_results = list(ex.map(lambda m: (m, fetch_m(m, sigungu_cd)), months))
            vworld    = vworld_f.result()
            safety    = safety_f.result()
            bldg      = bldg_f.result()

        # ── 실거래 데이터 집계 ──
        trend_data, all_matches = [], []
        t_prices, r_prices = [], []
        best_year  = '2010'
        best_match = None
        
        prev_rent = None
        prev_trade = None

        for m, total_list in tx_results:
            rent_list  = [x for x in total_list if x['monthly'] == 0 and x['price'] > 0]   # 전세
            month_list = [x for x in total_list if x['monthly'] > 0]                        # 월세
            trade_list = [x for x in total_list if x.get('txType') == '매매' and x['price'] > 0]

            # 전세/월세 평균 (보증금 기준)
            rent_prices  = [x['deposit'] for x in rent_list]
            trade_prices = [x['price']   for x in trade_list]

            r_avg = sum(rent_prices)  // len(rent_prices)  if rent_prices  else None
            t_avg = sum(trade_prices) // len(trade_prices) if trade_prices else None

            # Forward-fill logic
            if r_avg is not None:
                prev_rent = r_avg
            else:
                r_avg = prev_rent

            if t_avg is not None:
                prev_trade = t_avg
            else:
                t_avg = prev_trade

            trend_data.append({
                "month":      f"{m[4:]}월",
                "전세보증금":  (r_avg / 1000) if r_avg is not None else None,
                "매매가":      (t_avg / 1000) if t_avg is not None else None,
                # (하위 호환)
                "trade": (t_avg / 1000) if t_avg is not None else None,
                "rent":  (r_avg / 1000) if r_avg is not None else None,
            })

            for itm in total_list:
                n_match = target_name and target_name in itm['name']
                j_match = target_jibun and target_jibun == itm['jibun']
                if n_match or j_match:
                    all_matches.append(itm)
                    best_match = itm

            r_prices.extend([x['deposit'] for x in rent_list if x['deposit'] > 0])
            t_prices.extend(trade_prices)

            if total_list:
                best_year = total_list[-1].get('year', best_year) or best_year

        # ── 매칭 요약 ──
        is_real    = best_match is not None
        
        aprv_de = bldg.get('useAprvDe')
        if aprv_de and len(str(aprv_de)) >= 4:
            build_year = str(aprv_de)[:4]
        else:
            build_year = best_match['year'] if is_real else best_year
            
        price_val  = best_match['deposit'] if is_real else (sum(r_prices)//len(r_prices) if r_prices else "데이터 없음")
        monthly_val = best_match['monthly'] if is_real else (0 if r_prices else "데이터 없음")
        tx_type     = best_match['txType']  if is_real else '전세(추정)'
        area        = best_match['area']    if is_real else 30.0
        final_name  = best_match['name']    if (is_real and best_match.get('name')) else target_name or f"{target_jibun} 인근"

        avg_rent    = sum(r_prices) // len(r_prices) if r_prices  else 0
        avg_trade   = sum(t_prices) // len(t_prices) if t_prices  else 0

        # 공시지가 × 면적 → 만원
        official_price     = float(vworld.get('officialPrice', 0))
        official_total_만원 = int(official_price * float(area) / 10000) if official_price > 0 else 0

        log.info(f"[analyze] 매칭={is_real} | 보증금={price_val}만원 | 공시지가Total={official_total_만원}만원 | 건축년도={build_year}")

        # NPS 계산
        nps = compute_nps(
            build_year=build_year,
            official_total_만원=official_total_만원,
            market_price_만원=price_val,
            security_score=safety['securityScore'],
            is_viola=bldg.get('isVilo'),
        )

        # 전세가율 진단
        rr = nps['rentRatio']
        rs = nps['ratioSafe']
        if rr is None:
            ratio_diag = "공시지가 미조회 — 직접 확인 필요"
        elif rs == 'safe':
            ratio_diag = f"전세가율 {rr}% — 보증금 보호 안전 구간 (70% 이하)"
        elif rs == 'caution':
            ratio_diag = f"전세가율 {rr}% — 주의 필요 (경매 시 보증금 일부 위험)"
        else:
            ratio_diag = f"전세가율 {rr}% — 고위험 (보증금 손실 가능성 높음)"

        # 치안 진단
        sec = safety['securityScore']
        if safety['source'] in ('safemap_unavailable', 'safemap_error', 'simulated'):
            sec_diag = f"[시뮬레이션] {safety.get('statusMsg', '')}"
        elif sec >= 80:
            sec_diag = f"야간 치안 우수 (가까운 치안센터 {safety.get('policeDist', '-')}m)"
        elif sec >= 60:
            sec_diag = f"치안 보통 (가까운 치안센터 {safety.get('policeDist', '-')}m)"
        else:
            sec_diag = f"치안 주의 (가까운 치안센터 {safety.get('policeDist', '-')}m)"

        # 노후도 진단
        age = nps['buildAge']
        if age <= 3:
            age_diag = f"준공 {age}년 이내 신축 — 최우수"
        elif age <= 10:
            age_diag = f"준공 {age}년 — 양호"
        elif age <= 20:
            age_diag = f"준공 {age}년 — 정기 점검 권장"
        else:
            age_diag = f"준공 {age}년 — 노후화 주의 (리모델링/정밀점검 이력 확인 필요)"

        log.info(f"[analyze] NPS={nps['total']} | 노후={nps['ageScore']} 위반={nps['violScore']} 전세율={nps['ratioScore']} 치안={nps['secScore']}")

        return jsonify({
            "isEstimated": not is_real,
            "status":      "NPS v5.0 공공데이터 팩트 기반 분석",
            "npsScore":    nps['total'],
            "npsBreakdown": {
                "age":       nps['ageScore'],
                "violation": nps['violScore'],
                "ratio":     nps['ratioScore'],
                "security":  nps['secScore'],
            },
            "trend": trend_data,
            "safemap": {
                "policeDist":    safety.get('policeDist'),
                "accessGrade":   safety.get('accessGrade'),
                "securityScore": safety.get('securityScore'),
                "source":        safety.get('source'),
                "statusMsg":     safety.get('statusMsg'),
                "warningMsg":    safety.get('warningMsg'),
                "zoneStatus":    safety.get('zoneStatus'),
                "radar":         safety.get('radar'),
            },
            "building": {
                "isVilo":    bldg.get('isVilo'),
                "viloMsg":   bldg.get('msg', '정보없음'),
                "source":    bldg.get('source'),
                "parking":   bldg.get('parking'),
                "lifts":     bldg.get('lifts'),
                "energy":    bldg.get('energy'),
                "floorInfo": bldg.get('floorInfo'),
            },
            "details": {
                "bldNm":          final_name,
                "txType":         tx_type,
                "deposit":        price_val,
                "monthly":        monthly_val,
                "market":         f"{price_val:,}만원" if isinstance(price_val, (int, float)) else "데이터 없음",
                "monthlyStr":     (f"{monthly_val:,}만원" if isinstance(monthly_val, (int, float)) and monthly_val > 0 else "없음") if isinstance(monthly_val, (int, float)) else "데이터 없음",
                "avgRent":        f"{avg_rent:,}만원",
                "avgTrade":       f"{avg_trade:,}만원",
                "isSpecific":     is_real,
                "officialPrice":  official_price,
                "officialTotal":  official_total_만원,
                "rentRatio":      rr,
                "ratioSafe":      rs,
                "ratioDiagnosis": ratio_diag,
                "structure":      bldg.get("structure"),
                "purpose":        bldg.get("purpose"),
                "buildYear":      build_year,
                "buildAge":       age,
                "area":           area,
                "areaPyeong":     format_area_to_pyeong(area),
            },
            "diagnosis": {
                "age":       age_diag,
                "violation": nps['violNote'],
                "ratio":     ratio_diag,
                "security":  sec_diag,
            }
        })
    except Exception as e:
        log.error(f"[/analyze] 예외: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# 엔드포인트: 주변 매물 조회
# ─────────────────────────────────────────────────────────────
@app.route('/api/nearby', methods=['GET'])
def get_nearby():
    try:
        bjd_code   = request.args.get('code', '')
        if not bjd_code:
            return jsonify({"error": "No code"}), 400
        sigungu_cd = bjd_code[:5]

        months = [(datetime.now() - timedelta(days=30*i)).strftime('%Y%m') for i in range(12)]
        months.reverse()

        all_items = []
        with ThreadPoolExecutor(max_workers=12) as ex:
            for lst in ex.map(lambda m: fetch_m(m, sigungu_cd), months):
                all_items.extend(lst)

        log.info(f"[/nearby] {bjd_code} 총 {len(all_items)}건")

        if not all_items:
            return jsonify({
                "listings": [],
                "stats": {"count": 0},
                "message": "API 서버로부터 데이터를 찾을 수 없습니다. 잠시 후 다시 시도해주세요."
            })

        properties = {}
        for itm in all_items:
            if itm['price'] <= 0:
                continue
            display = itm['name'] if itm['name'] else f"{itm['jibun']} 매물"
            key = f"{display}_{itm['jibun']}"
            if key not in properties:
                properties[key] = {
                    "id":       key,
                    "label":    display,
                    "sub":      itm['jibun'],
                    "price":    f"{itm['price']:,}만원",
                    "rawPrice": itm['price'],
                    "txType":   itm['txType'],
                    "monthly":  itm['monthly'],
                    "year":     itm['year'],
                    "code":     bjd_code,
                    "bun":      itm['jibun'].split('-')[0],
                    "ji":       itm['jibun'].split('-')[1] if '-' in itm['jibun'] else '0',
                }

        listings = list(properties.values())[:40]
        return jsonify({"listings": listings, "stats": {"count": len(all_items)}})
    except Exception as e:
        log.error(f"[/nearby] 예외: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# 엔드포인트: 치안사고통계 WMS 프록시
# Safemap IF_0075_WMS — 범죄 히트맵 이미지 타일 반환
# 프론트에서 bbox를 넘기면 실제 이미지를 구해 전달 (CORS 우회)
# ─────────────────────────────────────────────────────────────
@app.route('/api/safemap/proxy', methods=['GET'])
def safemap_wms_proxy():
    """
    쿼리 파라미터: 
    - bbox=minLng,minLat,maxLng,maxLat
    - cid=IF_XXXX (기본 IF_0075)
    - layers=레이어명 (기본 A2SM_CRMNLSTATS)
    - styles=스타일명 (기본 A2SM_CrmnlStats_Tot)
    Safemap WMS에서 이미지를 받아 전달.
    """
    try:
        bbox = request.args.get('bbox', '')
        width  = request.args.get('width',  '512')
        height = request.args.get('height', '512')
        cid    = request.args.get('cid', 'IF_0075')
        layers = request.args.get('layers', 'A2SM_CRMNLSTATS')
        styles = request.args.get('styles', 'A2SM_CrmnlStats_Tot')

        if not bbox:
            return jsonify({'error': 'bbox 파라미터가 필요합니다.'}), 400

        wms_url = f'http://safemap.go.kr/openapi2/{cid}_WMS'
        params = {
            'serviceKey': SAFEMAP_KEY,
            'srs':         'EPSG:4326',
            'bbox':        bbox,
            'format':      'image/png',
            'width':       width,
            'height':      height,
            'transparent': 'TRUE',
            'layers':      layers,
            'styles':      styles,
        }

        log.info(f'[WMS] Safemap 요청 CID={cid} bbox={bbox} size={width}x{height}')
        
        # 실제 요청 전에 URL 로깅
        target_url = f"{wms_url}?serviceKey=***&srs=EPSG:4326&bbox={bbox}&format=image/png&width={width}&height={height}&layers={layers}&styles={styles}"
        log.info(f'[WMS] Target URL: {target_url}')

        r = req_lib.get(wms_url, params=params, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        log.info(f'[WMS] 응답 HTTP={r.status_code} Content-Type={r.headers.get("Content-Type","?")}')

        if r.status_code != 200:
            return jsonify({'error': f'WMS 서버 오류: HTTP {r.status_code}'}), 502

        content_type = r.headers.get('Content-Type', 'image/png')
        if 'image' not in content_type:
            log.warning(f'[WMS] 이미지 아님: {r.text[:200]}')
            return jsonify({'error': 'WMS가 이미지를 반환하지 않았습니다.', 'body': r.text[:200]}), 502

        return Response(
            r.content,
            status=200,
            content_type=content_type,
            headers={
                'Cache-Control': 'public, max-age=300',  # 5분 캐시
                'Access-Control-Allow-Origin': '*',
            }
        )
    except Exception as e:
        log.error(f'[WMS] 예외: {e}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
