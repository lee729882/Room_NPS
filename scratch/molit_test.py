import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_molit_final():
    # Use the DECODED key from .env (PUBLIC_DATA_KEY)
    key = os.getenv("PUBLIC_DATA_KEY")
    pnu = "1168010100108320007"
    
    # Try HTTPS (which is recommended for 2024)
    url = "https://apis.data.go.kr/1611000/nsdi/IndvdlzPblntfPclndService/getIndvdlzPblntfPclndInfo"
    params = {
        "serviceKey": key,
        "pnu": pnu,
        "format": "json"
    }
    
    print(f"Testing MOLIT with DECODED key and HTTPS")
    try:
        # requests.get will encode the key correctly
        r = requests.get(url, params=params, timeout=10)
        print(f"Status: {r.status_code}")
        print(f"Content Type: {r.headers.get('Content-Type')}")
        if r.status_code == 200:
            print("Response:", r.text[:500])
        else:
            print("Response:", r.text[:200])
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_molit_final()
