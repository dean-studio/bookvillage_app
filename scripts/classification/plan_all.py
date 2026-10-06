"""h2books 전체 분류 계획 생성 (DB 쓰기 없음)

입력(작업 폴더 DIR 안):
  infant_all.jsonl, infant_single.out.jsonl   유아 서가 + 교보 조회
  elem_all.jsonl, elem_wp.jsonl, elem_lookup.out.jsonl   초등·고학년·세계사 서가 + 상식이 DB + 교보 조회
  other_all.jsonl, other_aladin.out.jsonl     일반·영어원문 서가 + 알라딘 조회
  kyobo-textbook-2026-10.json (이 스크립트 폴더)  교과연계 학년 목록
출력: DIR/plan.json  [{id, title, shelf, age_group, sub_category, series_name, textbook_grades, source}]
사용: python3 plan_all.py <DIR>
"""
import json, os, re, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from series import series_of, key
from plan_infant import classify_kyobo as classify_infant_codes

SET_MIN = 5
GRADE_CODES = {"4210": "elem_1_2", "4212": "elem_1_2", "4214": "elem_3_4", "4216": "elem_5_6"}
GRADE_NAMES = {"초등1-2학년": "elem_1_2", "초등3-4학년": "elem_3_4", "초등5-6학년": "elem_5_6", "초등학교 입학준비": "elem_1_2"}

ADULT_GENRES = [  # 알라딘 categoryName 2단계 → 일반 장르
    ("소설/시/희곡", "novel"), ("에세이", "essay"), ("인문학", "humanities"), ("사회과학", "humanities"),
    ("역사", "humanities"), ("예술/대중문화", "humanities"), ("과학", "science"), ("자기계발", "selfhelp"),
    ("경제경영", "economy"), ("좋은부모", "parenting"), ("건강/취미", "hobby"),
    ("요리/살림", "hobby"), ("여행", "hobby"), ("가정/요리/뷰티", "hobby"), ("취미/레저", "hobby"),
    ("종교/역학", "religion"),
]

def load(path):
    return [json.loads(l) for l in open(path)] if os.path.exists(path) else []

def textbook_index():
    idx = collections.defaultdict(set)
    for r in json.load(open(os.path.join(HERE, "kyobo-textbook-2026-10.json"))):
        if r.get("isbn"):
            idx[r["isbn"]].add(r["grade"])
    return idx

def series_names(rows):
    groups = collections.defaultdict(list)
    for r in rows:
        name, _ = series_of(r["title"])
        if name:
            groups[key(name)].append(name)
    return {k: collections.Counter(v).most_common(1)[0][0] for k, v in groups.items() if len(v) >= SET_MIN}

def elem_from_grades(grades):
    """여러 학년 분류에 걸치면 전학년"""
    grades = set(grades)
    return grades.pop() if len(grades) == 1 else "elem_all"

def classify_elem_codes(cats):
    codes = [c for c, _ in cats]
    names = {n for _, n in cats}
    if "청소년" in names:
        return "teen"
    grades = [g for c, g in GRADE_CODES.items() if c in codes]
    if grades:
        return elem_from_grades(grades)
    if any(c.startswith("42") for c in codes):
        return "elem_all"
    if any(c.startswith("41") for c in codes):
        return classify_infant_codes(codes)[0]
    return None

def classify_elem_names(paths):
    nodes = {n for p in paths for n in p}
    tops = {p[1] for p in paths if len(p) > 1}
    if "청소년" in tops:
        return "teen"
    grades = [g for n, g in GRADE_NAMES.items() if n in nodes]
    if grades:
        return elem_from_grades(grades)
    if "어린이(초등)" in tops or "초등1-6학년" in nodes:
        return "elem_all"
    if "유아(0~7세)" in tops:
        return "age_0_3" if "0~3세" in nodes else "age_4_7"
    return None

ALADIN_GRADES = {"초등1~2학년": "elem_1_2", "초등3~4학년": "elem_3_4", "초등5~6학년": "elem_5_6"}

def adult_genre(category_name):
    """알라딘 분류 → (연령, 장르). 책장 재배치용이라 서가보다 책 자체 분류 우선."""
    parts = (category_name or "").split(">")
    second = parts[1] if len(parts) > 1 else ""
    if second == "청소년":
        return "teen", None
    if second == "어린이":
        grades = [g for n, g in ALADIN_GRADES.items() if n in parts]
        return (grades[0] if len(grades) == 1 else "elem_all"), None
    if second == "유아":
        return ("age_0_3" if "0~3세" in parts else "age_4_7"), None
    for prefix, genre in ADULT_GENRES:
        if second.startswith(prefix):
            return "adult", genre
    return "adult", "etc" if second else None

def main(d):
    tb = textbook_index()
    plan, stat = [], collections.Counter()

    # 1) 유아: 전집 판정(제목) → 교보 분류
    infant = load(os.path.join(d, "infant_all.jsonl"))
    infant_lookup = {r["id"]: r for r in load(os.path.join(d, "infant_single.out.jsonl"))}
    infant_sets = series_names(infant)
    for b in infant:
        rec = base(b, tb)
        name, _ = series_of(b["title"])
        if name and key(name) in infant_sets:
            rec.update(age_group="infant_set", series_name=infant_sets[key(name)], source="series")
        elif b["id"] in infant_lookup and not infant_lookup[b["id"]]["error"]:
            age, sub = classify_infant_codes([c for c, _ in infant_lookup[b["id"]]["categories"]])
            if age:
                rec.update(age_group=age, sub_category=sub, source="kyobo")
        plan.append(rec)

    # 2) 초등·고학년·세계사: 상식이 DB(교보 분류 이름) → 교보 조회(코드) → 서가 기본값
    elem = load(os.path.join(d, "elem_all.jsonl"))
    wp = {r["id"]: r["wp_paths"] for r in load(os.path.join(d, "elem_wp.jsonl"))}
    elem_lookup = {r["id"]: r for r in load(os.path.join(d, "elem_lookup.out.jsonl"))}
    elem_series = series_names(elem)
    for b in elem:
        rec = base(b, tb)
        age, source = None, None
        if b["id"] in wp:
            age, source = classify_elem_names(wp[b["id"]]), "kyobo"
        elif b["id"] in elem_lookup and not elem_lookup[b["id"]]["error"]:
            cats = elem_lookup[b["id"]]["categories"]
            age, source = classify_elem_codes(cats), "kyobo"
            grades = {int(c[5]) for c, _ in cats if c.startswith("42020") and len(c) == 6 and c[5] in "123456"}
            rec["textbook_grades"] = sorted(set(rec["textbook_grades"]) | grades)
        if not age:
            age, source = "elem_all", "shelf"  # 초등 서가에 있으니 기본은 초등 전학년
        if age == "elem_all" and b["shelf"] == "고학년":
            age, source = "elem_5_6", "shelf"  # 고학년 서가는 5~6학년
        name, _ = series_of(b["title"])
        rec.update(age_group=age, source=source,
                   series_name=elem_series.get(key(name)) if name else None)
        plan.append(rec)

    # 3) 일반: 알라딘 장르 / 영어원문: 영어원서
    other = load(os.path.join(d, "other_all.jsonl"))
    aladin = {r["id"]: r for r in load(os.path.join(d, "other_aladin.out.jsonl"))}
    for b in other:
        rec = base(b, tb)
        if b["shelf"] == "영어원문":
            rec.update(age_group="english", source="shelf")
        elif b["id"] in aladin and aladin[b["id"]].get("aladin_category"):
            age, genre = adult_genre(aladin[b["id"]]["aladin_category"])
            rec.update(age_group=age, sub_category=genre, source="aladin")
        else:
            rec.update(age_group="adult", source="shelf")
        plan.append(rec)

    json.dump(plan, open(os.path.join(d, "plan.json"), "w"), ensure_ascii=False, indent=1)
    report(plan, infant_sets, elem_series)

def base(b, tb):
    return {"id": b["id"], "title": b["title"], "shelf": b["shelf"], "age_group": None, "sub_category": None,
            "series_name": None, "textbook_grades": sorted(tb.get(b.get("isbn") or "", [])), "source": None}

def report(plan, infant_sets, elem_series):
    total = len(plan)
    done = sum(1 for p in plan if p["age_group"])
    print(f"대상 {total}권 → 분류 {done}권 ({done * 100 // max(total, 1)}%), 미분류 {total - done}권")
    by_shelf = collections.defaultdict(collections.Counter)
    for p in plan:
        by_shelf[re.sub(r"[A-Z0-9]+$", "", p["shelf"])][p["age_group"] or "미분류"] += 1
    for shelf, c in by_shelf.items():
        print(f"  [{shelf}] " + ", ".join(f"{k} {v}" for k, v in c.most_common()))
    subs = collections.Counter(f"{p['age_group']}/{p['sub_category']}" for p in plan if p["sub_category"])
    print("  하위 분류:", dict(subs.most_common()))
    src = collections.Counter(p["source"] or "-" for p in plan)
    print("  출처:", dict(src))
    print(f"  유아 전집 {len(infant_sets)}종 / 초등 시리즈 {len(elem_series)}종 / 교과연계 표시 {sum(1 for p in plan if p['textbook_grades'])}권")

if __name__ == "__main__":
    main(sys.argv[1])
