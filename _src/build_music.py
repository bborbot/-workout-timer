"""Музыка приложения: скачать треки из tracks.json (Incompetech), выровнять громкость, сжать.
Запуск из корня: python -X utf8 _src/build_music.py  (перед этим обновить _src/pieces.json при необходимости)
"""
import json, os, shutil, subprocess, urllib.parse, urllib.request
p = {x["title"]: x for x in json.load(open("_src/pieces.json", encoding="utf-8"))}
t = json.load(open("_src/tracks.json", encoding="utf-8"))
os.makedirs("_src/raw", exist_ok=True)
lib = {}
for cat, names in t.items():
    shutil.rmtree(f"music/{cat}", ignore_errors=True)
    os.makedirs(f"music/{cat}")
    lib[cat] = []
    target = -18 if cat in ("relax", "stretch") else -14
    for i, n in enumerate(names, 1):
        fn = p[n]["filename"]
        raw = f"_src/raw/{fn}"
        if not os.path.exists(raw):
            urllib.request.urlretrieve("https://incompetech.com/music/royalty-free/mp3-royaltyfree/" + urllib.parse.quote(fn), raw)
        out = f"music/{cat}/{i:02d}.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-ac", "1", "-ar", "22050",
                        "-af", f"loudnorm=I={target}:TP=-1.5:LRA=11", "-b:a", "48k", out], check=True)
        lib[cat].append({"file": out, "title": n, "bpm": int(p[n]["bpm"])})
        print(cat, i, n, flush=True)
json.dump(lib, open("music/library.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
