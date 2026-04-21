import requests
import json

def test_kakao_roadview():
    lng, lat = 127.035544, 37.492361 # Yeoksam Station
    url = f"https://roadview.map.kakao.com/api/v1/rv/nearest.json?x={lng}&y={lat}"
    try:
        r = requests.get(url, timeout=5)
        print(f"Status: {r.status_code}")
        data = r.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        pano_id = data.get('panoId')
        if pano_id:
            img_url = f"https://roadview.map.kakao.com/api/v1/rv/static_image?panoid={pano_id}&w=300&h=200"
            print(f"Proposed Image URL: {img_url}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_kakao_roadview()
