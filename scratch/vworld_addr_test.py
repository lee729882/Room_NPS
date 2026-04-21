import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_vworld_address():
    vkey = os.getenv("VWORLD_KEY")
    # Yeoksam-dong 832-7
    address = "서울특별시 강남구 역삼동 832-7"
    
    url = "http://api.vworld.kr/req/address"
    params = {
        "service": "address",
        "request": "getaddress",
        "key": vkey,
        "type": "PARCEL",
        "address": address,
        "format": "json"
    }
    
    print(f"Testing VWorld Address API")
    try:
        r = requests.get(url, params=params, timeout=10)
        print(f"Status: {r.status_code}")
        print("Response:", r.text[:500])
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_vworld_address()
