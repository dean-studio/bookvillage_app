// 사용: node lookup.mjs <입력.jsonl> <출력.jsonl>
// 책마다: 교보 검색(ISBN, data-bid 일치 항목) → 상품 상세 → 분류 링크(코드+이름) 수집. 중단 후 재실행 시 이어서.
import { chromium } from "playwright-core";
import fs from "fs";
const [inFile, outFile] = process.argv.slice(2);
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
const books = fs.readFileSync(inFile, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((b) => b.isbn && !done.has(b.id));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
let n = 0;
for (const b of books) {
  const rec = { ...b, kyobo_id: null, categories: [], error: null };
  try {
    await page.goto(`https://search.kyobobook.co.kr/search?keyword=${b.isbn}&gbCode=TOT&target=total`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(800);
    const link = await page.$$eval("li.prod_item, .prod_list > li", (lis, isbn) => {
      for (const li of lis) if (li.outerHTML.includes(`data-bid="${isbn}"`)) return li.querySelector("a[href*='/detail/']")?.href ?? null;
      return null;
    }, b.isbn);
    if (!link) {
      rec.error = "not_found";
    } else {
      rec.kyobo_id = link.match(/S\d+/)?.[0] ?? null;
      await sleep(1500);
      await page.goto(link, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1200);
      rec.categories = await page.$$eval("a[href*='/category/domestic/']", (as) => {
        const m = new Map();
        for (const a of as) {
          const code = a.getAttribute("href").match(/domestic\/(\d{2,})/)?.[1];
          if (code && !m.has(code)) m.set(code, a.textContent.trim());
        }
        return [...m.entries()];
      });
    }
  } catch (e) {
    rec.error = String(e.message || e).slice(0, 120);
  }
  fs.appendFileSync(outFile, JSON.stringify(rec) + "\n");
  n++;
  if (n % 10 === 0) console.log(`${n}/${books.length}`);
  await sleep(1500);
}
await browser.close();
console.log("done", n);
