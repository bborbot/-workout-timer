"""Генерирует страницы, манифесты, иконки и страницу авторов музыки.
Запуск из корня: python -X utf8 _src/gen.py
"""
import html, json, re, sys
sys.path.insert(0, "_src")
from guides import GUIDES
from PIL import Image, ImageDraw, ImageFont

APPS = {
    "warmup":   ("Warm-up",      "#c2410c", "W"),
    "jumps":    ("Power",        "#d93636", "P"),
    "speed":    ("Speed & Reaction", "#a16207", "Sp"),
    "bag":      ("Endurance",    "#1f5fd6", "E"),
    "animal":   ("Coordination / Balance", "#1d8a4e", "C"),
    "strength": ("Strength",     "#7a3dc9", "S"),
    "stretch":  ("Stretching",   "#0b7285", "St"),
}
# Рекомендации на неделю (одобрены оператором 12.11.2026): текст, минимум раз для «цель выполнена», запись цели
REC = {
    "warmup":   ("before each workout · 5–10 min", 0, ""),
    "jumps":    ("1–2× a week · 15–20 min", 1, "1–2"),
    "speed":    ("1× a week · 10–15 min", 1, "1"),
    "bag":      ("2–3× a week · 20–40 min", 2, "2–3"),
    "animal":   ("2× a week · 15–20 min", 2, "2"),
    "strength": ("2–3× a week, not on consecutive days · 30–45 min", 2, "2–3"),
    "stretch":  ("2–3× a week or after each workout · 10–20 min", 2, "2–3"),
}
SHORT = {"warmup": "Warm-up", "jumps": "Power", "speed": "Speed", "bag": "Endurance",
         "animal": "Coord / Balance", "strength": "Strength", "stretch": "Stretching"}
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
<html lang="en"><head><meta charset="utf-8">
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
<a class="back" href="index.html">← all workouts</a>
<h1 id="title">{name}</h1>
<a class="sub guide" href="{key}-guide.html">📖 How to do it</a>
<div class="row"><span class="lbl">Work</span><button data-step="work" data-dir="-1">−</button><span class="val" id="work"></span><button data-step="work" data-dir="1">+</button></div>
<div class="row"><span class="lbl">Rest</span><button data-step="rest" data-dir="-1">−</button><span class="val" id="rest"></span><button data-step="rest" data-dir="1">+</button></div>
<div class="row"><span class="lbl">Total</span><button data-step="total" data-dir="-1">−</button><span class="val" id="total"></span><button data-step="total" data-dir="1">+</button></div>
<div id="rounds"></div>
<button class="big" id="start">Start</button>
<div id="phase"></div><div id="clock"></div><div id="left"></div>
<a class="sub" id="save" hidden>Save workout to Files</a>
<button class="sub" id="offline">Save music for offline use</button>
<h2>My music</h2>
<p class="note">Your own songs (MP3, M4A) from Files. Stored on this phone only.</p>
<label class="sub">+ My tracks for work<input type="file" id="mywork" accept="audio/*" multiple hidden></label>
<div class="note" id="myworkn"></div><button class="sub" id="clrwork" hidden>Remove my work tracks</button>
<label class="sub">+ My tracks for rest<input type="file" id="myrest" accept="audio/*" multiple hidden></label>
<div class="note" id="myrestn"></div><button class="sub" id="clrrest" hidden>Remove my rest tracks</button>
<p class="note">Before each change: beep-beep-beep (3-2-1), then a long tone: high — work, low — rest.
Built-in music: Kevin MacLeod, <a href="credits.html">track list</a>.</p>
<audio id="player" preload="auto"></audio>
</main><script src="app.js"></script></body></html>
"""

INDEX = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Workouts</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Workouts">
<link rel="apple-touch-icon" href="icons/home-180.png">
<link rel="manifest" href="home.webmanifest">
<link rel="stylesheet" href="style.css">
</head><body><main>
<h1>Workouts</h1>
<div id="today"></div>
<a class="sub guide" href="guides.html">📖 All workouts explained — what each one means</a>
<details class="intro"><summary>How recommendations, plan and marks work</summary>
<p>Recommended per week for a healthy adult (based on WHO guidance: 150–300 min of moderate
or 75–150 min of vigorous activity, strength at least 2 days). Set your own weekly plan under each workout, or make a weekly schedule — then the plan is counted from it.
A workout played in the app is marked automatically with its minutes; tap <b>+</b> if you trained without the app.
At the start of a new week you will see how last week went. Marks are stored on this phone only.</p>
</details>
<p class="disclaimer">This is the author’s personal view, not sports or medical advice. If you have health problems
or injuries, or the workouts are for a child, ask a doctor or a coach first.</p>
<div id="report"></div>
<div class="menu">
{items}
</div>
<div class="wkbar"><button id="prev" aria-label="previous week">‹</button><h2 id="wk">This week</h2><button id="next" aria-label="next week">›</button></div>
<p class="sum" id="sum"></p>
<div id="days"></div>
<p class="note">Tap a coloured mark to remove it. Several workouts a day are fine, e.g. Warm-up → Strength → Stretching.
</p>
<p class="note"><b>Install:</b> iPhone — open this page in Safari, Share → Add to Home Screen.
Android — open in Chrome, menu ⋮ → Install app (or Add to Home screen).
Use this one “Workouts” icon: on iPhone, marks made in Safari and in the home-screen icon are kept separately.
In each workout, tap “Save music for offline use” once.</p>
<p class="note"><a href="credits.html">Music and licenses</a></p>
</main>
<script>window.HOME = {home};</script>
<script src="home.js"></script>
</body></html>
"""


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    return re.sub(r"\*(.+?)\*", r"<i>\1</i>", t)


def block(text):
    out, lst = [], None
    for line in text.split("\n") + [""]:
        m_ul, m_ol = line.startswith("- "), re.match(r"\d+\. ", line)
        kind = "ul" if m_ul else "ol" if m_ol else None
        if lst and kind != lst:
            out.append(f"</{lst}>"); lst = None
        if kind:
            if not lst:
                out.append(f"<{kind}>"); lst = kind
            out.append("<li>" + inline(line[2:] if m_ul else line[m_ol.end():]) + "</li>")
        elif line.strip():
            out.append("<p>" + inline(line) + "</p>")
    return "\n".join(out)


GUIDE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{name} — how to</title>
<link rel="stylesheet" href="style.css">
</head><body><main class="guidepage">
<a class="back" href="{key}.html">← back to the timer</a>
<h1>{name}</h1>
{body}
<p class="disclaimer">This is the author’s personal view, not sports or medical advice. If you have health problems
or injuries, or the workouts are for a child, ask a doctor or a coach first.</p>
<a class="sub" href="{key}.html">Back to the timer</a>
</main></body></html>
"""


def guide_page(key, name):
    parts = []
    for i, (title, text) in enumerate(GUIDES[key]):
        if i == 0:
            parts.append(f'<section class="lead">{block(text)}</section>')
        else:
            parts.append(f"<details><summary>{inline(title)}</summary>{block(text)}</details>")
    open(f"{key}-guide.html", "w", encoding="utf-8").write(GUIDE.format(key=key, name=name, body="\n".join(parts)))


SCHED = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Weekly schedule</title>
<link rel="stylesheet" href="style.css">
</head><body><main>
<a class="back" href="index.html">← all workouts</a>
<h1>Weekly schedule</h1>
<p class="note">Pick a day, then tap the workouts for the morning, the day or the evening. The schedule repeats every week;
your weekly plan is counted from it. Stored on this phone only.</p>
<div class="dtabs" id="days"></div>
<h2 id="dname"></h2>
<div id="slots"></div>
<button class="sub" id="example">Use example week</button>
<button class="sub" id="clear">Clear schedule</button>
<a class="big" href="index.html">Done</a>
</main>
<script>window.HOME = {home};</script>
<script src="schedule.js"></script>
</body></html>
"""


def all_guides():
    parts = []
    for key, (name, color, letter) in APPS.items():
        first = GUIDES[key][0][1]
        parts.append(f'<details class="gall"><summary><img src="icons/{key}-180.png" alt="">{html.escape(name)}</summary>'
                     f'{block(first)}<a class="sub" href="{key}-guide.html">Full description and the author’s preferences →</a>'
                     f'<a class="sub" href="{key}.html">Open the timer</a></details>')
    open("guides.html", "w", encoding="utf-8").write(GUIDE.replace("{name} — how to", "All workouts explained")
        .replace('<a class="back" href="{key}.html">← back to the timer</a>', '<a class="back" href="index.html">← all workouts</a>')
        .replace("<h1>{name}</h1>", "<h1>All workouts explained</h1>")
        .replace('<a class="sub" href="{key}.html">Back to the timer</a>', '<a class="big" href="index.html">Back</a>')
        .replace("{body}", "\n".join(parts)))


def main():
    lib = json.load(open("music/library.json", encoding="utf-8"))
    items = []
    for key, (name, color, letter) in APPS.items():
        for s in (180, 192, 512):
            icon(f"icons/{key}-{s}.png", color, letter, s)
        open(f"{key}.html", "w", encoding="utf-8").write(PAGE.format(key=key, name=name, color=color))
        guide_page(key, name)
        man = {"name": name, "short_name": name, "start_url": f"{key}.html", "scope": "./",
               "display": "standalone", "background_color": "#0e0e11", "theme_color": color,
               "icons": [{"src": f"icons/{key}-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": f"icons/{key}-512.png", "sizes": "512x512", "type": "image/png"}]}
        json.dump(man, open(f"{key}.webmanifest", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        rec, mn, goal = REC[key]
        items.append(f'<div class="card" data-key="{key}"><a href="{key}.html"><img src="icons/{key}-180.png" alt="">'
                     f'<span><b>{name}</b><small>{rec}</small></span></a>'
                     f'<div class="cnt"><span class="n"></span><button class="plus" aria-label="done today">+</button></div>'
                     f'<div class="plan">My plan: <button class="pm" data-d="-1" aria-label="less">−</button>'
                     f'<span class="pv"></span><button class="pm" data-d="1" aria-label="more">+</button><span class="pmin"></span>'
                     f'<a class="howto" href="{key}-guide.html">📖 How to</a></div></div>')
    home = {"order": list(APPS), "apps": {k: {"name": v[0], "short": SHORT[k], "color": v[1], "min": REC[k][1], "goal": REC[k][2]}
                                          for k, v in APPS.items()}}
    for s in (180, 192, 512):
        icon(f"icons/home-{s}.png", "#26262c", "Fit", s)
    json.dump({"name": "Workouts", "short_name": "Workouts", "start_url": "index.html", "scope": "./",
               "display": "standalone", "background_color": "#0e0e11", "theme_color": "#26262c",
               "icons": [{"src": "icons/home-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": "icons/home-512.png", "sizes": "512x512", "type": "image/png"}]},
              open("home.webmanifest", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    all_guides()
    open("schedule.html", "w", encoding="utf-8").write(SCHED.format(home=json.dumps(home, ensure_ascii=False)))
    open("index.html", "w", encoding="utf-8").write(INDEX.format(items="\n".join(items),
                                                                 home=json.dumps(home, ensure_ascii=False)))

    names = {"warmup": "Warm-up", "speed": "Speed & Reaction", "jumps": "Power", "bag": "Endurance", "animal": "Coordination / Balance", "strength": "Strength",
             "stretch": "Stretching", "relax": "Rest"}
    rows = []
    for cat, tracks in lib.items():
        rows.append(f"<h2>{names[cat]}</h2><ul>")
        for t in tracks:
            rows.append(f'<li>"{t["title"]}" Kevin MacLeod (incompetech.com)<br>'
                        f'Licensed under Creative Commons: By Attribution 4.0 License<br>'
                        f'<a href="https://creativecommons.org/licenses/by/4.0/">creativecommons.org/licenses/by/4.0/</a></li>')
        rows.append("</ul>")
    open("credits.html", "w", encoding="utf-8").write(
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Music</title>'
        '<link rel="stylesheet" href="style.css"></head><body><main>'
        '<a class="back" href="index.html">← back</a><h1>Music</h1>'
        '<p class="note">All music by Kevin MacLeod (incompetech.com), license CC BY 4.0. '
        'Tracks are converted to mono and loudness-normalized.</p>' + "\n".join(rows) + "</main></body></html>")
    print("generated")


if __name__ == "__main__":
    main()
