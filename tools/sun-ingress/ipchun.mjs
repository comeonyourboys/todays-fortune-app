// 띠가 바뀌는 기준인 입춘(태양 황경 315°) 시각과 설날(음력 1월 1일 = 1~2월 합삭일, KST)을 1948~2030년에 대해 계산해
// data/ipchun-calc.json 으로 쓴다. 띠별 신년운세의 "태어난 해" 표가 이 파일을 읽는다.
// 실행: cd tools/sun-ingress && npm ci && node ipchun.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const A = require('astronomy-engine');
const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, 'node_modules/astronomy-engine/package.json'), 'utf8'));
const root = join(here, '..', '..');
const FROM = 1948, TO = 2030;
const pad = (n) => String(n).padStart(2, '0');
const kst = (date) => { const d = new Date(Math.round((date.getTime() + 9 * 3600e3) / 60000) * 60000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };

// 설날: 동지(270°) 뒤 두 번째 합삭이 음력 1월 1일(윤11·12월이 끼는 드문 해는 예외가 있어 아래에서 검사)
const years = {};
for (let y = FROM; y <= TO; y++) {
  const ip = A.SearchSunLongitude(315, A.MakeTime(new Date(Date.UTC(y, 0, 20))), 30);
  const ws = A.SearchSunLongitude(270, A.MakeTime(new Date(Date.UTC(y - 1, 11, 1))), 40);
  const nm1 = A.SearchMoonPhase(0, ws, 40);
  const nm2 = A.SearchMoonPhase(0, nm1.AddDays(1), 40);
  const seol = kst(nm2.date).slice(0, 10);
  years[y] = { ipchun: kst(ip.date), seollal: seol };
}
// 알려진 설날과 맞춰 본다(틀리면 계산 방식을 다시 본다)
const KNOWN = { 1984: '1984-02-02', 1996: '1996-02-19', 2000: '2000-02-05', 2020: '2020-01-25', 2025: '2025-01-29', 2026: '2026-02-17' };
for (const [y, d] of Object.entries(KNOWN)) if (years[y].seollal !== d) throw new Error(`${y} 설날 계산 ${years[y].seollal} ≠ 알려진 값 ${d}`);

const out = {
  _comment: '입춘(태양 황경 315°) 시각과 설날(동지 뒤 두 번째 합삭일) — KST(UTC+9) 기준 계산값. 1948~1961·1987~1988년처럼 표준시·서머타임이 지금과 달랐던 해는 당시 시계와 최대 1시간 차이가 날 수 있다. 생성: tools/sun-ingress/ipchun.mjs',
  method: { library: `astronomy-engine ${pkg.version} (SearchSunLongitude, SearchMoonPhase)`, timezone: 'UTC+9' },
  years,
};
writeFileSync(join(root, 'data/ipchun-calc.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`data/ipchun-calc.json: ${FROM}~${TO}년 ${Object.keys(years).length}개, 2027 입춘 ${years[2027].ipchun} · 설날 ${years[2027].seollal}`);
