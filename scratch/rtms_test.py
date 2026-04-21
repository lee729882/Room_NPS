import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_rtms():
    key = os.getenv("PUBLIC_DATA_INCODING_KEY")
    # Yeoksam-dong 11680, April 2024
    lawd_cd = "11680"
    deal_ymd = "202404"
    url = f"http://apis.data.go.kr/1613000/RTMSDataSvcApts/getRTMSDataSvcAptRent?serviceKey={key}&LAWD_CD={lawd_cd}&DEAL_YMD={deal_ymd}&format=json"
    
    print(f"Testing RTMS API (Transaction) with key.")
    try:
        r = requests.get(url, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
             print("SUCCESS! Transaction API works.")
             # print(r.text[:200])
        else:
             print("Error Text:", r.text[:200])
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_rtms()
