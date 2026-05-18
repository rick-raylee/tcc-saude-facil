import urllib.request, urllib.error, json

try:
    req = urllib.request.Request('http://127.0.0.1:5000/api/login', 
        data=json.dumps({'cpf':'32323254353','senha':'123456'}).encode(), 
        headers={'Content-Type':'application/json'}
    )
    res = urllib.request.urlopen(req)
    print("SUCCESS")
    print(res.read().decode())
except urllib.error.HTTPError as e:
    print("ERROR", e.code)
    print(e.read().decode())
except Exception as e:
    import traceback
    traceback.print_exc()
