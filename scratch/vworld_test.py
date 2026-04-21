import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_vworld_many_rows():
    vkey = os.getenv("VWORLD_KEY")
    domain = os.getenv("VWORLD_DOMAIN", "http://localhost:5174")
    pnu = "1168010100109000000"
    
    url = "https://api.vworld.kr/ned/data/getLandCharacteristics"
    params = {
        "key": vkey,
        "domain": domain,
        "pnu": pnu,
        "format": "json",
        "numOfRows": "100" # Request more rows to handle historical data
    }
    
    print(f"Testing URL: {url} (numOfRows=100)")
    try:
        r = requests.get(url, params=params, timeout=30)
        print(f"Status Code: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            fields = data.get('landCharacteristicss', {}).get('field', [])
            if fields:
                print(f"SUCCESS! Found {len(fields)} records.")
                # Sort manually by year DESC
                fields.sort(key=lambda x: x.get('stdrYear', '0'), reverse=True)
                print(f"Sorted Latest Year: {fields[0].get('stdrYear')}, Price: {fields[0].get('pblntfPclnd')}")
            else:
                print("No fields found.")
        else:
            print(f"Error Text: {r.text[:500]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_vworld_many_rows()
