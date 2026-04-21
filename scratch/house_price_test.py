import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_house_price():
    key = os.getenv("PUBLIC_DATA_INCODING_KEY")
    pnu = "1168010100108320007"
    # 공동주택가격
    url = f"http://apis.data.go.kr/1611000/nsdi/HousePriceService/getHousePriceAttr?serviceKey={key}&pnu={pnu}&format=json"
    
    print(f"Testing House Price API (MOLIT)")
    try:
        r = requests.get(url, timeout=10)
        print(f"Status: {r.status_code}")
        print("Response:", r.text[:200])
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_house_price()
