import urllib.request, json
r = urllib.request.urlopen('http://127.0.0.1:5001/api/public/carrossel')
data = json.loads(r.read())
print(f"Slides: {len(data)}")
for s in data:
    print(f"  id={s.get('id')} titulo={s.get('titulo')} ativo={s.get('ativo')} status={s.get('status')}")

print()
r2 = urllib.request.urlopen('http://127.0.0.1:5001/api/public/noticias')
data2 = json.loads(r2.read())
print(f"Noticias: {len(data2)}")
for n in data2:
    print(f"  id={n.get('id')} titulo={n.get('titulo')} destaque={n.get('destaque_carrossel')}")
