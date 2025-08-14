# -*- coding: utf-8 -*-
"""
مولّد كلمات متقاطعة (9x9) يومي يعتمد على Wikidata مع بنك احتياطي.
- يكتب الناتج إلى: content/crossword_daily.json
- يُستخدم داخل GitHub Actions (أو يدويًا).
"""

import os, sys, json, time, random, re, datetime
from typing import List, Dict, Tuple
try:
    import requests
except Exception:
    # داخل GitHub Actions سنثبت requests من الـworkflow
    print("install requests first (pip install requests)")
    sys.exit(1)

DATE_STR = datetime.datetime.utcnow().strftime("%Y-%m-%d")

# ---------- إعدادات ----------
GRID = [
    "..#....#.",
    "...#.....",
    ".#..#..#.",
    ".........",
    "...#...#.",
    ".#....#..",
    ".....#...",
    ".#..#..#.",
    ".#....#.."
]
GRID_SIZE = 9
TIMEOUT = 20
RANDOM_SEED = int(datetime.datetime.utcnow().strftime("%Y%m%d"))

# ---------- تطبيع عربية ----------
NORM_MAP = {
    "أ":"ا","إ":"ا","آ":"ا","ٱ":"ا",
    "ة":"ه","ى":"ي","ؤ":"و","ئ":"ي",
}
def normalize_ar(s: str) -> str:
    if s is None: return ""
    # إزالة التشكيل والمسافات والرموز
    s = re.sub(r"[\u064B-\u065F\u0670]", "", s)  # حركات
    s = s.replace("ـ", "")
    # بدائل
    for k,v in NORM_MAP.items():
        s = s.replace(k, v)
    s = re.sub(r"\s+", "", s)
    # إبقاء العربية والأرقام فقط
    s = re.sub(r"[^0-9\u0621-\u064A]", "", s)
    return s

# ---------- استعلامات Wikidata ----------
SPARQL_URL = "https://query.wikidata.org/sparql"
HEADERS = {"Accept":"application/sparql-results+json", "User-Agent":"MindGrid-Crossword/1.0"}

def q(sparql: str):
    try:
        r = requests.get(SPARQL_URL, params={"query": sparql}, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print("SPARQL failed:", e)
        return None

def fetch_capitals(limit=120):
    """
    يجلب: عاصمة + اسم الدولة (بالعربية إن أمكن)
    """
    sparql = """
    SELECT ?capitalLabel ?countryLabel WHERE {
      ?country wdt:P31 wd:Q6256 .
      ?country wdt:P36 ?capital .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
    }
    LIMIT %d
    """ % limit
    data = q(sparql)
    out = []
    if data:
        for b in data["results"]["bindings"]:
            cap = b.get("capitalLabel",{}).get("value","").strip()
            cty = b.get("countryLabel",{}).get("value","").strip()
            if not cap: continue
            ans = normalize_ar(cap)
            if 2 <= len(ans) <= 9:
                clue = f"عاصمة دولة {cty}؟" if cty else "عاصمة دولة؟"
                out.append({
                    "answer": ans,
                    "display": cap,
                    "clue": clue,
                    "topic": "عواصم"
                })
    return out

def fetch_elements(limit=130):
    """
    يجلب: عناصر كيميائية (اسم عربي، رمز، رقم ذري)
    """
    sparql = """
    SELECT ?itemLabel ?symbol ?Z WHERE {
      ?item wdt:P31 wd:Q11344 .
      OPTIONAL { ?item wdt:P246 ?symbol . }     # رمز العنصر
      OPTIONAL { ?item wdt:P1086 ?Z . }         # العدد الذري
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
    }
    LIMIT %d
    """ % limit
    data = q(sparql)
    out = []
    if data:
        for b in data["results"]["bindings"]:
            name = b.get("itemLabel",{}).get("value","").strip()
            if not name: continue
            ans = normalize_ar(name)
            if not (2 <= len(ans) <= 9): continue
            sym = b.get("symbol",{}).get("value","").strip()
            Z = b.get("Z",{}).get("value","").strip()
            if sym and Z:
                clue = f"عنصر كيميائي رمزه {sym} وعدده الذري {Z}."
            elif sym:
                clue = f"عنصر كيميائي رمزه {sym}."
            elif Z:
                clue = f"عنصر كيميائي عدده الذري {Z}."
            else:
                clue = "عنصر كيميائي."
            out.append({"answer": ans, "display": name, "clue": clue, "topic":"كيمياء"})
    return out

# ---------- بنك احتياطي ----------
FALLBACK_ITEMS = [
    ("غرناطة", "مدينة أندلسية سقطت آخر الممالك.", "تاريخ"),
    ("شفشاون", "مدينة مغربية زرقاء.", "جغرافيا"),
    ("اسوان", "مدينة على النيل تُلقّب بعروس الجنوب.", "جغرافيا"),
    ("برن", "عاصمة سويسرا.", "جغرافيا"),
    ("فنلندا", "بلد أوروبي عاصمته هلسنكي.", "جغرافيا"),
    ("ديكارت", "فيلسوف فرنسي صاحب الكوجيتو.", "فلسفة"),
    ("كانط", "صاحب «نقد العقل المحض».", "فلسفة"),
    ("زينون", "غاز نبيل عدده الذري 54.", "علوم"),
    ("المبرد", "عالم نحو بصري صاحب «الكامل».", "لغة"),
    ("امبير", "وحدة شدة التيار.", "علوم"),
    # فواصل قصيرة
    ("ال","أداة تعريف؟","لغة"),
    ("في","حرف جر؟","لغة"),
    ("من","حرف جر؟","لغة"),
    ("او","حرف عطف؟","لغة"),
    ("لا","حرف نهي؟","لغة"),
    ("ما","اسم استفهام؟","لغة"),
    ("يا","أداة نداء؟","لغة"),
    ("نعم","حرف جواب؟","لغة"),
]

def build_pool() -> Dict[int, List[Dict]]:
    random.seed(RANDOM_SEED)
    pool_by_len: Dict[int, List[Dict]] = {i:[] for i in range(2,10)}

    # من Wikidata
    wikidata_items = []
    capitals = fetch_capitals() or []
    elements = fetch_elements() or []
    wikidata_items.extend(capitals)
    wikidata_items.extend(elements)

    # احتياطي
    if not wikidata_items:
        for w,cl,topic in FALLBACK_ITEMS:
            wikidata_items.append({
                "answer": normalize_ar(w),
                "display": w,
                "clue": cl,
                "topic": topic
            })

    # فلترة الأطوال وتجميع
    seen = set()
    for item in wikidata_items:
        ans = normalize_ar(item["answer"])
        if not (2 <= len(ans) <= 9): continue
        if ans in seen: continue
        seen.add(ans)
        L = len(ans)
        pool_by_len[L].append(item)

    # إضافة بنك احتياطي قصير لتغطية خانات 2-3 إن نقصت
    for w,cl,topic in FALLBACK_ITEMS:
        ans = normalize_ar(w)
        L=len(ans)
        if 2<=L<=9 and all((x.get("answer")!=ans) for x in pool_by_len[L]):
            pool_by_len[L].append({"answer":ans,"display":w,"clue":cl,"topic":topic})

    # خلط
    for L in pool_by_len:
        random.shuffle(pool_by_len[L])

    return pool_by_len

# ---------- استخراج الخانات من النموذج ----------
def parse_slots(grid: List[str]) -> Tuple[List[Dict], List[Dict], Dict[Tuple[int,int], int]]:
    """
    يعيد:
      across_slots: [{n,r,c,len, cells:[(r,c),...]}]
      down_slots  : [{...}]
      idx_map: خريطة من (r,c) إلى مؤشر الخانة الأساس (للتقاطعات)
    """
    n_across, n_down = 0, 0
    across, down = [], []
    H, W = len(grid), len(grid[0])
    # عبرية
    for r in range(H):
        c = 0
        while c < W:
            if grid[r][c] != '#':
                start = c
                while c < W and grid[r][c] != '#':
                    c += 1
                length = c - start
                if length >= 2:
                    n_across += 1
                    cells = [(r, cc) for cc in range(start, c)]
                    across.append({"n": n_across, "r": r, "c": start, "len": length, "cells": cells})
            c += 1
    # طولية
    for c in range(W):
        r = 0
        while r < H:
            if grid[r][c] != '#':
                start = r
                while r < H and grid[r][c] != '#':
                    r += 1
                length = r - start
                if length >= 2:
                    n_down += 1
                    cells = [(rr, c) for rr in range(start, r)]
                    down.append({"n": n_down, "r": start, "c": c, "len": length, "cells": cells})
            r += 1
    return across, down, {}

# ---------- حل تعبئة الكلمات مع التقاء الحروف ----------
def backtrack_fill(across_slots, down_slots, pool_by_len):
    # لوحة الحروف
    grid_letters = [[None if ch != '#' else '#' for ch in row] for row in GRID]

    # قائمة الخانات بالترتيب (ابدأ بالأطول لتقليل التفرعات)
    slots = [("across", s) for s in sorted(across_slots, key=lambda x: -x["len"])] + \
            [("down",   s) for s in sorted(down_slots,   key=lambda x: -x["len"])]

    used_answers = set()
    assign = {}  # (type, n) -> dict{answer, display, clue, topic}

    def fits(slot, cand):
        # تحقق من توافق الحروف الموجودة
        for i,(r,c) in enumerate(slot["cells"]):
            ch = grid_letters[r][c]
            if ch is not None and ch != cand[i]:
                return False
        return True

    def place(slot, cand):
        placed = []
        for i,(r,c) in enumerate(slot["cells"]):
            if grid_letters[r][c] is None:
                grid_letters[r][c] = cand[i]
                placed.append((r,c))
        return placed

    def remove(placed):
        for (r,c) in placed:
            grid_letters[r][c] = None

    def try_slot(idx):
        if idx == len(slots):
            return True
        kind, slot = slots[idx]
        L = slot["len"]
        cands = pool_by_len.get(L, [])
        random.shuffle(cands)
        for item in cands:
            ans = item["answer"]
            if ans in used_answers: continue
            # تأكد طول وتطابق
            if len(ans) != L: continue
            if not fits(slot, ans): continue
            placed = place(slot, ans)
            used_answers.add(ans)
            assign[(kind, slot["n"])] = item
            if try_slot(idx+1):
                return True
            # backtrack
            used_answers.remove(ans)
            remove(placed)
            assign.pop((kind, slot["n"]), None)
        return False

    ok = try_slot(0)
    return ok, grid_letters, assign

# ---------- كتابة JSON ----------
def to_json(grid_letters, assign, across_slots, down_slots):
    # أعد تمثيل الشبكة كنصوص "." و "#"
    out_grid = []
    for r in range(GRID_SIZE):
        row = ""
        for c in range(GRID_SIZE):
            row += "#" if GRID[r][c] == "#" else "."
        out_grid.append(row)

    clues = {"across": [], "down": []}
    answers = {"across": {}, "down": {}}

    # across
    for s in across_slots:
        item = assign.get(("across", s["n"]))
        if not item:
            # خانة غير معبأة (نادرًا) — ضع تلميح افتراضي
            item = {"answer":"-"*s["len"], "display":"", "clue":"—", "topic":""}
        clues["across"].append({"n": s["n"], "r": s["r"], "c": s["c"], "len": s["len"], "text": item["clue"]})
        answers["across"][str(s["n"])] = item.get("display") or item["answer"]

    # down
    for s in down_slots:
        item = assign.get(("down", s["n"]))
        if not item:
            item = {"answer":"-"*s["len"], "display":"", "clue":"—", "topic":""}
        clues["down"].append({"n": s["n"], "r": s["r"], "c": s["c"], "len": s["len"], "text": item["clue"]})
        answers["down"][str(s["n"])] = item.get("display") or item["answer"]

    data = {
        "date": DATE_STR,
        "gridSize": GRID_SIZE,
        "grid": out_grid,
        "clues": clues,
        "answers": answers,
        "source": "Wikidata + fallback",
        "note": "الإجابة قد تُعرض باسم العرض (display) إن وُجد، بينما التحقق داخل التطبيق يطابق النسخة المُطبَّعة."
    }
    return data

# ---------- تشغيل ----------
def main():
    random.seed(RANDOM_SEED)

    # بناء مجمع مفردات
    pool_by_len = build_pool()

    # استخراج الخانات
    across_slots, down_slots, _ = parse_slots(GRID)

    # محاولة التعبئة
    ok, grid_letters, assign = backtrack_fill(across_slots, down_slots, pool_by_len)
    if not ok:
        # في حال الفشل (نادرًا): أعد الخلط وجرب عدة مرات، ثم ارجع لاحتياطي بحت
        for _ in range(4):
            pool_by_len = build_pool()
            ok, grid_letters, assign = backtrack_fill(across_slots, down_slots, pool_by_len)
            if ok: break
        if not ok:
            # تعبئة احتياطية مباشرة من بنك FALLBACK
            fb_pool = {i:[] for i in range(2,10)}
            for w,cl,topic in FALLBACK_ITEMS:
                ans = normalize_ar(w); L=len(ans)
                if 2<=L<=9: fb_pool[L].append({"answer":ans,"display":w,"clue":cl,"topic":topic})
            ok, grid_letters, assign = backtrack_fill(across_slots, down_slots, fb_pool)

    # إخراج JSON
    data = to_json(grid_letters, assign, across_slots, down_slots)

    # حفظ
    os.makedirs("content", exist_ok=True)
    out_path = os.path.join("content", "crossword_daily.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✓ crossword written to {out_path} (date={DATE_STR})")

if __name__ == "__main__":
    main()
