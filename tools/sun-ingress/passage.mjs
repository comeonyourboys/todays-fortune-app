// 태양이 IAU 별자리 경계(실제 하늘의 별자리 구역) 안을 지나는 기간을 계산해 data/sun-passage-iau.json 으로 쓴다.
// 실행: cd tools/sun-ingress && npm ci && node passage.mjs [연도]   (기본 2026)
// 방법: 1시간 간격으로 태양의 지구 중심 J2000 적경·적위(빛이 오는 시간 보정 포함)를 구해 Astronomy Engine 의 Constellation()
//       (IAU 별자리 경계로 판정)에 넣고, 별자리가 바뀌는 순간을 1분 단위까지 이분 탐색으로 좁힌다.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const A = require('astronomy-engine');
const pkg = JSON.parse(readFileSync(join(here, 'node_modules/astronomy-engine/package.json'), 'utf8'));
const root = join(here, '..', '..');
const YEAR = Number(process.argv[2] || 2026);

const at = (ms) => { const eq = A.Equator(A.Body.Sun, A.MakeTime(new Date(ms)), new A.Observer(0, 0, 0), false, true); return A.Constellation(eq.ra, eq.dec).symbol; };
const t0 = Date.UTC(YEAR - 1, 11, 1), t1 = Date.UTC(YEAR + 1, 1, 1);
const segs = [];
let prev = null;
for (let ms = t0; ms <= t1; ms += 3600e3) {
  const c = at(ms);
  if (c === prev) continue;
  let lo = ms - 3600e3, hi = ms;
  if (prev) while (hi - lo > 60e3) { const mid = (lo + hi) / 2; if (at(mid) === prev) lo = mid; else hi = mid; }
  segs.push({ abbr: c, start: prev ? hi : null });
  prev = c;
}
const kst = (ms) => new Date(Math.round((ms + 9 * 3600e3) / 60000) * 60000).toISOString().slice(0, 16);
const passages = [];
for (let i = 1; i < segs.length - 1; i++) {
  const s = segs[i], e = segs[i + 1];
  // 그해 KST 안에서 시작하거나 끝나는 구간만
  if (kst(e.start) < `${YEAR}-01-01` || kst(s.start) >= `${YEAR + 1}-01-01`) continue;
  passages.push({ abbr: s.abbr, startKst: kst(s.start), endKst: kst(e.start), days: Math.round((e.start - s.start) / 864e5 * 10) / 10 });
}
writeFileSync(join(root, 'data/sun-passage-iau.json'), JSON.stringify({
  _comment: 'tools/sun-ingress/passage.mjs 가 생성 — 직접 고치지 말 것. 시각은 KST(UTC+9), 분 단위 반올림.',
  year: YEAR,
  method: {
    library: `astronomy-engine ${pkg.version} (${pkg.license})`,
    url: 'https://github.com/cosinekitty/astronomy',
    text: '태양의 지구 중심 J2000 적경·적위를 1시간 간격으로 구해 Constellation() 함수(IAU 별자리 경계)로 어느 별자리 구역인지 판정하고, 바뀌는 순간을 1분 단위로 좁혔다.',
  },
  passages,
}, null, 1) + '\n');
console.log(passages.map((p) => `${p.abbr} ${p.startKst} → ${p.endKst} (${p.days}일)`).join('\n'));
