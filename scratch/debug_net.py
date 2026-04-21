import requests

def debug_network():
    test_urls = [
        "http://api.vworld.kr",
        "https://api.vworld.kr",
        "http://apis.data.go.kr",
        "https://apis.data.go.kr"
    ]
    for url in test_urls:
        try:
            r = requests.get(url, timeout=5)
            print(f"{url} -> status: {r.status_code}")
        except Exception as e:
            print(f"{url} -> Error: {e}")

if __name__ == "__main__":
    debug_network()
