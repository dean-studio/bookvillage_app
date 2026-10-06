"""미분류(대부분 유아 서가) → 최대한 자리 정하기 (DB 쓰기 없음)
1) 알라딘 제목 검색 일치도 0.85+ & 유아/어린이 분야 → 알라딘 분류
2) 남은 책 중 같은 시리즈 3권 이상 → 유아 전집 (기존 전집 이름과 같으면 합침)
3) 나머지 → 유아 4~7세 (근거: 서가)
출력: data/plan_unclassified.json"""
import json, collections, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from series import series_of, key

rows = [json.loads(l) for l in open("data/unclassified_aladin.out.jsonl")]
plan = json.load(open("data/plan.json"))
existing_sets = {key(p["series_name"]): p["series_name"] for p in plan if p["age_group"] == "infant_set" and p["series_name"]}

INFANT_SUB = [("놀이", "play"), ("그림책", "picture"), ("학습", "study"), ("교양", "culture"), ("캐릭터", "character"), ("애니메이션", "character")]
ALADIN_GRADES = {"초등1~2학년": "elem_1_2", "초등3~4학년": "elem_3_4", "초등5~6학년": "elem_5_6"}

def from_aladin(cat):
    parts = (cat or "").split(">")
    top = parts[1] if len(parts) > 1 else ""
    if top == "유아":
        age = "age_0_3" if "0~3세" in parts else "age_4_7"
        rest = ">".join(parts[2:])
        sub = next((v for k, v in INFANT_SUB if k in rest), None)
        return age, sub
    if top == "어린이":
        grades = [g for n, g in ALADIN_GRADES.items() if n in parts]
        return (grades[0] if len(grades) == 1 else "elem_all"), None
    return None, None

out, stat = [], collections.Counter()
rest = []
for r in rows:
    age, sub = (None, None)
    if r["score"] >= 0.85:
        age, sub = from_aladin(r["aladin_category"])
    if age:
        out.append({"id": r["id"], "title": r["title"], "age_group": age, "sub_category": sub, "series_name": None,
                    "source": "aladin", "match": r["match_title"]})
        stat[f"알라딘:{age}"] += 1
    else:
        rest.append(r)

groups = collections.defaultdict(list)
for r in rest:
    name, _ = series_of(r["title"])
    if name:
        groups[key(name)].append((name, r))
for r in rest:
    name, _ = series_of(r["title"])
    k = key(name) if name else None
    if k and (k in existing_sets or len(groups[k]) >= 3):
        series = existing_sets.get(k) or collections.Counter(n for n, _ in groups[k]).most_common(1)[0][0]
        out.append({"id": r["id"], "title": r["title"], "age_group": "infant_set", "sub_category": None,
                    "series_name": series, "source": "series"})
        stat["전집(3권+ 또는 기존 전집)"] += 1
    else:
        out.append({"id": r["id"], "title": r["title"], "age_group": "age_4_7", "sub_category": None,
                    "series_name": None, "source": "shelf"})
        stat["유아 4~7세(서가 기준)"] += 1

json.dump(out, open("data/plan_unclassified.json", "w"), ensure_ascii=False, indent=1)
print(f"미분류 {len(rows)}권 → 전부 자리 지정")
for k, v in stat.most_common():
    print(f"  {k}: {v}")
new_sets = collections.Counter(o["series_name"] for o in out if o["source"] == "series")
print("  전집:", dict(new_sets.most_common(15)))
print("  서가 기준 예:", [o["title"][:18] for o in out if o["source"] == "shelf"][:12])
