import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_molit_attr():
    key = os.getenv("PUBLIC_DATA_INCODING_KEY")
    pnu = "1168010100108320007"
    # Note: Using getIndvdlzPblntfPclndAttr instead of Info
    url = f"http://apis.data.go.kr/1611000/nsdi/IndvdlzPblntfPclndService/getIndvdlzPblntfPclndAttr?serviceKey={key}&pnu={pnu}&format=json"
    
    print(f"Testing MOLIT getIndvdlzPblntfPclndAttr")
    try:
        r = requests.get(url, timeout=10)
        print(f"Status: {r.status_code}")
        print("Response:", r.text[:500])
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_molit_attr()
