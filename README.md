# 🛡️ Room NPS: Real-time Housing Safety Diagnostic System
> **2026 Mokpo National University Capstone Design Project** <br>
> **국토교통부 실거래가 & 공공데이터 통합 기반 자취방/전세 안심 진단 플랫폼 및 AI 법률 리포트**

<p align="left">
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=React&logoColor=black"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=Vite&logoColor=white"/>
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=Flask&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=Python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Kakao_Maps-FFCD00?style=for-the-badge&logo=Kakao&logoColor=black"/>
  <img src="https://img.shields.io/badge/Llama_3-0466C8?style=for-the-badge&logo=Meta&logoColor=white"/>
</p>

---

## 📋 1. Project Overview (프로젝트 개요)
**Room NPS**는 대학생 및 사회초년생의 주거 정보 비대칭 및 전세사기 문제를 해결하기 위한 **지능형 안심 진단 시스템**입니다. 국토교통부의 실거래가 API와 최신 공공데이터(건축물대장, 공시지가, 범죄예방지도)를 실시간으로 매칭하여 매물의 경제적·건축적 안전성을 수치화된 **NPS(안심 점수)**로 제공하며, LLM 기반의 맞춤형 법률 리포트를 자동 생성합니다.

---

## 🔗 2. Integrated Data Pipeline (데이터 통합 전략)
본 프로젝트는 **총 8종의 국가 공공데이터 API**를 결합하여 데이터의 신뢰성과 커버리지를 극대화했습니다.

### 📊 Real-time Data Source
| Category | API Source | Key Insights |
| :--- | :--- | :--- |
| **Real Estate** | **국토교통부 실거래가 (4종 통합)** | 아파트, 오피스텔, 연립다세대, 단독다가구 매매/전월세 시세 통합 분석 |
| **Building** | **건축HUB 건축물대장** | 위반건축물 여부, 노후도(사용승인일), 주차 대수 등 결격 사유 검증 |
| **Security** | **생활안전지도 (Safemap WMS)** | 반경 내 범죄주의구간 등급 산출 및 실시간 히트맵 오버레이 |
| **Valuation** | **국토교통부 / VWorld** | 필지별 공시지가 조회를 통한 적정 전세가율 및 HUG 보증보험 요건 검증 |
| **Geospatial** | **Kakao Maps API** | 법정동 코드 기반 위치 시각화 및 주변 인프라(역세권 등) 매핑 |

---

## 🖥️ 3. Main Features (핵심 기능)
- **Housing NPS Engine**: 전세가율, 노후도, 치안 인프라, 위반건축물 여부를 종합 분석해 0~100점의 안심 점수를 산출합니다.
- **AI Legal Diagnostic Report**: NVIDIA NIM (LLAMA3-70B)과 `주택임대차보호법`을 결합한 RAG 시스템으로, 해당 매물의 전세가율과 위반 여부를 인용한 맞춤형 임차인 권리 분석 리포트를 제공합니다.
- **Interactive Map Dashboard**: 주거 형태(아파트/오피스텔/빌라) 실시간 필터링 및 지도를 통한 실거래 내역 즉시 조회 UI를 구현했습니다.
- **Safe-Fallback System**: 공공데이터 서버 불안정 시 지오코딩 로컬 캐싱 및 인근 표준 데이터를 활용한 지능형 추론 로직을 탑재했습니다.

---

## 📂 4. Project Structure (폴더 구조)
```text
Room_NPS/
├── frontend/               # [Frontend] React + Vite + Tailwind CSS
├── venv/                   # [Backend] Python 가상환경
├── app.py                  # [Server] Flask API 및 다중 공공데이터 병렬 처리 엔진
├── 주택임대차보호법.TXT       # [Data] LLM RAG 기반 법률 리포트 생성용 컨텍스트
├── requirements.txt        # [Python] 의존성 라이브러리 목록
├── .env                    # [Security] API 키 관리 (Git 제외)
├── .gitignore              # [Git] 불필요한 파일 제외 설정
└── README.md               # [Docs] 프로젝트 기술 문서
```

---

## 📂 5. Getting Started(시작하기)

### 🛠️ Step 1. Environment Setup (환경 설정)

```bash
# 가상환경 활성화 및 라이브러리 설치
python -m venv venv
./venv/Scripts/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

### 🏃 Step 2. Run Application (실행)
백엔드 서버와 프론트엔드 개발 서버를 각각 실행합니다.

### [Backend 실행]
```bash
python app.py
```
### [Frontend 실행]
```bash
cd frontend
npm install
npm run dev
```
