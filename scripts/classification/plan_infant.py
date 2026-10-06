"""유아 서가 분류 계획 생성 (DB 쓰기 없음)
입력: infant_all.jsonl(h2books 유아 서가), infant_single.out.jsonl(교보 조회 결과), kyobo-textbook-2026-10.json
출력: plan.json — [{id, title, age_group, sub_category, series_name, textbook_grades, source}] + 요약 출력
"""
import json, sys, collections, os
sys.path.insert(0, os.path.dirname(__file__))
from series import series_of, key

SET_MIN = 5
SUB = {"01": "play", "03": "picture", "05": "culture", "07": "study", "09": "character"}
INFANT_TOP_SUB = {"4107": "play", "4109": "picture", "4111": "culture", "4115": "study", "4117": "character", "4119": "picture"}

def classify_kyobo(codes):
    """교보 분류 코드 → (age_group, sub_category). 유아인데 연령 표기 없으면 4~7세."""
    age, sub = None, None
    for prefix, a in (("4121", "age_0_3"), ("4123", "age_4_7")):
        hits = [c for c in codes if c.startswith(prefix) and len(c) >= 6]
        if hits or prefix in codes:
            age = a  # 둘 다 있으면 4~7세(뒤)가 남음
            sub = SUB.get(hits[0][4:6]) if hits else sub
    if age is None and any(c.startswith("41") for c in codes):
        age = "age_4_7"
    if age:
        sub = sub or next((INFANT_TOP_SUB[c] for c in codes if c in INFANT_TOP_SUB), None)
        return age, sub
    if any(c.startswith("42") for c in codes):
        return "elem_all", None
    return None, None

def main(infant_all, lookup_out, textbook_json, out_path):
    books = [json.loads(l) for l in open(infant_all)]
    lookups = {}
    for l in open(lookup_out):
        r = json.loads(l)
        lookups[r["id"]] = r
    textbook = collections.defaultdict(set)
    for r in json.load(open(textbook_json)):
        if r.get("isbn"):
            textbook[r["isbn"]].add(r["grade"])

    groups = collections.defaultdict(list)
    for b in books:
        name, _ = series_of(b["title"])
        if name:
            groups[key(name)].append(name)
    set_names = {k: collections.Counter(v).most_common(1)[0][0] for k, v in groups.items() if len(v) >= SET_MIN}

    plan, stat = [], collections.Counter()
    for b in books:
        name, _ = series_of(b["title"])
        rec = {"id": b["id"], "title": b["title"], "age_group": None, "sub_category": None,
               "series_name": None, "textbook_grades": sorted(textbook.get(b["isbn"] or "", [])), "source": None}
        if name and key(name) in set_names:
            rec.update(age_group="infant_set", series_name=set_names[key(name)], source="series")
            stat["유아 전집"] += 1
        elif b["id"] in lookups and not lookups[b["id"]]["error"]:
            age, sub = classify_kyobo([c for c, _ in lookups[b["id"]]["categories"]])
            if age:
                rec.update(age_group=age, sub_category=sub, source="kyobo")
            stat[f"교보:{age or '분류불가'}"] += 1
        elif b["id"] in lookups:
            stat["교보에서 못 찾음"] += 1
        elif b["isbn"]:
            stat["교보 미조회"] += 1
        else:
            stat["ISBN 없음(전집 아님)"] += 1
        plan.append(rec)

    json.dump(plan, open(out_path, "w"), ensure_ascii=False, indent=1)
    print(f"유아 서가 {len(books)}권 → 분류 {sum(1 for p in plan if p['age_group'])}권")
    for k, v in stat.most_common():
        print(f"  {k}: {v}")
    sub = collections.Counter((p["age_group"], p["sub_category"]) for p in plan if p["age_group"] in ("age_0_3", "age_4_7"))
    print("  유아 단행본 하위:", {f"{a}/{s}": n for (a, s), n in sorted(sub.items(), key=lambda x: -x[1])})
    print("  전집:", len(set_names), "종")
    print("  교과연계 표시:", sum(1 for p in plan if p["textbook_grades"]), "권")

if __name__ == "__main__":
    main(*sys.argv[1:5])
