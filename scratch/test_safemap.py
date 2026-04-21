import os, sys, requests
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("SAFEMAP_KEY")

urls = [
    # 1. Old data API
    f"https://www.safemap.go.kr/openApiService/data/getCrimeOccurData.do?apikey={key}&lat=37.5&lon=127.0&radius=500",
    # 2. REST API guess
    f"http://safemap.go.kr/openapi2/IF_0087?apikey={key}&lat=37.5&lon=127.0",
    # 3. WFS guess
    f"http://safemap.go.kr/openapi2/wfs?apikey={key}&request=GetFeature&typename=A2SM_CRMNLSTATS&bbox=126.9,37.4,127.1,37.6"
]

for url in urls:
    print(f"\n--- Testing: {url[:60]}...")
    try:
        r = requests.get(url, timeout=5)
        print("Status Code:", r.status_code)
        try:
            print(r.json())
        except:
            print(r.text[:300])
    except Exception as e:
        print("Failed:", e)
