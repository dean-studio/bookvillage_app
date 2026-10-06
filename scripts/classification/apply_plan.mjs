// plan.json → books 분류 컬럼 반영. 관리자가 직접 분류한 책(classification_source='manual')은 건드리지 않음.
// 사용: set -a; . ./.env.prod; set +a; node scripts/classification/apply_plan.mjs <plan.json> [--dry]
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const [planPath, flag] = process.argv.slice(2);
const dry = flag === "--dry";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));

// 수동 분류된 책 제외
const manual = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from("books").select("id").eq("classification_source", "manual").range(from, from + 999);
  if (error) throw error;
  data.forEach((r) => manual.add(r.id));
  if (data.length < 1000) break;
}

// 같은 값끼리 묶어 일괄 update
const now = new Date().toISOString();
const groups = new Map();
for (const p of plan) {
  if (manual.has(p.id) || (!p.age_group && p.textbook_grades.length === 0)) continue;
  const payload = {
    age_group: p.age_group,
    sub_category: p.sub_category,
    series_name: p.series_name,
    textbook_grades: p.textbook_grades,
    classification_source: p.source,
    classified_at: p.age_group ? now : null,
  };
  const k = JSON.stringify(payload);
  if (!groups.has(k)) groups.set(k, { payload, ids: [] });
  groups.get(k).ids.push(p.id);
}

let updated = 0;
for (const { payload, ids } of groups.values()) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    if (!dry) {
      const { error } = await supabase.from("books").update(payload).in("id", chunk);
      if (error) throw new Error(`${JSON.stringify(payload)}: ${error.message}`);
    }
    updated += chunk.length;
  }
}
console.log(`${dry ? "[dry] " : ""}${updated}권 반영 (그룹 ${groups.size}개, 수동 분류 제외 ${manual.size}권)`);
