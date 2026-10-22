// 태양이 황경 30° 배수(12중기)를 지나는 시각을 1950~2030년에 대해 계산해 data/sun-ingress-calc.json 으로 쓴다.
// 실행: cd tools/sun-ingress && npm ci && node gen.mjs
// 사이트 빌드(scripts/build.mjs)는 이 결과 JSON 만 읽으므로 매일 빌드에는 이 패키지가 필요 없다.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const A = require('astronomy-engine');
const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'node_modules/astronomy-engine/package.json'), 'utf8'));
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FROM = 1950, TO = 2030;

// 절기 이름·시작 별자리는 한국천문연구원 자료 파일의 표기를 그대로 쓴다
const kasi = JSON.parse(readFileSync(join(root, 'data/sun-ingress-kasi.json'), 'utf8'));
const meta = new Map(Object.values(kasi.years)[0].map((r) => [r.deg, { term: r.term, starts: r.starts }]));
const DEGS = [300, 330, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270]; // 1월 대한 → 12월 동지
const pad = (n) => String(n).padStart(2, '0');
// KST(UTC+9) 분 단위, 초는 반올림
const kstMinute = (date) => { const d = new Date(Math.round((date.getTime() + 9 * 3600e3) / 60000) * 60000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };

const years = {};
for (let y = FROM; y <= TO; y++) {
  let start = A.MakeTime(new Date(Date.UTC(y, 0, 1)));
  years[y] = DEGS.map((deg) => {
    const t = A.SearchSunLongitude(deg, start, 40);
    if (!t) throw new Error(`${y}년 ${deg}° 검색 실패`);
    start = t.AddDays(1);
    return { deg, ...meta.get(deg), kst: kstMinute(t.date) };
  });
  // 연도 경계 확인 — 열두 시각이 모두 그해 KST 안에 있어야 한다
  for (const r of years[y]) if (!r.kst.startsWith(String(y))) throw new Error(`${y}년 ${r.term} 시각이 다른 해(${r.kst})`);
}

const out = {
  _comment: '태양이 황경 30° 배수(12중기)를 지나는 시각을 astronomy-engine 으로 계산한 값. tools/sun-ingress/gen.mjs 가 생성한다 — 직접 고치지 말 것.',
  method: {
    library: `astronomy-engine ${pkg.version} (${pkg.license})`,
    url: 'https://github.com/cosinekitty/astronomy',
    function: 'SearchSunLongitude — 지구 중심에서 본 태양의 겉보기 황경(그날의 춘분점 기준, 세차·장동 반영, 빛이 오는 시간 보정)이 목표 각도가 되는 순간',
    rounding: 'UTC 결과에 9시간을 더해 KST 로 바꾸고 초는 반올림해 분 단위로 저장',
  },
  timezone: 'KST(UTC+9) 고정 — 과거 한국 표준시 변경·일광절약시간은 반영하지 않음',
  range: [FROM, TO],
  years,
};
writeFileSync(join(root, 'data/sun-ingress-calc.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`data/sun-ingress-calc.json — ${FROM}~${TO}년 ${Object.keys(years).length * 12}개 시각 (astronomy-engine ${pkg.version})`);
