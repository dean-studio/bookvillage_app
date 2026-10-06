"""알라딘 ItemLookUp(공식 API)으로 ISBN별 categoryName 조회. 재실행 시 이어서.
사용: ALADIN_TTB_KEY=... python3 aladin_lookup.py <입력.jsonl> <출력.jsonl>"""
import json, os, sys, time, urllib.request
key = os.environ["ALADIN_TTB_KEY"]
src, dst = sys.argv[1], sys.argv[2]
done = set()
if os.path.exists(dst):
    done = {json.loads(l)["id"] for l in open(dst) if l.strip()}
with open(dst, "a") as out:
    for line in open(src):
        b = json.loads(line)
        if not b.get("isbn") or b["id"] in done:
            continue
        url = ("https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=%s&itemIdType=ISBN13&ItemId=%s"
               "&output=js&Version=20131101" % (key, b["isbn"]))
        rec = {**b, "aladin_category": None, "error": None}
        try:
            raw = urllib.request.urlopen(url, timeout=20).read().decode("utf-8").rstrip().rstrip(";")
            data = json.loads(raw)
            items = data.get("item") or []
            rec["aladin_category"] = items[0].get("categoryName") if items else None
            if not items:
                rec["error"] = data.get("errorMessage") or "not_found"
        except Exception as e:
            rec["error"] = str(e)[:100]
        out.write(json.dumps(rec, ensure_ascii=False) + "\n")
        out.flush()
        time.sleep(1)
print("done")
