"""알라딘 ItemSearch(공식 API)로 제목 검색 → 가장 비슷한 책의 categoryName. 재실행 시 이어서.
사용: ALADIN_TTB_KEY=... python3 aladin_title_search.py <입력.jsonl> <출력.jsonl>"""
import json, os, re, sys, time, urllib.parse, urllib.request
from difflib import SequenceMatcher

key = os.environ["ALADIN_TTB_KEY"]
src, dst = sys.argv[1], sys.argv[2]
FORMAT = re.compile(r'\((양장본|보드북|세이펜|팝업북|반양장|스프링|빅북|사철|무선|Paperback|HardCover)[^()]*\)?', re.I)

def norm(t):
    return re.sub(r'[\s\W_]+', '', FORMAT.sub('', t or '')).casefold()

def queries(title):
    t = FORMAT.sub('', title).strip().rstrip('.')
    out = [t]
    m = re.match(r'^([^()]+?)\s*(\d+)?\s*[:：]\s*(.+)$', t)   # "시리즈 23: 제목" → "제목", "시리즈 제목"
    if m:
        out += [m.group(3).strip(), f"{m.group(1).strip()} {m.group(3).strip()}"]
    m = re.match(r'^(.+?)\(', t)                              # "제목(시리즈 8)" → "제목"
    if m:
        out.append(m.group(1).strip())
    return list(dict.fromkeys(q for q in out if len(q) >= 2))

def search(q):
    url = ("https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=%s&Query=%s&QueryType=Keyword"
           "&MaxResults=10&SearchTarget=Book&output=js&Version=20131101" % (key, urllib.parse.quote(q)))
    raw = urllib.request.urlopen(url, timeout=20).read().decode("utf-8").rstrip().rstrip(";")
    return json.loads(raw).get("item") or []

done = set()
if os.path.exists(dst):
    done = {json.loads(l)["id"] for l in open(dst) if l.strip()}
with open(dst, "a") as out:
    for line in open(src):
        b = json.loads(line)
        if b["id"] in done:
            continue
        best, score, used = None, 0.0, None
        try:
            for q in queries(b["title"]):
                for it in search(q):
                    # 원래 제목 또는 검색어(부제)와 얼마나 비슷한지
                    s = max(SequenceMatcher(None, norm(b["title"]), norm(it["title"])).ratio(),
                            SequenceMatcher(None, norm(q), norm(it["title"])).ratio())
                    if s > score:
                        best, score, used = it, s, q
                time.sleep(1)
                if score >= 0.9:
                    break
            err = None
        except Exception as e:
            err = str(e)[:100]
        out.write(json.dumps({**b, "query": used, "score": round(score, 3),
                              "match_title": best and best["title"], "match_isbn": best and best.get("isbn13"),
                              "aladin_category": best and best.get("categoryName"), "error": err}, ensure_ascii=False) + "\n")
        out.flush()
print("done")
