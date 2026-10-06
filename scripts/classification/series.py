import json, re, collections, sys
# 판형 표기 제거 (끝이 잘린 "(양장본 HardCov" 포함)
FORMAT = re.compile(r'\((양장본|보드북|세이펜|팝업북|반양장|스프링|빅북|사철|무선|Paperback|HardCover)[^()]*\)?', re.I)

def series_of(title):
    t = FORMAT.sub('', title).strip().rstrip('.').strip()
    # A: "시리즈명 22: 제목" / "시리즈명 : 제목"
    m = re.match(r'^([^()]+?)\s*(\d+)?\s*[:：]\s*\S', t)
    if m and len(m.group(1)) >= 2:
        return m.group(1).strip(), m.group(2)
    # B: "제목(시리즈명 8)" / "제목(시리즈명 72: 부제)"
    m = re.search(r'\(([^()]+?)\s*(\d+)?\s*(?:[:：][^()]*)?\)?\s*$', t)
    if m:
        return m.group(1).strip(), m.group(2)
    return None, None

def key(name):
    return re.sub(r'\s+', '', name).casefold()

if __name__ == "__main__":
    rows = [json.loads(l) for l in open(sys.argv[1])]
    groups = collections.defaultdict(list)
    for r in rows:
        name, no = series_of(r['title'])
        if name: groups[key(name)].append((name, r))
    MIN = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    sets = {k: v for k, v in groups.items() if len(v) >= MIN}
    in_set = sum(len(v) for v in sets.values())
    no_isbn = [r for r in rows if not r['isbn']]
    no_isbn_set = sum(1 for k, v in sets.items() for _, r in v if not r['isbn'])
    print(f"유아 {len(rows)}권 중 전집({MIN}권 이상 시리즈) {len(sets)}종 {in_set}권")
    print(f"  ISBN 없는 {len(no_isbn)}권 중 전집 {no_isbn_set}권")
    for k, v in sorted(sets.items(), key=lambda x: -len(x[1]))[:45]:
        names = collections.Counter(n for n, _ in v).most_common(1)[0][0]
        isbn_n = sum(1 for _, r in v if r['isbn'])
        print(f"  {len(v):4}권 {names[:26]:<26} (ISBN {isbn_n})  예: {v[0][1]['title'][:30]}")
    rest = [r for r in no_isbn if not any(r is x for v in sets.values() for _, x in v)]
    print("ISBN 없고 전집 아닌 책 예:", [r['title'] for r in rest[:20]])
