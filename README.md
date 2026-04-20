# 🛡️ Room NPS: Real-time Housing Safety Diagnostic System
> **2026 Mokpo National University Capstone Design Project** <br>
> **국토교통부 실거래가 & 건축HUB 빅데이터 기반 자취방 안심 진단 플랫폼**

<p align="left">
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=React&logoColor=black"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=Vite&logoColor=white"/>
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=Flask&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=Python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Kakao_Maps-FFCD00?style=for-the-badge&logo=Kakao&logoColor=black"/>
</p>

---

## 📋 1. Project Overview (프로젝트 개요)
**Room NPS**는 대학생 및 사회초년생의 주거 정보 비대칭 문제를 해결하기 위한 **지능형 안심 진단 시스템**입니다. 국토교통부의 4대 실거래가 API와 최신 건축HUB 데이터를 실시간으로 매칭하여, 사용자가 선택한 매물의 경제적 가치와 건축적 안전성을 수치화된 **NPS(안심 점수)**로 제공합니다.

---

## 🔗 2. Integrated Data Pipeline (데이터 통합 전략)
본 프로젝트는 **총 5종의 국가 공공데이터 API**를 결합하여 데이터의 신뢰성을 극대화했습니다.

### 📊 Real-time Data Source
| Category | API Source | Key Insights |
| :--- | :--- | :--- |
| **Building** | **건축HUB 건축물대장** | 노후도(사용승인일), 위반 건축물 여부, 주차 대수 |
| **Apartment** | **연립다세대 매매/전월세** | 빌라 및 저층 공동주택의 실거래 시세 분석 |
| **House** | **단독/다가구 매매/전월세** | 원룸 건물 및 다가구 주택의 거래 투명성 확보 |
| **Geospatial** | **Kakao Maps API** | 법정동 코드 기반 위치 시각화 및 주변 인프라 매핑 |

---

## 🖥️ 3. Main Features (핵심 기능)
- **Housing NPS Engine**: 준공 연도, 위반 여부, 주변 시세 대비 전세가율을 분석해 0~100점의 안심 점수 산출.
- **Interactive Map Dashboard**: 지도를 클릭하는 것만으로 해당 지번의 건축물 정보와 실거래 내역 즉시 조회.
- **Auto-Report Generation**: 복잡한 공공데이터 응답 값을 한눈에 보기 쉬운 시각화 카드로 자동 변환.
- **Safe-Fallback System**: 공공데이터 서버 불안정 시 인근 표준 데이터를 활용한 지능형 추론 로직 탑재.

---

## 📂 4. Project Structure (폴더 구조)
```text
Room_NPS/
├── frontend/               # [Frontend] React + Vite + Tailwind CSS
├── venv/                   # [Backend] Python 가상환경
├── app.py                  # [Server] Flask API 및 데이터 처리 엔진
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
