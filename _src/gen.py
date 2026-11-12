"""Генерирует страницы, манифесты, иконки и страницу авторов музыки.
Запуск из корня: python -X utf8 _src/gen.py
"""
import json
from PIL import Image, ImageDraw, ImageFont

APPS = {
    "jumps":    ("Прыжки",       "#d93636", "J"),
    "bag":      ("Груша",        "#1f5fd6", "B"),
    "animal":   ("Animal moves", "#1d8a4e", "A"),
    "strength": ("Силовые",      "#7a3dc9", "S"),
}
FONT = "C:/Windows/Fonts/arialbd.ttf"


def icon(path, color, letter, size):
    im = Image.new("RGB", (size, size), color)
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, int(size * 0.62))
    box = d.textbbox((0, 0), letter, font=f)
    d.text(((size - (box[2] - box[0])) / 2 - box[0], (size - (box[3] - box[1])) / 2 - box[1]),
           letter, font=f, fill="white")
    im.save(path)


PAGE = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{name}</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{name}">
<meta name="theme-color" content="{color}">
<link rel="apple-touch-icon" href="icons/{key}-180.png">
<link rel="manifest" href="{key}.webmanifest">
<link rel="stylesheet" href="style.css">
</head>
<body data-type="{key}"><main>
<a class="back" href="index.html">← все тренировки</a>
<h1 id="title">{name}</h1>
<div class="row"><span class="lbl">Работа</span><button data-step="work" data-dir="-1">−</button><span class="val" id="work"></span><button data-step="work" data-dir="1">+</button></div>
<div class="row"><span class="lbl">Отдых</span><button data-step="rest" data-dir="-1">−</button><span class="val" id="rest"></span><button data-step="rest" data-dir="1">+</button></div>
<div class="row"><span class="lbl">Всего</span><button data-step="total" data-dir="-1">−</button><span class="val" id="total"></span><button data-step="total" data-dir="1">+</button></div>
<div id="rounds"></div>
<button class="big" id="start">Старт</button>
<div id="phase"></div><div id="clock"></div><div id="left"></div>
<a class="sub" id="save" hidden>Сохранить тренировку в «Файлы»</a>
<button class="sub" id="offline">Сохранить музыку для работы без интернета</button>
<p class="note">Перед каждой сменой — пик-пик-пик (3-2-1), на смене — длинный сигнал: высокий — работа, низкий — отдых.
Музыка: Kevin MacLeod, <a href="credits.html">список треков</a>.</p>
<audio id="player" preload="auto"></audio>
</main><script src="app.js"></script></body></html>
"""

INDEX = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Тренировки</title>
<link rel="apple-touch-icon" href="icons/jumps-180.png">
<link rel="stylesheet" href="style.css">
</head><body><main>
<h1>Тренировки</h1>
<div class="menu">
{items}
</div>
<p class="note">Откройте нужную тренировку в Safari, нажмите «Поделиться» → «На экран „Домой“» — появится отдельная иконка.
Внутри нажмите «Сохранить музыку…», и тренировка будет работать без интернета.</p>
<p class="note"><a href="credits.html">Музыка и лицензии</a></p>
</main>
<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {{}});</script>
</body></html>
"""


def main():
    lib = json.load(open("music/library.json", encoding="utf-8"))
    items = []
    for key, (name, color, letter) in APPS.items():
        for s in (180, 192, 512):
            icon(f"icons/{key}-{s}.png", color, letter, s)
        open(f"{key}.html", "w", encoding="utf-8").write(PAGE.format(key=key, name=name, color=color))
        man = {"name": name, "short_name": name, "start_url": f"{key}.html", "scope": "./",
               "display": "standalone", "background_color": "#0e0e11", "theme_color": color,
               "icons": [{"src": f"icons/{key}-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": f"icons/{key}-512.png", "sizes": "512x512", "type": "image/png"}]}
        json.dump(man, open(f"{key}.webmanifest", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        items.append(f'<a href="{key}.html"><img src="icons/{key}-180.png" alt="">{name}</a>')
    open("index.html", "w", encoding="utf-8").write(INDEX.format(items="\n".join(items)))

    names = {"jumps": "Прыжки", "bag": "Груша", "animal": "Animal moves", "strength": "Силовые", "relax": "Отдых"}
    rows = []
    for cat, tracks in lib.items():
        rows.append(f"<h2>{names[cat]}</h2><ul>")
        for t in tracks:
            rows.append(f'<li>"{t["title"]}" Kevin MacLeod (incompetech.com)<br>'
                        f'Licensed under Creative Commons: By Attribution 4.0 License<br>'
                        f'<a href="https://creativecommons.org/licenses/by/4.0/">creativecommons.org/licenses/by/4.0/</a></li>')
        rows.append("</ul>")
    open("credits.html", "w", encoding="utf-8").write(
        '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Музыка</title>'
        '<link rel="stylesheet" href="style.css"></head><body><main>'
        '<a class="back" href="index.html">← назад</a><h1>Музыка</h1>'
        '<p class="note">Вся музыка — Kevin MacLeod (incompetech.com), лицензия CC BY 4.0. '
        'Треки сжаты в моно и выровнены по громкости.</p>' + "\n".join(rows) + "</main></body></html>")
    print("generated")


if __name__ == "__main__":
    main()
