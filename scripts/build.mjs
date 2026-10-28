// data/*.json → 정적 HTML 생성
//  - zodiac/<key>/index.html           12장 (본문이 HTML에 직접 들어감)
//  - zodiac/<key>/<YYYY-MM>/index.html 월별 운세 (이번 달·다음 달만, noindex)
//  - compatibility/<a>/index.html      별자리별 궁합 12장 (조합 78개를 상대 별자리 섹션으로)
//  - vercel.json redirects             지난달 월별·예전 조합별 궁합 주소 → 301
//  - zodiac-calculator/, guide/...     별자리 계산기·기초 설명
//  - index.html                        홈 (별자리 카드 + 소개 본문)
//  - sitemap.xml
// 실행: node scripts/build.mjs [YYYY-MM-DD]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SRC, MOD_OF, MOD_NAME, CLASSIC_RULER, QUAL } from './content.mjs';
import { makeGuides } from './guides.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = {
  url: 'https://todays-fortune-app.vercel.app',
  name: '오늘의 운세',
  desc: '12별자리 오늘의 운세와 이달의 운세, 별자리 궁합 78가지, 생일로 찾는 별자리 계산기를 한곳에서 확인하세요.',
  ogImage: 'https://todays-fortune-app.vercel.app/og-image.png?v=2',
  // 카카오 애드핏 — 2026-08 에 이 사이트 매체로 등록해 둔 기존 광고 단위
  adfit: { bottom: 'DAN-XKdPIuDkSo3uxN1l', side: ['DAN-PJDk9Ix8QSZwmho2', 'DAN-oPwQwRMLYEcXD02F'] },
  gsv: ['1f373KtNH3atCzIil1snRuWtDwrzIfDYspZs5GWiRT4', 'WjzFs7iu4kDSzcJKM5QyAqGDAqx9J1P0uj-Ry4z1_NU'], // Search Console 인증 토큰(계정별). 어느 계정으로도 인증되게 모두 둔다
};

// 하단 320x50 은 모든 화면에 둔다. 160x600 두 개는 넓은 화면(1180px 이상)에서만, 페이지가 마련해 둔 자리
// (data-adfit="0|1", 홈은 오늘 운세 옆·경계 시각표 옆, 나머지 페이지는 본문 오른쪽 세로 단)에 스크립트로 만들어 넣는다.
// 좁은 화면에 숨긴 광고를 두지 않기 위해서다. 광고가 비어도 자리는 빈 칸으로 남을 뿐 본문 배치는 그대로다.
const ADFIT_MIN = 1180;
const adSlot = (i) => `<div class="ad-slot" data-adfit="${i}"></div>`;
const adfitHtml = () => `<div class="adfit-bottom"><ins class="kakao_ad_area" style="display:none;" data-ad-unit="${SITE.adfit.bottom}" data-ad-width="320" data-ad-height="50"></ins></div>
<script>(function(){if(window.innerWidth<${ADFIT_MIN})return;var ids=${JSON.stringify(SITE.adfit.side)};document.querySelectorAll('[data-adfit]').forEach(function(d){var id=ids[+d.getAttribute('data-adfit')];if(!id)return;d.innerHTML='<ins class="kakao_ad_area" style="display:none;" data-ad-unit="'+id+'" data-ad-width="160" data-ad-height="600"></ins>';d.className+=' on';});})();</script>
<script async src="https://t1.kakaocdn.net/kas/static/ba.min.js"></script>`;
const signs = JSON.parse(readFileSync(join(root, 'data/signs.json'), 'utf8'));
const profiles = ['profiles-a.json', 'profiles-b.json'].reduce((acc, f) => {
  const p = join(root, 'data', f);
  return existsSync(p) ? { ...acc, ...JSON.parse(readFileSync(p, 'utf8')) } : acc;
}, {});
const missing = signs.filter((s) => !profiles[s.k]).map((s) => s.k);
if (missing.length) { console.error(`✖ 프로필 없음: ${missing.join(', ')} — data/profiles-a.json, profiles-b.json 확인`); process.exit(1); }

const BUILD = process.argv[2] ? new Date(process.argv[2] + 'T00:00:00+09:00') : new Date();
const kst = new Date(BUILD.getTime() + 9 * 3600e3);
const Y = kst.getUTCFullYear(), M = kst.getUTCMonth() + 1, D = kst.getUTCDate();
const MM = String(M).padStart(2, '0'), DD = String(D).padStart(2, '0');
const TODAY = `${Y}-${MM}-${DD}`;
const fortunePath = join(root, `data/fortune-${Y}-${MM}.json`);
if (!existsSync(fortunePath)) { console.error(`✖ ${fortunePath} 없음 — 그달 운세 데이터(data/fortune-YYYY-MM.json)를 먼저 추가하세요`); process.exit(1); }
const fortune = JSON.parse(readFileSync(fortunePath, 'utf8'));
// 새 페이지(궁합 상세·가이드·계산기)의 본문을 마지막으로 고친 날. 본문을 고치면 함께 올린다 — sitemap lastmod 에 쓴다
const CONTENT_UPDATED = '2026-10-22';

// ---------- 월별 운세 데이터 ----------
// data/fortune-YYYY-MM.json 마다 월별 페이지를 만든다. 빌드 기준일(KST)의 달 파일은 반드시 있어야 한다.
const WD = ['일', '월', '화', '수', '목', '금', '토'];
// 문장 속 "X요일" 가운데 그날 자신을 가리키는 언급만 실제 요일과 비교한다.
// "내일·다음·주말·~면 금요일이…"처럼 앞으로 올 요일, "월요일병" 같은 관용어는 제외한다.
const todayWeekdays = (text) => {
  const out = [];
  for (const sent of String(text).split(/(?<=[.!?])\s+/)) {
    for (const m of sent.matchAll(/([일월화수목금토])요일/g)) {
      const before = sent.slice(0, m.index), after = sent.slice(m.index + m[0].length);
      if (/(내일|모레|다음|주말|이번 주|남은|까지|그래야|그러면|[가-힣]면\s|[가-힣]면서\s|오기 전|앞두고|기다리)/.test(before)) continue;
      if (/^(병|까지|이 오|이 되|이 오기|의 표정|에\s|에는|을 위|을 앞|부터)/.test(after)) continue;
      out.push(m[1]);
    }
  }
  return out;
};
// 월별 페이지는 빌드 기준일의 이번 달과 다음 달(데이터가 있으면)만 만든다. 지난달 데이터 파일은 기록으로 남겨 두되
// 페이지는 만들지 않고, 그 주소는 별자리 페이지로 301 한다(아래 vercel.json redirects 생성). 월이 바뀌면 자동으로 빠진다.
const ymOf = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const NEXT_YM = M === 12 ? ymOf(Y + 1, 1) : ymOf(Y, M + 1);
const allMonthFiles = readdirSync(join(root, 'data'))
  .map((f) => f.match(/^fortune-(\d{4})-(\d{2})\.json$/)).filter(Boolean)
  .map((m) => ({ f: m[0], y: Number(m[1]), m: Number(m[2]), ym: `${m[1]}-${m[2]}` }))
  .sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
const pastMonths = allMonthFiles.filter((mo) => mo.y * 12 + mo.m < Y * 12 + M).map((mo) => mo.ym);
const months = allMonthFiles
  .filter((mo) => mo.ym === ymOf(Y, M) || mo.ym === NEXT_YM)
  .map((mo) => ({ y: mo.y, m: mo.m, ym: mo.ym, data: mo.y === Y && mo.m === M ? fortune : JSON.parse(readFileSync(join(root, 'data', mo.f), 'utf8')) }));
for (const mo of months) {
  mo.days = new Date(Date.UTC(mo.y, mo.m, 0)).getUTCDate();
  mo.wd = (d) => WD[new Date(Date.UTC(mo.y, mo.m - 1, d)).getUTCDay()];
  const cal = join(root, `data/calendar-${mo.ym}.json`);
  mo.events = existsSync(cal) ? JSON.parse(readFileSync(cal, 'utf8')).events || [] : [];
  const ov = join(root, `data/monthly-overview-${mo.ym}.json`);
  mo.overview = existsSync(ov) ? JSON.parse(readFileSync(ov, 'utf8')) : {};
  const noOv = signs.filter((s) => !mo.overview[s.k]).length;
  if (noOv) console.warn(`  ⚠ ${mo.ym} 월별 흐름 요약 없음 ${noOv}개 — data/monthly-overview-${mo.ym}.json 을 채우면 페이지에 표시됩니다`);
  // 품질 판정 — 요일이 실제 달력과 어긋난 문장, 반말 문장, 빈 항목. 기준을 넘으면 그 달 페이지는 noindex + sitemap 제외.
  let missing = 0, wdBad = 0, banmal = 0, total = 0;
  mo.wdBadList = [];
  for (const s of signs) for (let d = 1; d <= mo.days; d++) {
    const f = mo.data[s.k]?.[String(d).padStart(2, '0')];
    total++;
    if (!f || !['summary', 'love', 'work', 'money'].every((x) => String(f[x] ?? '').trim())) { missing++; continue; }
    const named = todayWeekdays(f.summary);
    if (named.length && !named.includes(mo.wd(d))) { wdBad++; mo.wdBadList.push(`${s.k} ${d}일`); }
    const sents = Object.values(f).join(' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    if (sents.some((x) => /(?:[^니]다|[^세]라|[가-힣]해|않나|[가-힣]지)[.!?]?$/.test(x) && !/(니다|세요|어요|아요|해요|죠|까요|네요|군요)[.!?]?$/.test(x))) banmal++;
  }
  mo.check = { missing, wdBad, banmal, total };
  mo.indexable = missing === 0 && wdBad === 0 && banmal / total < 0.1;
  if (!mo.indexable) console.warn(`  ⚠ ${mo.ym} 운세 데이터 품질 기준 미달(빈 항목 ${missing}, 요일 불일치 ${wdBad}${wdBad ? ` [${mo.wdBadList.slice(0, 5).join(', ')}]` : ''}, 반말 의심 ${banmal}/${total}) — 월별 페이지를 noindex 로 둡니다`);
}
const curMonth = months.find((mo) => mo.y === Y && mo.m === M);
const monthUrl = (k, mo) => `/zodiac/${k}/${mo.ym}`;
const style = readFileSync(join(root, 'src/site.css'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (t) => String(t).split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const byKey = new Map(signs.map((s) => [s.k, s]));
const urlOf = (k) => `/zodiac/${k}`;   // trailingSlash:false 라 슬래시 없이 링크
const dayKey = (d) => String(d).padStart(2, '0');
const fortuneOf = (k, d) => fortune[k]?.[dayKey(d)] ?? fortune[k]?.[String(d)] ?? null;
const daysInMonth = new Date(Y, M, 0).getDate();

let pages = 0;
const written = [];
const write = (rel, html) => { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); pages++; written.push(rel); };

// 하단 "다른 도구" 줄 — comeonyourboyz 가 만든 사이트 8개. 자기 사이트는 강조한다
const TOOLS = [
  ['내 연봉 순위', 'https://salaryrank.web.app'],
  ['오늘의 운세', SITE.url],
  ['꿈해몽 사전', 'https://dreamdict.web.app'],
  ['사자성어·속담 사전', 'https://idiomdict.web.app'],
  ['실내식물 사전', 'https://plantdict.web.app'],
  ['선물 룰렛', 'https://giftwheel.web.app'],
  ['My Korean Name', 'https://mykoreanname.web.app'],
  ['Tangerine 10', 'https://tangerin10.web.app'],
];
const NAV = [['home', '/', '별자리 12'], ['compat', '/compatibility', '궁합'], ['calc', '/zodiac-calculator', '계산기'], ['guide', '/guide', '기초'], ['about', '/about', '소개']];
const TODAY_KO = `${Y}년 ${M}월 ${D}일 ${WD[new Date(Date.UTC(Y, M - 1, D)).getUTCDay()]}요일`;

// rail: 본문 오른쪽 세로 단(넓은 화면 광고 자리). 홈처럼 자체 배치가 있으면 false
function layout({ title, desc, path, body, ld = [], extraHead = '', extraScript = '', robots = 'index, follow', nav = '', rail = true, ads = true }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon.png" sizes="512x512">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE.url}${path}">
<meta name="robots" content="${robots}">
${SITE.gsv.map((t) => `<meta name="google-site-verification" content="${t}">`).join('\n')}
<meta name="google-adsense-account" content="ca-pub-5479403345572412">
<meta name="theme-color" content="#0E1828">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="${path === '/' ? 'website' : 'article'}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE.url}${path}">
<meta property="og:image" content="${SITE.ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="오늘의 운세 — 12별자리">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE.ogImage}">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600&display=swap">
<style>${style}</style>
${ld.map(jsonld).join('\n')}
${extraHead}
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" defer></script>
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<div class="wrap">
<header class="top">
  <a class="brand" href="/">${SITE.name}</a>
  <nav class="nav" aria-label="주 메뉴">${NAV.map(([k, href, label]) => `<a href="${href}"${k === nav ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  <p class="today tn">${TODAY_KO}</p>
</header>
</div>
<main id="main" class="wrap">
${rail && ads ? `<div class="page"><div class="page-main">${body}</div><aside class="rail" aria-label="광고">${adSlot(0)}${adSlot(1)}</aside></div>` : body}
</main>
${ads ? adfitHtml() : ''}
<footer class="tools">
  <div class="wrap foot-signs">
    <h2>12별자리</h2>
    <ul>${signs.map((s) => `<li><a href="${urlOf(s.k)}">${esc(s.n)}</a></li>`).join('')}</ul>
  </div>
  <div class="wrap tools-row">
    <h2>comeonyourboyz가 만든 다른 도구</h2>
    <ul>${TOOLS.map(([n, u]) => (u === SITE.url ? `<li class="here"><a href="/" aria-current="true">${n}</a></li>` : `<li><a href="${u}">${n}</a></li>`)).join('')}</ul>
  </div>
  <div class="wrap foot">
    <nav class="foot-links" aria-label="사이트 정보"><a href="/">홈</a><a href="/compatibility">별자리 궁합</a><a href="/zodiac-calculator">별자리 계산기</a><a href="/guide">별자리 기초</a><a href="/about">사이트 소개</a><a href="/contact">문의하기</a><a href="/privacy">개인정보처리방침</a></nav>
    <p class="ftr-note">별자리 운세는 서양 점성술의 전통적 해석을 참고해 정리한 읽을거리입니다. 의학·법률·투자 등 중요한 판단의 근거로 삼지 마세요. © ${Y} ${SITE.name}</p>
  </div>
</footer>
${extraScript}
</body>
</html>`;
}


// ---------- 실제 하늘의 별자리 (data/constellations.json + data/sun-passage-iau.json) ----------
// 필드마다 출처 키(src)가 있고 그 키가 sources 에 URL 과 함께 있어야만 출력한다. 출처 없는 값은 문장째 빠진다.
const CONST = JSON.parse(readFileSync(join(root, 'data/constellations.json'), 'utf8'));
const PASSAGE = (() => { const p = join(root, 'data/sun-passage-iau.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; })();
const constDropped = [];
const cf = (k, f) => {
  const x = CONST.signs?.[k]?.[f];
  if (x == null) return null;
  if (!Array.isArray(x.src) || !x.src.length || !x.src.every((key) => CONST.sources?.[key]?.url)) { constDropped.push(`${k}.${f}`); return null; }
  return x;
};
const passOf = (abbr) => {
  if (!PASSAGE || !CONST.sources?.passage?.url) return null;
  const list = PASSAGE.passages.filter((x) => x.abbr === abbr);
  return list.find((x) => x.startKst.startsWith(String(PASSAGE.year))) || list[0] || null;
};
const mdKo = (s) => `${Number(s.slice(-5, -3))}월 ${Number(s.slice(-2))}일`;
const latKo = (v, ns) => (v === 90 ? (ns === 'N' ? '북극' : '남극') : `${ns === 'N' ? '북위' : '남위'} ${v}°`);
function skySection(s) {
  const used = [];
  const cite = (...keys) => [...new Set(keys.flat())].map((key) => { let i = used.indexOf(key); if (i < 0) { used.push(key); i = used.length - 1; } return `<sup class="fn"><a href="#cs-${i + 1}">[${i + 1}]</a></sup>`; }).join('');
  const g = (f) => cf(s.k, f);
  const latin = g('latin'), abbr = g('abbr');
  if (!latin || !abbr) return '';
  const area = g('area'), rank = g('areaRank'), pt = g('ptolemy48'), z77 = g('sun1977');
  const star = g('brightest'), mag = g('brightestMag'), bayer = g('brightestBayer'), dist = g('brightestDistLy');
  const month = g('bestMonth9pm'), lat = g('visibleLat');
  const meaning = g('meaning'), messier = g('messier'), border = g('bordering');
  const L = esc(latin.v);
  const pa = passOf(abbr.v);
  const all = PASSAGE && CONST.sources?.passage?.url ? PASSAGE.passages.filter((x) => x.startKst.startsWith(String(PASSAGE.year))) : [];
  const longest = all.length ? all.reduce((a, b) => (b.days > a.days ? b : a)) : null;
  const shortest = all.length ? all.reduce((a, b) => (b.days < a.days ? b : a)) : null;
  const oph = all.find((x) => x.abbr === 'Oph');
  const nameOf = (ab) => { const k = Object.keys(CONST.signs).find((kk) => CONST.signs[kk].abbr?.v === ab); return k ? `${byKey.get(k).n}(${esc(CONST.signs[k].latin.v)})` : ab === 'Oph' ? '뱀주인자리(Ophiuchus)' : ab; };
  const p1 = [
    `점성술의 ${esc(s.n)}는 황도를 춘분점부터 30°씩 나눈 구간 가운데 하나지만, 밤하늘에는 같은 이름의 실제 별자리 ${L}가 있습니다. ${L}는 국제천문연맹(IAU)이 정한 88개 별자리 가운데 하나이고 공식 약어는 ${esc(abbr.v)}입니다.${cite(latin.src, abbr.src)}`,
    meaning ? ` 라틴어 이름 ${L}의 뜻은 ‘${esc(meaning.v.ko)}’(${esc(meaning.v.en)})입니다.${cite(meaning.src)}` : '',
    area && rank ? ` 하늘에서 차지하는 넓이는 ${area.v.toLocaleString('en-US')}제곱도로, 88개 별자리 가운데 ${rank.v}번째로 넓습니다.${cite(area.src)}` : '',
    pt ? ` 2세기 프톨레마이오스가 『알마게스트』에 정리한 48개 별자리에도 황도의 12개 별자리 가운데 하나로 들어 있는 오래된 별자리입니다.${cite(pt.src)}` : '',
  ].join('');
  const p2 = pa ? [
    `점성술에서 ${esc(s.n)}의 기간은 ${esc(fmtP(s.p))}이지만, IAU 별자리 경계를 기준으로 태양이 실제로 ${L} 구역을 지나는 때는 이와 다릅니다. ${PASSAGE.year}년을 기준으로 계산하면 태양은 한국 시각 ${mdKo(pa.startKst.slice(0, 10))}부터 ${mdKo(pa.endKst.slice(0, 10))}까지 약 ${Math.round(pa.days)}일 동안 ${L} 안에 있습니다.${cite('passage')}`,
    z77 ? ` 1977년 IAU 경계로 정리된 근사 날짜도 ${mdKo(z77.v.from)}~${mdKo(z77.v.to)}(${z77.v.days}일)로 비슷합니다.${cite(z77.src)}` : '',
    CONST.sources.precession?.url ? ` 이렇게 어긋나는 첫째 이유는 세차 운동입니다. 지구 자전축이 천천히 돌면서 춘분점이 별들 사이를 약 72년에 1°씩 움직이기 때문에, 춘분점을 기준으로 나눈 점성술의 구간과 실제 별자리는 오랜 세월에 걸쳐 조금씩 벌어졌습니다.${cite('precession')}` : '',
    longest && shortest ? ` 둘째 이유는 실제 별자리의 폭이 제각각이라는 점입니다. 같은 ${PASSAGE.year}년 계산에서 태양이 가장 오래 머무는 별자리는 ${nameOf(longest.abbr)}로 약 ${Math.round(longest.days)}일, 가장 짧게 머무는 별자리는 ${nameOf(shortest.abbr)}로 약 ${Math.round(shortest.days)}일입니다.${oph ? ` 또 전갈자리와 사수자리 사이에서는 황도 12궁에 들지 않는 뱀주인자리를 약 ${Math.round(oph.days)}일 동안 지납니다.` : ''}${cite('passage')}` : '',
  ].join('') : '';
  const p3 = star && mag ? [
    `${L}에서 가장 밝은 별은 ${esc(star.v)}${bayer ? `(${esc(bayer.v)})` : ''}이고 겉보기 등급은 ${mag.v.toFixed(2)}등입니다.${cite(star.src, mag.src)}`,
    dist ? ` 지구에서 약 ${dist.v}광년 떨어져 있습니다${dist.approx ? '(거리 추정의 오차가 큰 별입니다)' : ''}.${cite(dist.src, bayer ? bayer.src : [])}` : '',
  ].join('') : '';
  const p5 = border || messier != null ? [
    border ? `하늘에서 ${L}와 경계를 맞댄 별자리는 ${border.v.length}개로, ${border.v.map((x) => esc(x.replace(' (corner)', '(모서리만 맞닿음)'))).join(', ')}입니다.${cite(border.src)}` : '',
    messier ? ` 메시에 목록에 실린 천체 가운데 ${messier.v ? `${messier.v}개가 ${L} 안에 있습니다` : `${L} 안에 있는 것은 없습니다`}.${cite(messier.src)}` : '',
  ].join('') : '';
  const p4 = month || lat ? [
    month ? `${L}는 밤 9시 무렵을 기준으로 ${month.v}월에 가장 잘 보이는 별자리로 소개됩니다.${cite(month.src)}` : '',
    lat ? ` 볼 수 있는 위도는 ${latKo(lat.v.north, 'N')}에서 ${latKo(lat.v.south, 'S')}까지${CONST.sources.seoul?.url && lat.v.north >= 38 ? `여서 북위 37°33′에 있는 서울에서도 볼 수 있습니다.${cite(lat.src, 'seoul')}` : `입니다.${cite(lat.src)}`}` : '',
  ].join('') : '';
  const paras = [p1, p2, p3, p4, p5].filter(Boolean);
  return `
<section id="sky">
  <h2 class="sec-title">실제 하늘의 ${esc(s.n)}</h2>
  <div class="prose">${paras.map((x) => `<p>${x}</p>`).join('')}</div>
  <p class="prose-sm">운세에서 쓰는 ${esc(s.n)}는 날짜로 나눈 점성술의 구간이고, 이 단락은 같은 이름의 천문학적 별자리에 관한 사실 정보입니다. 수치는 아래 출처에서 ${esc(CONST.retrieved)}에 확인했습니다.</p>
  <ol class="fn-list">${used.map((key, i) => `<li id="cs-${i + 1}"><a href="${esc(CONST.sources[key].url)}" target="_blank" rel="noopener">${esc(CONST.sources[key].label)}</a></li>`).join('')}</ol>
</section>`;
}

// ---------- 태양의 길: 점성술 구간(황경 30°) × 실제 별자리(IAU 경계) ----------
// 점성술 구간은 data/sun-ingress-calc.json(Astronomy Engine 계산값), 실제 하늘은 data/sun-passage-iau.json.
// 실제 하늘 자료는 그 파일의 연도(PASSAGE.year)와 빌드 연도가 같을 때만 쓰고, 다르면 해당 부분을 통째로 뺀다.
const TK = (s) => Date.parse(`${s}:00+09:00`);
const ingYear = (y) => (ingressCalc.years[String(y)] || []).slice().sort((a, b) => (a.kst < b.kst ? -1 : 1));
const dotMD = (s) => `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`;
const mdHM = (s) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일 ${s.slice(11, 16)}`;
const SKY_YEAR = PASSAGE && CONST.sources?.passage?.url && PASSAGE.year === Y;
const skyList = SKY_YEAR ? PASSAGE.passages : [];
const skyYearList = skyList.filter((x) => x.startKst.startsWith(String(Y)));
const abbrKey = (ab) => Object.keys(CONST.signs).find((k) => CONST.signs[k].abbr?.v === ab) || null;
const skyName = (ab) => { const k = abbrKey(ab); return k ? { n: byKey.get(k).n, latin: CONST.signs[k].latin.v, k } : ab === 'Oph' ? { n: '뱀주인자리', latin: 'Ophiuchus', k: null } : { n: ab, latin: ab, k: null }; };
function sunToday() {
  const now = TK(`${TODAY}T12:00`);
  const segs = [...ingYear(Y - 1).slice(-1), ...ingYear(Y), ...ingYear(Y + 1).slice(0, 1)];
  const ai = segs.findLastIndex((r) => TK(r.kst) <= now);
  const si = skyList.findIndex((x) => TK(x.startKst) <= now && now < TK(x.endKst));
  return { now, segs, astro: segs[ai], astroNext: segs[ai + 1], sky: si >= 0 ? skyList[si] : null, skyNext: si >= 0 ? skyList[si + 1] : null };
}
// 별자리의 그해 점성술 구간과 실제 통과 기간 (별자리 페이지 머리)
function signYearBox(s) {
  const L = ingYear(Y), i = L.findIndex((r) => r.starts === s.k);
  if (i < 0) return '';
  const st = L[i], en = L[i + 1] || ingYear(Y + 1)[0];
  const ab = CONST.signs?.[s.k]?.abbr?.v;
  const pa = SKY_YEAR && ab ? skyYearList.find((x) => x.abbr === ab) : null;
  return `<dl class="yearbox tn">
    <div><dt><i class="k-sign"></i>${Y}년 점성술 구간</dt><dd>${dotMD(st.kst)} ${st.kst.slice(11)} – ${en ? `${dotMD(en.kst)} ${en.kst.slice(11)}` : ''}</dd><dd class="sub">${esc(st.term)} 황경 ${st.deg}°부터</dd></div>
    ${pa ? `<div><dt><i class="k-sky"></i>${Y}년 실제 태양 통과</dt><dd>${dotMD(pa.startKst)} ${pa.startKst.slice(11)} – ${dotMD(pa.endKst)} ${pa.endKst.slice(11)}</dd><dd class="sub">IAU 경계 ${esc(skyName(ab).latin)} · 약 ${pa.days}일 · <a href="#sky">자세히</a></dd></div>` : ''}
  </dl>`;
}
// 홈 첫 화면 원판 — 맨 위가 1월 1일, 시계 방향. 바깥 고리 점성술 구간, 안쪽 고리 IAU 별자리
function wheelSvg(sun) {
  const Y0 = TK(`${Y}-01-01T00:00`), YLEN = (TK(`${Y + 1}-01-01T00:00`) - Y0);
  const ang = (t) => ((t - Y0) / YLEN) * 360 - 90;
  const P = (r, a) => [320 + r * Math.cos((a * Math.PI) / 180), 320 + r * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(2));
  const seg = (r0, r1, a0, a1) => { const L = a1 - a0 > 180 ? 1 : 0; const [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0); return `M${x0} ${y0}A${r1} ${r1} 0 ${L} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${L} 0 ${x3} ${y3}Z`; };
  const font = 'font-family="Pretendard Variable,Pretendard,sans-serif"';
  const segs = [...ingYear(Y - 1).slice(-1), ...ingYear(Y)];
  const sk = sun.sky ? skyName(sun.sky.abbr) : null;
  const longest = skyYearList.length ? skyYearList.reduce((a, b) => (b.days > a.days ? b : a)) : null;
  const shortest = skyYearList.length ? skyYearList.reduce((a, b) => (b.days < a.days ? b : a)) : null;
  const oph = skyYearList.find((x) => x.abbr === 'Oph');
  const desc = `${M}월 ${D}일 현재 태양은 점성술 구간으로는 ${byKey.get(sun.astro.starts).n}(${mdHM(sun.astro.kst)} 시작)${sk ? `, IAU 별자리 경계로는 ${sk.n}(${mdHM(sun.sky.startKst)}~${mdHM(sun.sky.endKst)})` : ''}에 있다.${longest ? ` 실제 별자리 가운데 ${skyName(longest.abbr).n}가 ${longest.days}일로 가장 길고 ${skyName(shortest.abbr).n}가 ${shortest.days}일로 가장 짧다.` : ''}${oph ? ` ${mdHM(oph.startKst).split(' ').slice(0, 2).join(' ')}~${mdHM(oph.endKst).split(' ').slice(0, 2).join(' ')}에는 뱀주인자리를 지난다.` : ''}`;
  let o = `<svg viewBox="0 0 640 640" role="img" aria-labelledby="wt wd"><title id="wt">${Y}년 태양의 길: 점성술 구간${SKY_YEAR ? '과 실제 별자리' : ''}</title><desc id="wd">${esc(desc)}</desc>`;
  o += '<circle cx="320" cy="320" r="304" fill="none" stroke="#2A3A55"/>';
  segs.forEach((r, i) => {
    const a0 = Math.max(-90, ang(TK(r.kst))), a1 = i < segs.length - 1 ? Math.min(270, ang(TK(segs[i + 1].kst))) : 270;
    const on = r === sun.astro;
    o += `<path d="${seg(252, 300, a0, a1)}" fill="${on ? '#D9BE85' : 'rgba(217,190,133,.07)'}" stroke="#0E1828" stroke-width="2"/>`;
    if (a1 - a0 < 4 || i === segs.length - 1) return;
    const [x, y] = P(276, (a0 + a1) / 2);
    o += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" class="wl" font-size="13" fill="${on ? '#0E1828' : '#D9BE85'}" font-weight="${on ? 700 : 500}" ${font}>${esc(byKey.get(r.starts).n.replace('자리', ''))}</text>`;
  });
  skyList.forEach((x) => {
    const a0 = Math.max(-90, ang(TK(x.startKst))), a1 = Math.min(270, ang(TK(x.endKst)));
    if (a1 <= a0) return;
    const on = x === sun.sky, oph = x.abbr === 'Oph';
    o += `<path d="${seg(204, 244, a0, a1)}" fill="${on ? '#86AED6' : oph ? 'rgba(134,174,214,.02)' : 'rgba(134,174,214,.10)'}" stroke="#0E1828" stroke-width="2"${oph ? ' stroke-dasharray="3 3"' : ''}/>`;
    if (a1 - a0 < 3) return;
    const [tx, ty] = P(224, (a0 + a1) / 2), small = a1 - a0 < 9;
    o += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" class="${small ? 'ws' : 'wi'}" font-size="${small ? 11 : 13}" fill="${on ? '#0E1828' : oph ? '#A3AEC2' : '#86AED6'}" font-weight="${on ? 700 : 500}" ${font}>${esc(x.abbr)}</text>`;
  });
  o += '<line x1="320" y1="10" x2="320" y2="62" stroke="#A3AEC2" stroke-width="1"/>';
  for (let m = 0; m < 12; m++) {
    const a = ang(TK(`${Y}-${String(m + 1).padStart(2, '0')}-01T00:00`));
    const [x0, y0] = P(186, a), [x1, y1] = P(196, a), [tx, ty] = P(170, a + 4.5);
    o += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#55647E"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" class="wm" font-size="12" fill="#A3AEC2" ${font}>${m + 1}월</text>`;
  }
  o += '<circle cx="320" cy="320" r="196" fill="none" stroke="#2A3A55"/>';
  const an = ang(sun.now), [sx, sy] = P(316, an), [lx, ly] = P(150, an);
  o += `<g id="sunmark" style="transform-origin:320px 320px"><line x1="${lx}" y1="${ly}" x2="${sx}" y2="${sy}" stroke="#F4E7C0" stroke-width="1.5"/><circle cx="${sx}" cy="${sy}" r="9" fill="#F4E7C0"/><circle cx="${sx}" cy="${sy}" r="14" fill="none" stroke="#F4E7C0" stroke-opacity=".4"/></g>`;
  o += `<text x="320" y="296" text-anchor="middle" font-size="15" fill="#A3AEC2" ${font}>오늘</text>`;
  o += `<text x="320" y="334" text-anchor="middle" font-size="34" fill="#E8EBF1" font-family="Noto Serif KR,serif" font-weight="300">${M}월 ${D}일</text>`;
  o += `<text x="320" y="362" text-anchor="middle" font-size="13" fill="#A3AEC2" ${font}>맨 위 1월 1일 · 시계 방향</text></svg>`;
  return o;
}

// ---------- 별자리 페이지 ----------
function pageSign(s) {
  const p = profiles[s.k];
  const today = fortuneOf(s.k, D);
  const path = urlOf(s.k);
  const monthData = {};
  for (let d = 1; d <= daysInMonth; d++) { const f = fortuneOf(s.k, d); if (f) monthData[dayKey(d)] = f; }

  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>${esc(s.n)}</span></nav>

<article class="sign-page">
<header class="sign-hero">
  <div>
    <h1>${esc(s.n)} <span class="sign-en">${esc(s.k)}</span></h1>
    <p class="sign-meta">${esc(s.p)} · ${esc(s.el)}의 별자리 · 지배행성 ${esc(s.ruler)}</p>
    <p class="sign-trait">${esc(s.trait)} 성향</p>
  </div>
  ${signYearBox(s)}
</header>

<section class="today-box" id="todayBox">
  <h2 class="sec-title">오늘의 ${esc(s.n)} 운세 <span class="today-date tn" id="todayDate">${Y}년 ${M}월 ${D}일</span></h2>
  ${today ? `
  <div class="f-main"><span class="f-label">총운</span><p class="total" id="f-summary">${esc(today.summary)}</p></div>
  <div class="f-grid three">
    <div class="f-card"><h3 class="f-label">연애운</h3><p id="f-love">${esc(today.love)}</p></div>
    <div class="f-card"><h3 class="f-label">직장운</h3><p id="f-work">${esc(today.work)}</p></div>
    <div class="f-card"><h3 class="f-label">재물운</h3><p id="f-money">${esc(today.money)}</p></div>
  </div>` : '<p class="empty">오늘 운세를 준비 중입니다.</p>'}
  <div class="share-row">
    <button class="share-btn kakao" type="button" onclick="shareKakao()">카카오톡으로 보내기</button>
    <button class="share-btn x" type="button" onclick="shareX()">X에 공유</button>
    <button class="share-btn link" type="button" onclick="copyLink()">링크 복사</button>
  </div>
</section>

<section>
  <h2 class="sec-title">월별 ${esc(s.n)} 운세</h2>
  <a class="month-cta" href="${monthUrl(s.k, curMonth)}"><b>${M}월 운세 전체 보기</b><span>주차별 흐름과 ${curMonth.days}일치 날짜별 운세를 한 페이지에 모았습니다</span></a>
  ${months.length > 1 ? `<p class="note">${months.filter((mo) => mo !== curMonth).map((mo) => `<a href="${monthUrl(s.k, mo)}">${mo.y}년 ${mo.m}월 운세</a>`).join(' · ')}도 미리 볼 수 있습니다. 지난달 운세는 달이 바뀌면 내립니다.</p>` : ''}
</section>

<section>
  <h2 class="sec-title">${esc(s.n)}는 어떤 별자리인가요</h2>
  <div class="prose">${paras(p.intro)}</div>
</section>

<section class="two-col">
  <div class="list-box good">
    <h3>강점</h3>
    <ul>${p.strengths.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
  <div class="list-box bad">
    <h3>주의할 점</h3>
    <ul>${p.weaknesses.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
</section>

<section>
  <h2 class="sec-title">${esc(s.n)}의 연애·일·돈 스타일</h2>
  <div class="style-grid">
    <div class="style-card"><h3>연애</h3><p>${esc(p.love)}</p></div>
    <div class="style-card"><h3>일</h3><p>${esc(p.work)}</p></div>
    <div class="style-card"><h3>돈</h3><p>${esc(p.money)}</p></div>
  </div>
</section>

<section>
  <h2 class="sec-title">${esc(s.n)}와 잘 맞는 별자리</h2>
  <div class="match-grid">
    ${p.match.map((m) => { const t = byKey.get(m.key); return `<a class="match-card good" href="${pairUrl(s.k, m.key)}"><span class="m-name">${esc(m.sign)}</span><span class="m-why">${esc(m.why)}</span></a>`; }).join('')}
  </div>
  <h3 class="sub-title">부딪히기 쉬운 별자리</h3>
  <div class="match-grid">
    ${p.clash.map((m) => { const t = byKey.get(m.key); return `<a class="match-card bad" href="${pairUrl(s.k, m.key)}"><span class="m-name">${esc(m.sign)}</span><span class="m-why">${esc(m.why)}</span></a>`; }).join('')}
  </div>
  <p class="note">궁합은 성향 차이를 보는 참고일 뿐입니다. 열두 별자리와의 조합별 해설은 <a href="${signCompatUrl(s.k)}">${esc(s.n)} 궁합 12가지</a>에 모아 두었습니다.</p>
</section>

<section>
  <h2 class="sec-title">${esc(s.n)}의 유래와 상징</h2>
  <div class="prose">${paras(p.myth)}</div>
  <p class="prose-sm">탄생석 ${esc(p.symbols.stone)} · 행운의 색 ${esc(p.symbols.color)} · 행운의 숫자 ${esc(p.symbols.number)} · ${esc(p.symbols.day)}</p>
</section>
${skySection(s)}

<section>
  <h2 class="sec-title">다른 별자리 보기</h2>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip${x.k === s.k ? ' on' : ''}" href="${urlOf(x.k)}">${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;

  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: `${s.n} 운세와 성격 — ${s.p}`, description: p.intro.slice(0, 160), inLanguage: 'ko', mainEntityOfPage: SITE.url + path, image: SITE.ogImage, datePublished: '2026-08-21', dateModified: TODAY, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: `${s.n}는 몇 월 며칠생인가요?`, acceptedAnswer: { '@type': 'Answer', text: `${s.n}는 ${s.p} 사이에 태어난 사람입니다. ${s.el} 원소에 속하고 지배행성은 ${s.ruler}입니다.` } },
      { '@type': 'Question', name: `${s.n} 성격은 어떤가요?`, acceptedAnswer: { '@type': 'Answer', text: p.intro.split(/\n{2,}/)[0] } },
      { '@type': 'Question', name: `${s.n}와 잘 맞는 별자리는?`, acceptedAnswer: { '@type': 'Answer', text: p.match.map((m) => `${m.sign}: ${m.why}`).join(' ') } },
      ...(today ? [{ '@type': 'Question', name: `오늘 ${s.n} 운세는?`, acceptedAnswer: { '@type': 'Answer', text: today.summary } }] : []),
    ] },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' },
      { '@type': 'ListItem', position: 2, name: s.n, item: SITE.url + path } ] },
  ];

  // 빌드 날짜가 지났을 때만 클라이언트에서 오늘 날짜로 교체 (데이터는 인라인, 네트워크 호출 없음)
  const extraScript = `<script>window.__M__=${JSON.stringify(monthData).replace(/</g, '\\u003c')};(function(){
  var n=new Date(Date.now()+9*3600000), y=n.getUTCFullYear(), mo=n.getUTCMonth()+1, d=n.getUTCDate();
  if(mo!==${M}||y!==${Y}||d===${D})return;
  var f=window.__M__[String(d).padStart(2,'0')]; if(!f)return;
  var set=function(id,v){var el=document.getElementById(id); if(el&&v)el.textContent=v;};
  set('f-summary',f.summary); set('f-love',f.love); set('f-work',f.work); set('f-money',f.money);
  set('todayDate',y+'년 '+mo+'월 '+d+'일');
})();
var __S={title:'${s.e} ${esc(s.n)} 오늘의 운세',url:'${SITE.url}${path}',img:'${SITE.ogImage}'};
function __sum(){var el=document.getElementById('f-summary');return el?el.textContent.slice(0,80):'';}
function shareKakao(){if(!window.Kakao){alert('잠시 후 다시 시도해 주세요.');return;}try{if(!Kakao.isInitialized())Kakao.init('4dc7d7690ca8b78aec06f64ca1158905');}catch(e){}
  Kakao.Share.sendDefault({objectType:'feed',content:{title:__S.title,description:__sum(),imageUrl:__S.img,imageWidth:1200,imageHeight:630,link:{mobileWebUrl:__S.url,webUrl:__S.url}},buttons:[{title:'내 운세 보기',link:{mobileWebUrl:__S.url,webUrl:__S.url}}]});}
function shareX(){window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(__S.title+'\\n'+__sum()+'\\n'+__S.url),'_blank');}
function copyLink(){navigator.clipboard.writeText(__S.url).then(function(){alert('링크를 복사했어요!');});}</script>`;

  return layout({
    title: `${s.n} 오늘의 운세 — 성격·궁합·${s.p}`,
    desc: `${s.n}(${s.p}) 오늘의 총운·연애운·직장운·재물운. 성격과 강점·약점, 잘 맞는 별자리까지 한 페이지에 정리했습니다.`,
    path, body, ld, extraScript, nav: 'home',
  });
}

// ---------- 홈 ----------
function pageHome() {
  const sun = sunToday();
  const cur = byKey.get(sun.astro.starts), nxt = byKey.get(sun.astroNext.starts);
  const sk = sun.sky ? skyName(sun.sky.abbr) : null, skNext = sun.skyNext ? skyName(sun.skyNext.abbr) : null;
  const dayNo = sun.sky ? Math.round((TK(`${TODAY}T00:00`) - TK(`${sun.sky.startKst.slice(0, 10)}T00:00`)) / 864e5) + 1 : 0;
  const per = (s) => s.p.replace('-', '–');
  const f0 = fortuneOf(cur.k, D);
  const p0 = profiles[cur.k];
  // 경계 시각표 — 그해 시작 시각 기준. 머무는 날은 다음 구간 시작까지
  const segsY = [...ingYear(Y), ...ingYear(Y + 1).slice(0, 1)];
  const brow = signs.map((s) => {
    const i = segsY.findIndex((r) => r.starts === s.k), r = segsY[i], n = segsY[i + 1];
    const sd = n ? (TK(n.kst) - TK(r.kst)) / 864e5 : null;
    const ab = CONST.signs?.[s.k]?.abbr?.v, pa = SKY_YEAR && ab ? skyYearList.find((x) => x.abbr === ab) : null;
    return { s, r, sd, pa };
  });
  const oph = skyYearList.find((x) => x.abbr === 'Oph');
  const MAXD = Math.max(...brow.map((b) => b.sd || 0), ...skyYearList.map((x) => x.days)) * 1.05;
  const bar = (cls, d) => `<div class="${cls}"><i style="width:${((d / MAXD) * 70).toFixed(1)}%"></i>${d.toFixed(1)}일</div>`;
  // 실제 하늘 요약 — 출처가 있는 값만(cf). 출처 각주는 별자리 페이지의 "실제 하늘" 단락에 있다
  const g = (f) => cf(cur.k, f);
  const latin = g('latin');
  const facts = [];
  if (latin) {
    const star = g('brightest'), mag = g('brightestMag'), bayer = g('brightestBayer'), dist = g('brightestDistLy'), area = g('area'), rank = g('areaRank'), month = g('bestMonth9pm'), lat = g('visibleLat'), border = g('bordering');
    const ab = g('abbr')?.v, pa = SKY_YEAR && ab ? skyYearList.find((x) => x.abbr === ab) : null;
    const shortest = skyYearList.length ? skyYearList.reduce((a, b) => (b.days < a.days ? b : a)) : null;
    const longest = skyYearList.length ? skyYearList.reduce((a, b) => (b.days > a.days ? b : a)) : null;
    if (star && mag) facts.push(['가장 밝은 별', esc(star.v), `${bayer ? `${esc(bayer.v)} · ` : ''}${mag.v.toFixed(2)}등`]);
    if (dist) facts.push(['거리', `약 ${dist.v}광년`, dist.approx ? '거리 추정 오차가 큰 별' : '지구에서']);
    if (area && rank) facts.push(['넓이', `${area.v.toLocaleString('en-US')} 제곱도`, `88개 중 ${rank.v}번째`]);
    if (pa) facts.push([`${Y}년 태양이 머무는 때`, `${dotMD(pa.startKst)} – ${dotMD(pa.endKst)}`, `약 ${pa.days}일${pa === shortest ? ', 태양이 지나는 별자리 중 가장 짧음' : pa === longest ? ', 태양이 지나는 별자리 중 가장 김' : ''}`]);
    if (month) facts.push(['잘 보이는 때', `${month.v}월 밤 9시`, lat ? `${latKo(lat.v.north, 'N')}부터 ${latKo(lat.v.south, 'S').replace(/^(남위 \d+°)$/, '$1')}까지${CONST.sources.seoul?.url && lat.v.north >= 38 ? ', 서울에서도 보임' : ''}` : '']);
    if (border) facts.push(['이웃 별자리', `${border.v.length}개`, `${border.v.slice(0, 3).map((x) => esc(x.replace(' (corner)', ''))).join(', ')}${border.v.length > 3 ? ' 외' : ''}`]);
  }
  const mk = p0.match[0]?.key, mb = mk ? byKey.get(mk) : null, MP = mb ? PAIRS[pairKey(cur.k, mk)] : null;
  const body = `
<section class="hero" aria-labelledby="h-now">
  <div class="hero-txt">
    <p class="eyebrow">오늘의 별자리 운세</p>
    <h1 id="h-now">오늘 태양은<br>점성술로는 <span class="s">${esc(cur.n)}</span>${sk ? `,<br>실제 하늘에서는<br><span class="k">${esc(sk.n)}</span>에 있습니다.` : ' 구간에 있습니다.'}</h1>
    <p class="lead">별자리 운세는 태양이 지나는 길(황도)을 춘분점부터 30°씩 나눈 구간으로 정합니다.${sk ? ' 밤하늘의 실제 별자리는 폭이 제각각이고 세차 운동으로 조금씩 밀려 있어, 두 날짜가 어긋납니다.' : ''}</p>
    <div class="now${sk ? '' : ' one'}">
      <div>
        <p class="tag"><i class="k-sign"></i>점성술 구간 · 황경 ${sun.astro.deg}°</p>
        <p class="big">${esc(cur.n)}</p>
        <p class="t tn">${esc(sun.astro.term)} <b>${mdHM(sun.astro.kst)}</b> 시작<br>${esc(sun.astroNext.term)} ${mdHM(sun.astroNext.kst)}에 ${esc(nxt.n)}로</p>
      </div>
      ${sk ? `<div>
        <p class="tag"><i class="k-sky"></i>실제 하늘 · IAU 경계</p>
        <p class="big">${esc(sk.n)} <span class="lat">${esc(sk.latin)}</span></p>
        <p class="t tn">${mdHM(sun.sky.startKst)}부터 ${dayNo}일째${skNext ? `<br><b>${mdHM(sun.sky.endKst)}</b>에 ${esc(skNext.n)}(${esc(skNext.latin)})로` : ''}</p>
      </div>` : ''}
    </div>
    <nav class="picker" aria-labelledby="h-pick">
      <h2 id="h-pick">별자리를 고르세요</h2>
      <ul>${signs.map((s) => `<li><a href="${urlOf(s.k)}"${s.k === cur.k ? ' aria-current="true"' : ''}>${esc(s.n)}<span class="tn">${esc(per(s))}</span></a></li>`).join('')}</ul>
      <p class="hero-sub">12별자리의 오늘 총운·연애운·직장운·재물운과 별자리별 성격·궁합·신화를 정리했습니다. 별자리를 눌러 보세요.</p>
    </nav>
  </div>
  <figure class="wheel">
    ${wheelSvg(sun)}
    <div class="wkey" aria-hidden="true"><span><i class="k-sign"></i>바깥 고리: 점성술 12구간 (${Y}년 절기 시각)</span>${SKY_YEAR ? '<span><i class="k-sky"></i>안쪽 고리: 태양이 실제로 지나는 IAU 별자리</span>' : ''}</div>
    <figcaption>${Y}년 한 해를 원 하나로 그렸습니다. 맨 위가 1월 1일, 시계 방향으로 날짜가 흐릅니다. 바깥 고리는 태양 황경이 30°의 배수를 지나는 시각${SKY_YEAR ? ', 안쪽 고리는 IAU 별자리 경계 통과 시각이며 모두' : '이며'} ${esc(ingressCalc.method.library.split(' (')[0].replace('astronomy-engine', 'Astronomy Engine'))} 계산값(KST)입니다.</figcaption>
  </figure>
</section>

<section class="reading" aria-labelledby="h-read">
  <div>
    <div class="h"><h2 id="h-read"><a href="${urlOf(cur.k)}">${esc(cur.n)} 오늘의 운세</a></h2><span class="meta tn">${esc(per(cur))} · ${esc(cur.el)}의 별자리 · 지배행성 ${esc(cur.ruler)}</span></div>
    ${f0 ? `<p class="total">${esc(f0.summary)}</p>
    <div class="three">
      <div><h3>연애운</h3><p>${esc(f0.love)}</p></div>
      <div><h3>직장운</h3><p>${esc(f0.work)}</p></div>
      <div><h3>재물운</h3><p>${esc(f0.money)}</p></div>
    </div>` : '<p class="empty">오늘 운세를 준비 중입니다.</p>'}
    <div class="share-row">
      <button class="share-btn kakao" type="button" onclick="shareKakao()">카카오톡으로 보내기</button>
      <button class="share-btn x" type="button" onclick="shareX()">X에 공유</button>
      <button class="share-btn link" type="button" onclick="copyLink()">링크 복사</button>
      <a class="more" href="${urlOf(cur.k)}">${esc(cur.n)} 성격·궁합 보기</a>
    </div>
  </div>
  <aside class="side-ad" aria-label="광고">${adSlot(0)}</aside>
</section>

<section class="lines" aria-labelledby="h-lines">
  <div class="sec-h"><h2 id="h-lines">12별자리 오늘의 한 줄</h2><p class="tn">${TODAY_KO}</p></div>
  <ol>${signs.map((s) => { const f = fortuneOf(s.k, D); return `<li${s.k === cur.k ? ' class="on"' : ''}><a href="${urlOf(s.k)}"><b>${esc(s.n)}</b><span class="d tn">${esc(per(s))}</span></a><p>${esc(f ? f.summary : s.trait + ' 별자리')}</p></li>`; }).join('')}</ol>
</section>

<section class="bounds" aria-labelledby="h-b">
  <div>
    <div class="sec-h"><h2 id="h-b">${Y}년 별자리 경계 시각표</h2><p>생일이 경계 근처라면 태어난 해의 시각을 확인하세요. ${CALC_RANGE}년 표는 <a href="/zodiac-calculator/boundaries">경계 시각표</a>에 있습니다.</p></div>
    <table>
      <caption>점성술 구간: data/sun-ingress-calc.json, 태양의 겉보기 황경이 30° 배수가 되는 순간(${esc(ingressCalc.method.library.split(' (')[0])} SearchSunLongitude).${SKY_YEAR ? ' 실제 통과: data/sun-passage-iau.json, 태양의 J2000 적경·적위를 IAU 별자리 경계로 판정.' : ''} 시각은 KST, 분 단위 반올림.</caption>
      <thead><tr><th scope="col">별자리</th><th scope="col">점성술 구간 시작 (KST)</th>${SKY_YEAR ? '<th scope="col" class="hm">실제 태양 통과 (IAU 경계)</th>' : ''}<th scope="col">머무는 날 <span class="c-sign">점성술</span>${SKY_YEAR ? ' · <span class="c-sky">실제</span>' : ''}</th></tr></thead>
      <tbody>${brow.map(({ s, r, sd, pa }) => `<tr${s.k === cur.k ? ' class="on"' : ''}><th scope="row"><a href="${urlOf(s.k)}">${esc(s.n)}</a></th><td class="tn">${dotMD(r.kst)} ${r.kst.slice(11)}<span class="sub">${esc(r.term)} ${r.deg}°</span></td>${SKY_YEAR ? `<td class="tn hm">${pa ? `${dotMD(pa.startKst)} ${pa.startKst.slice(11)} – ${dotMD(pa.endKst)} ${pa.endKst.slice(11)}` : '—'}</td>` : ''}<td class="dur"><div class="dbar">${sd ? bar('a', sd) : ''}${pa ? bar('b', pa.days) : ''}</div></td></tr>`).join('')}${oph ? `<tr class="oph"><th scope="row">뱀주인자리 <span class="sub">Oph</span></th><td>황도 12구간에 없음</td><td class="tn hm">${dotMD(oph.startKst)} ${oph.startKst.slice(11)} – ${dotMD(oph.endKst)} ${oph.endKst.slice(11)}</td><td class="dur"><div class="dbar">${bar('b', oph.days)}</div></td></tr>` : ''}</tbody>
    </table>
  </div>
  <aside class="side-ad" aria-label="광고">${adSlot(1)}</aside>
</section>

<section class="duo">
  ${facts.length ? `<div aria-labelledby="h-sky">
    <h2 id="h-sky">실제 하늘의 ${esc(cur.n)}, ${esc(latin.v)}</h2>
    <p class="lede">운세의 ${esc(cur.n)}는 날짜로 나눈 구간이고, 아래는 같은 이름의 천문학적 별자리에 관한 사실입니다. ${esc(CONST.retrieved)} 확인, 출처는 <a href="${urlOf(cur.k)}#sky">${esc(cur.n)} 페이지</a>에 있습니다.</p>
    <dl class="facts">${facts.map(([t, v, sm]) => `<div><dt>${t}</dt><dd class="tn">${v}${sm ? `<small>${sm}</small>` : ''}</dd></div>`).join('')}</dl>
  </div>` : ''}
  ${MP ? `<div class="compat" aria-labelledby="h-c">
    <h2 id="h-c">${esc(cur.n)} × ${esc(mb.n)}</h2>
    <p class="lede">${esc(cur.n)}와 잘 맞는 별자리 · 연애할 때</p>
    <blockquote>${esc(MP.love)}</blockquote>
    <p class="tip"><b>대화 팁</b>${esc(MP.tip)}</p>
    <a class="more" href="${pairUrl(cur.k, mk)}">${esc(cur.n)} 궁합 12가지 보기</a>
  </div>` : ''}
</section>

<section class="month-sec" aria-labelledby="h-month">
  <div>
    <h2 id="h-month" class="sec-title">이번 달 운세 <span class="today-date">${Y}년 ${M}월</span></h2>
    <p class="sec-lead">별자리마다 ${M}월 한 달의 주차별 흐름과 날짜별 운세를 모아 두었습니다.</p>
    <div class="sign-links">${signs.map((s) => `<a class="sign-chip" href="${monthUrl(s.k, curMonth)}">${esc(s.n)} ${M}월</a>`).join('')}</div>
  </div>
  <div class="info-box">
    <h2 class="sec-title">별자리 운세, 이렇게 보세요</h2>
    <p>별자리는 <b>태어난 날 태양이 지나던 구간</b>으로 정해집니다. 생일이 두 별자리 경계에 걸쳐 있다면 양쪽을 다 읽어 보세요.</p>
    <p>별자리 페이지에는 오늘의 운세와 함께 성격의 강점·약점, 잘 맞는 별자리를 정리해 두었습니다. 내 별자리가 헷갈리면 <a href="/zodiac-calculator">별자리 계산기</a>를, 원소나 지배 행성 같은 말이 궁금하면 <a href="/guide">별자리 기초</a>를 보세요.</p>
  </div>
</section>

<p class="note-end">점성술은 검증된 예측 도구가 아닙니다. 하루를 돌아보는 계기 정도로 가볍게 보시고, 중요한 결정은 스스로 내리시기 바랍니다.</p>
`;

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, alternateName: ['오늘의운세', '별자리 운세'], url: `${SITE.url}/`, description: SITE.desc, inLanguage: 'ko' },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: '12별자리', itemListElement: signs.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.n, url: SITE.url + urlOf(s.k) })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: '별자리는 어떻게 정해지나요?', acceptedAnswer: { '@type': 'Answer', text: '태어난 날짜에 태양이 지나던 황도 12궁 구간으로 정해집니다. 흔히 말하는 별자리는 이 태양 별자리를 가리키며, 생일이 경계에 걸치면 출생 시각에 따라 달라질 수 있습니다.' } },
      { '@type': 'Question', name: '별자리 운세는 매일 바뀌나요?', acceptedAnswer: { '@type': 'Answer', text: '네, 12별자리 모두 날짜별로 총운·연애운·직장운·재물운이 준비되어 있습니다.' } },
      { '@type': 'Question', name: '별자리 궁합은 얼마나 믿을 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '점성술의 궁합은 성향 차이를 설명하는 전통적 해석입니다. 과학적 근거가 있는 예측이 아니므로 관계를 이해하는 참고 자료로만 활용하시기 바랍니다.' } },
    ] },
  ];
  const extraScript = `<script>
var __S={title:'${SITE.name} — 오늘의 12별자리 운세',url:'${SITE.url}/',img:'${SITE.ogImage}',desc:'오늘의 총운·연애운·직장운·재물운을 별자리별로 확인해 보세요.'};
function shareKakao(){if(!window.Kakao){alert('잠시 후 다시 시도해 주세요.');return;}try{if(!Kakao.isInitialized())Kakao.init('4dc7d7690ca8b78aec06f64ca1158905');}catch(e){}
  Kakao.Share.sendDefault({objectType:'feed',content:{title:__S.title,description:__S.desc,imageUrl:__S.img,imageWidth:1200,imageHeight:630,link:{mobileWebUrl:__S.url,webUrl:__S.url}},buttons:[{title:'내 운세 보기',link:{mobileWebUrl:__S.url,webUrl:__S.url}}]});}
function shareX(){window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(__S.title+'\\n'+__S.url),'_blank');}
function copyLink(){navigator.clipboard.writeText(__S.url).then(function(){alert('링크를 복사했어요!');});}
</script>`;
  return layout({ title: `${SITE.name} — 12별자리 오늘의 운세와 별자리별 성격·궁합`, desc: SITE.desc, path: '/', body, ld, extraScript, nav: 'home', rail: false });
}

// ---------- 궁합 ----------
// 서양 점성술의 전통적 판정 두 축: 원소(element)와 황도상 각도(aspect).
const ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const idxOf = (k) => ORDER.indexOf(k);
const ASPECT = {
  0: { name: '합', score: 82, text: '같은 별자리끼리는 서로를 설명하지 않아도 이해합니다. 편안한 대신 단점까지 똑같아 서로의 약점을 보완해 주기는 어렵습니다.' },
  1: { name: '반섹스타일', score: 62, text: '바로 옆자리라 관심사가 미묘하게 어긋납니다. 공통점을 찾기까지 시간이 걸리지만 서로에게 없는 감각을 배울 수 있습니다.' },
  2: { name: '섹스타일', score: 86, text: '서로를 자극하되 부담을 주지 않는 거리입니다. 친구로 시작해 자연스럽게 가까워지는 조합입니다.' },
  3: { name: '스퀘어', score: 64, text: '방식이 정면으로 부딪히는 각도입니다. 긴장이 큰 만큼 서로를 성장시키기도 해서, 오래가면 단단해집니다.' },
  4: { name: '트라인', score: 92, text: '같은 원소끼리 이루는 가장 편안한 각도입니다. 말이 잘 통하고 갈등이 적어 전통적으로 최고의 조합으로 봅니다.' },
  5: { name: '퀸컹스', score: 58, text: '공통분모가 가장 적은 각도입니다. 서로를 이해하려면 의식적인 노력이 필요하고, 그 노력이 관계의 질을 정합니다.' },
  6: { name: '어포지션', score: 78, text: '정반대에 놓인 짝입니다. 처음엔 강하게 끌리고 나중엔 그 차이가 그대로 갈등이 됩니다. 균형을 찾으면 서로의 빈칸을 정확히 채웁니다.' },
};
const ELEM_PAIR = (a, b) => {
  const key = [a, b].sort().join('-');
  return { '공기-공기': 8, '땅-땅': 8, '물-물': 8, '불-불': 8, '공기-불': 8, '땅-물': 8, '공기-물': -6, '땅-불': -6, '공기-땅': -4, '물-불': -8 }[key] ?? 0;
};
const pairScore = (a, b) => {
  const d = Math.abs(idxOf(a.k) - idxOf(b.k));
  const asp = ASPECT[Math.min(d, 12 - d)];
  return { asp, score: Math.max(45, Math.min(97, asp.score + ELEM_PAIR(a.el, b.el))) };
};
function pageCompat() {
  const matrix = signs.map((a) => signs.map((b) => { const { asp, score } = pairScore(a, b); return [score, asp.name, asp.text]; }));
  const rows = signs.map((a, i) => `<tr><th scope="row"><a href="${signCompatUrl(a.k)}">${esc(a.n)}</a></th>${signs.map((b, j) => { const score = matrix[i][j][0]; const cls = score >= 88 ? 'c-best' : score >= 78 ? 'c-good' : score >= 65 ? 'c-mid' : 'c-low'; return `<td class="${cls}" title="${esc(a.n)} × ${esc(b.n)}">${score}</td>`; }).join('')}</tr>`).join('');
  const pickGrid = (id) => `<div class="pick-grid" id="${id}">${signs.map((x, i) => `<button class="pick-btn" type="button" data-i="${i}"><span class="n">${esc(x.n)}</span><span class="pp">${esc(x.p.replace('-', '–'))}</span></button>`).join('')}</div>`;
  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>별자리 궁합</span></nav>
<article class="sign-page">
<header class="home-hero" style="padding-top:20px"><h1>별자리 궁합</h1><p class="hero-sub">내 별자리와 상대 별자리를 고르면 궁합 점수와 해설을 바로 보여 드립니다.</p></header>
<section>
  <div class="pick-label">내 별자리</div>${pickGrid('myGrid')}
  <div class="pick-label">상대 별자리</div>${pickGrid('yourGrid')}
  <button class="result-btn" id="goBtn" type="button" disabled>궁합 보기</button>
  <div class="result-card" id="rc">
    <div class="rc-pair" id="rcPair"></div>
    <div class="rc-score" id="rcScore"></div>
    <div class="rc-asp" id="rcAsp"></div>
    <p class="rc-text" id="rcText"></p>
    <div class="rc-links" id="rcLinks"></div>
    <div class="share-row">
      <button class="share-btn kakao" type="button" onclick="shareKakao()">💬 카카오톡</button>
      <button class="share-btn x" type="button" onclick="shareX()">𝕏 공유</button>
      <button class="share-btn link" type="button" onclick="copyLink()">🔗 링크 복사</button>
    </div>
  </div>
</section>
<section>
  <h2 class="sec-title">12 × 12 궁합표</h2>
  <div class="month-wrap" style="overflow-x:auto;border-radius:0"><table class="compat-table"><thead><tr><th></th>${signs.map((s) => `<th scope="col" title="${esc(s.n)}">${esc(s.n.replace('자리', ''))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">세로줄이 나, 가로줄이 상대입니다. 왼쪽 별자리 이름을 누르면 그 별자리의 궁합 12가지 해설로 이동합니다. 점수는 두 별자리의 원소 관계와 황도상 각도를 합쳐 계산했습니다.</p>
</section>
<section>
  <h2 class="sec-title">궁합은 무엇으로 정해지나요</h2>
  <div class="prose">
    <p>점성술에서 두 별자리의 궁합은 두 가지로 봅니다. 하나는 <b>원소</b>입니다. 불·땅·공기·물 네 원소 중 같은 원소끼리는 세상을 보는 방식이 비슷해 말이 잘 통하고, 불과 공기, 땅과 물은 서로를 북돋우는 짝으로 봅니다. 다른 하나는 <b>각도</b>입니다. 황도 12궁을 원으로 놓았을 때 몇 칸 떨어져 있는지에 따라 트라인(4칸, 가장 편안), 스퀘어(3칸, 긴장), 어포지션(정반대, 끌림과 충돌)으로 나눕니다.</p>
    <p>점수가 낮다고 맞지 않는 관계라는 뜻은 아닙니다. 긴장이 큰 조합이 서로를 가장 많이 성장시킨다고도 봅니다. 재미로 보시고 관계를 이해하는 참고 자료로만 쓰시기 바랍니다.</p>
    <p>원소와 모달리티, 지배 행성이 무엇인지는 <a href="/guide">별자리 기초</a>에 출처와 함께 정리해 두었습니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">별자리별 궁합 해설</h2>
  <p class="sec-lead">별자리마다 열두 별자리와의 조합을 한 페이지에 모았습니다. 조합마다 원소·모달리티·지배 행성 관계와 연애·친구일 때, 다툰 뒤 회복하는 법, 대화 요령을 정리했습니다.</p>
  <div class="sign-links">${ORDER.map((k) => { const x = byKey.get(k); return `<a class="sign-chip" href="${signCompatUrl(k)}">${esc(x.n)} 궁합</a>`; }).join('')}</div>
</section>
</article>`;
  const extraScript = `<script>
var __Z=${JSON.stringify(signs.map((x) => ({ e: x.e, n: x.n, k: x.k })))}, __M=${JSON.stringify(matrix)};
var my=-1, you=-1, __S={title:'별자리 궁합',url:'${SITE.url}/compatibility',img:'${SITE.ogImage}',desc:'내 별자리와 상대 별자리 궁합을 바로 확인해 보세요.'};
function pick(grid,i){ if(grid==='myGrid')my=i; else you=i; document.querySelectorAll('#'+grid+' .pick-btn').forEach(function(b,j){b.classList.toggle('active',j===i);}); document.getElementById('goBtn').disabled=!(my>=0&&you>=0); }
['myGrid','yourGrid'].forEach(function(g){ document.querySelectorAll('#'+g+' .pick-btn').forEach(function(b){ b.addEventListener('click',function(){pick(g,Number(b.dataset.i));}); }); });
function show(){ if(my<0||you<0)return; var a=__Z[my],b=__Z[you],m=__M[my][you];
  document.getElementById('rcPair').innerHTML=a.n+' <span class="x">×</span> '+b.n;
  document.getElementById('rcScore').innerHTML=m[0]+'<small>점</small>';
  document.getElementById('rcAsp').textContent=m[1]+' · '+(m[0]>=88?'최상의 조합':m[0]>=78?'잘 맞는 조합':m[0]>=65?'노력하면 좋아지는 조합':'서로를 배우는 조합');
  document.getElementById('rcText').textContent=m[2];
  document.getElementById('rcLinks').innerHTML='<a href="/compatibility/'+a.k+'#'+b.k+'">궁합 상세 해설</a><a href="/zodiac/'+a.k+'">'+a.n+' 자세히</a><a href="/zodiac/'+b.k+'">'+b.n+' 자세히</a>';
  __S.title=a.e+' '+a.n+' × '+b.e+' '+b.n+' 궁합 '+m[0]+'점'; __S.desc=m[2].slice(0,80); __S.url='${SITE.url}/compatibility?a='+a.k+'&b='+b.k;
  var rc=document.getElementById('rc'); rc.classList.add('on'); rc.scrollIntoView({behavior:'smooth',block:'start'});
  try{history.replaceState(null,'','?a='+a.k+'&b='+b.k);}catch(e){} }
document.getElementById('goBtn').addEventListener('click',show);
try{ var q=new URLSearchParams(location.search); var ai=__Z.findIndex(function(z){return z.k===q.get('a');}), bi=__Z.findIndex(function(z){return z.k===q.get('b');}); if(ai>=0&&bi>=0){pick('myGrid',ai);pick('yourGrid',bi);show();} }catch(e){}
function shareKakao(){if(!window.Kakao){alert('잠시 후 다시 시도해 주세요.');return;}try{if(!Kakao.isInitialized())Kakao.init('4dc7d7690ca8b78aec06f64ca1158905');}catch(e){}
  Kakao.Share.sendDefault({objectType:'feed',content:{title:__S.title,description:__S.desc,imageUrl:__S.img,imageWidth:1200,imageHeight:630,link:{mobileWebUrl:__S.url,webUrl:__S.url}},buttons:[{title:'우리 궁합 보기',link:{mobileWebUrl:__S.url,webUrl:__S.url}}]});}
function shareX(){window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(__S.title+'\\n'+__S.url),'_blank');}
function copyLink(){navigator.clipboard.writeText(__S.url).then(function(){alert('링크를 복사했어요!');});}
</script>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: '별자리 궁합', url: SITE.url + '/compatibility', applicationCategory: 'LifestyleApplication', operatingSystem: 'Web Browser', inLanguage: 'ko', description: '내 별자리와 상대 별자리를 골라 궁합 점수와 해설을 확인하는 도구', offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: '별자리 궁합', item: SITE.url + '/compatibility' }] },
  ];
  return layout({ title: `별자리 궁합 — 내 별자리 × 상대 별자리 점수 바로 보기`, desc: '내 별자리와 상대 별자리를 고르면 원소와 각도로 계산한 궁합 점수와 해설을 바로 보여 드립니다. 12별자리 78개 조합.', path: '/compatibility', body, ld, extraScript, nav: 'compat' });
}

// ---------- 소개 ----------
function pageContact() {
  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>문의하기</span></nav>
<article class="sign-page">
<header class="home-hero" style="padding-top:20px"><h1>문의하기</h1>
  <p class="hero-sub">${SITE.name}는 개인이 혼자 만들고 운영하는 사이트입니다. 답변이 며칠 걸릴 수 있습니다.</p></header>

<section>
  <h2 class="sec-title">이메일</h2>
  <div class="info-box">
    <p style="font-size:18px;font-weight:800;margin:0 0 8px"><a href="mailto:comeonyourboyz@gmail.com">comeonyourboyz@gmail.com</a></p>
    <p class="muted" style="margin:0">운세 내용이 이상하거나, 오탈자를 찾으셨거나, 화면이 깨질 때 편하게 보내주세요.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">이런 연락이 특히 도움이 됩니다</h2>
  <div class="prose">
    <p><b>오탈자·문장 오류</b> — 어느 별자리의 며칠 자 운세인지 알려주시면 바로 고칠 수 있습니다. 운세는 날짜별로 따로 작성해 두기 때문에 특정 날짜만 이상한 경우가 있습니다.</p>
    <p><b>날짜·요일이 안 맞을 때</b> — 본문의 요일이 실제 달력과 다르면 알려주세요. 작성 시점의 착오로 어긋나 있을 수 있습니다.</p>
    <p><b>별자리 정보 오류</b> — 성격 설명이나 신화 유래, 탄생석 같은 상징이 일반적으로 알려진 것과 다르면 알려주세요.</p>
    <p><b>화면 문제</b> — 레이아웃이 깨지거나 공유 버튼이 동작하지 않으면 쓰시는 기기와 브라우저를 함께 알려주시면 빠르게 확인할 수 있습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">답변이 어려운 것</h2>
  <div class="prose">
    <p>개인 운세 상담이나 사주·궁합 풀이는 해 드리지 않습니다. 이 사이트의 운세는 서양 점성술의 전통적 해석을 참고해 미리 작성해 둔 읽을거리이고, 운영자는 점성술 전문가가 아닙니다.</p>
    <p>건강·투자·진로처럼 중요한 결정의 근거로 삼지 마시고, 하루를 시작하며 가볍게 읽는 정도로 봐 주세요.</p>
    <p>광고·제휴 제안은 확인은 하지만 대부분 답장을 드리지 못합니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">운영자 정보</h2>
  <div class="prose">
    <p>서울에서 일하는 소프트웨어 개발자가 업무 외 시간에 만들고 있습니다. 사업자 등록을 한 상업 사이트가 아니며, 운영 비용은 광고 수익으로 충당합니다.</p>
    <p>운세와 별자리 설명을 어떻게 만들었는지는 <a href="/about">사이트 소개</a>에, 수집하는 정보는 <a href="/privacy">개인정보처리방침</a>에 정리해 두었습니다.</p>
  </div>
</section>
</article>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'ContactPage', name: '문의하기', url: SITE.url + '/contact', inLanguage: 'ko', description: `${SITE.name} 운영자에게 오류 제보나 문의를 보내는 방법` },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: '문의하기', item: SITE.url + '/contact' }] }];
  return layout({ title: `문의하기`, desc: `${SITE.name} 운영자에게 오류 제보나 문의를 보내는 방법입니다. 운세 오탈자나 화면 문제를 알려주시면 확인 후 고치겠습니다.`, path: '/contact', body, ld });
}

// ---------- 공통 도우미 (새 페이지) ----------
function pairKey(a, b) { return idxOf(a) <= idxOf(b) ? `${a}-${b}` : `${b}-${a}`; }
// 궁합 상세는 별자리별 12페이지(/compatibility/<a>)에 상대 별자리 섹션(id=<b>)으로 모았다
function signCompatUrl(a) { return `/compatibility/${a}`; }
function pairUrl(a, b) { return `/compatibility/${a}#${b}`; }
const crumbLd = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE.url + path })) });
const crumbHtml = (items) => `<nav class="crumb">${items.map(([name, path], i) => (i === items.length - 1 ? `<span>${esc(name)}</span>` : `<a href="${path}">${esc(name)}</a>`)).join(' › ')}</nav>`;
const fmtP = (p) => { const [s, e] = p.split('-').map((x) => x.split('.').map(Number)); return `${s[0]}월 ${s[1]}일 ~ ${e[0]}월 ${e[1]}일`; };
const verdict = (sc) => (sc >= 88 ? '최상의 조합' : sc >= 78 ? '잘 맞는 조합' : sc >= 65 ? '노력하면 좋아지는 조합' : '서로를 배우는 조합');
const srcLinks = (keys) => keys.map((k) => `<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].label)}</a>`).join(' · ');
const PAIRS = JSON.parse(readFileSync(join(root, 'data/compat-pairs.json'), 'utf8'));
const ingressHko = (() => { const p = join(root, 'data/sun-ingress-hko.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { years: {} }; })();
const ingress = (() => { const p = join(root, 'data/sun-ingress-kasi.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { years: {} }; })();

// ---------- 궁합 상세 (별자리별 12페이지) ----------
// 예전에는 조합마다 한 페이지(78장)였다. 지금은 별자리 a 의 페이지에 상대 b 12개를 섹션(id=b)으로 모으고,
// 예전 주소 /compatibility/<a>-<b> 와 /compatibility/<b>-<a> 는 vercel.json 에서 /compatibility/<a>#<b> 로 301 한다.
function pairInfo(a, b) {
  const same = a.k === b.k;
  const { asp, score } = pairScore(a, b);
  const d0 = Math.abs(idxOf(a.k) - idxOf(b.k)), dist = Math.min(d0, 12 - d0);
  const bonus = ELEM_PAIR(a.el, b.el);
  const P = PAIRS[pairKey(a.k, b.k)];
  if (!P || !['love', 'friend', 'repair', 'tip'].every((x) => P[x])) { console.error(`✖ data/compat-pairs.json 에 ${pairKey(a.k, b.k)} 의 love·friend·repair·tip 이 없습니다`); process.exit(1); }
  const shared = QUAL[a.el].filter((q) => QUAL[b.el].includes(q));
  const combo = [
    a.el === b.el ? `같은 ${a.el}` : `${a.el} × ${b.el}${shared.length ? ` (공유 성질: ${shared.join(', ')})` : ' (공유 성질 없음)'}`,
    MOD_OF[a.k] === MOD_OF[b.k] ? `같은 ${MOD_OF[a.k]}궁` : `${MOD_OF[a.k]}궁 × ${MOD_OF[b.k]}궁`,
    a.ruler === b.ruler ? `같은 ${a.ruler}` : `${a.ruler} × ${b.ruler}`,
  ];
  return { same, asp, score, dist, bonus, P, combo };
}

function pageSignCompat(a) {
  const path = signCompatUrl(a.k);
  const list = ORDER.map((k) => ({ b: byKey.get(k), ...pairInfo(a, byKey.get(k)) }));
  const ranked = [...list].sort((p, q) => q.score - p.score || idxOf(p.b.k) - idxOf(q.b.k));
  const info = (s) => `${esc(fmtP(s.p))} · ${esc(s.el)} · ${esc(MOD_NAME[MOD_OF[s.k]])} · 지배 행성 ${esc(s.ruler)}${CLASSIC_RULER[s.k] ? ` (전통: ${esc(CLASSIC_RULER[s.k])})` : ''}`;
  const sec = ({ b, same, asp, score, dist, bonus, P, combo }) => `
<section class="pair-sec" id="${b.k}">
  <h2 class="sec-title">${esc(a.n)} × ${esc(b.n)} <span class="today-date">${score}점 · ${esc(asp.name)} · ${esc(verdict(score))}</span></h2>
  <p class="pair-meta">${same ? `같은 별자리끼리의 조합입니다. ${esc(a.n)}: ${info(a)}` : `상대 ${esc(b.n)}: ${info(b)}`}<br>조합: ${esc(combo.join(' · '))}</p>
  <p class="note">점수: ${same ? '같은 별자리(0°)' : `황도에서 ${dist * 30}° 떨어진`} ${esc(asp.name)}의 기본 점수 ${asp.score}점에 원소 보정 ${bonus > 0 ? '+' : ''}${bonus}점을 더하면 ${asp.score + bonus}점${asp.score + bonus > score ? `이고, 점수는 최대 ${score}점으로 표시합니다` : asp.score + bonus < score ? `이고, 점수는 최소 ${score}점으로 표시합니다` : '입니다'}.</p>
  <h3 class="sub-title">연애할 때</h3>
  <div class="prose"><p>${esc(P.love)}</p></div>
  <h3 class="sub-title">친구·동료일 때</h3>
  <div class="prose"><p>${esc(P.friend)}</p></div>
  <h3 class="sub-title">다툰 뒤 회복하는 법</h3>
  <div class="prose"><p>${esc(P.repair)}</p></div>
  <h3 class="sub-title">대화 팁</h3>
  <div class="tip-box"><p>${esc(P.tip)}</p></div>
</section>`;
  const body = `
${crumbHtml([['홈', '/'], ['별자리 궁합', '/compatibility'], [`${a.n} 궁합`, path]])}
<article class="sign-page">
<header class="pair-hero">
  <p class="ph-signs"><a href="${urlOf(a.k)}">${esc(a.n)} 오늘의 운세</a></p>
  <h1>${esc(a.n)} 궁합 12가지</h1>
  <p class="ph-asp">${info(a)}</p>
</header>

<section>
  <h2 class="sec-title">점수 순으로 보기</h2>
  <p class="sec-lead">${esc(a.n)}와 열두 별자리의 궁합 점수입니다. 별자리를 누르면 아래 해당 조합 해설로 이동합니다. 점수는 두 별자리의 황도상 각도(합·섹스타일·스퀘어·트라인·어포지션 등)의 기본 점수에 원소 조합 보정을 더해 계산했고, 계산 방식은 <a href="/compatibility">궁합표</a>와 같습니다.</p>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>상대</th><th>점수</th><th>각도</th><th>원소 조합</th></tr></thead>
  <tbody>${ranked.map(({ b, score, asp, combo }) => `<tr><th scope="row"><a href="#${b.k}">${esc(b.n)}</a></th><td>${score}</td><td>${esc(asp.name)}</td><td>${esc(combo[0])}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
${list.map(sec).join('\n')}

<section>
  <h2 class="sec-title">다른 별자리의 궁합</h2>
  <div class="sign-links">${ORDER.filter((k) => k !== a.k).map((k) => { const x = byKey.get(k); return `<a class="sign-chip" href="${signCompatUrl(k)}">${esc(x.n)}</a>`; }).join('')}</div>
  <p class="note">${esc(a.n)}의 성격과 오늘의 운세는 <a href="${urlOf(a.k)}">${esc(a.n)} 페이지</a>에 있습니다.</p>
</section>
<p class="note">궁합은 재미로 읽는 점성술 해석입니다. 분류 출처: ${srcLinks(['sign', 'element', 'domicile', 'aspect'])}</p>
</article>`;

  const title = `${a.n} 궁합 12가지 — 별자리별 점수와 연애·친구·다툰 뒤`;
  const desc = `${a.n}(${fmtP(a.p)})와 열두 별자리의 궁합. 가장 높은 조합은 ${ranked[0].b.n} ${ranked[0].score}점(${ranked[0].asp.name})입니다. 조합마다 연애·친구일 때, 다툰 뒤 회복하는 법, 대화 팁을 정리했습니다.`.slice(0, 160);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, inLanguage: 'ko', mainEntityOfPage: SITE.url + path, image: SITE.ogImage, dateModified: CONTENT_UPDATED, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    crumbLd([['홈', '/'], ['별자리 궁합', '/compatibility'], [`${a.n} 궁합`, path]]),
  ];
  return layout({ title, desc, path, body, ld, nav: 'compat' });
}

// ---------- 월별 운세 ----------
// 주차별 요약은 새 문장을 짓지 않는다. 그 주의 문장들 가운데 다른 날들과 단어를 가장 많이 공유하는 문장(대표 문장)을 골라 인용한다.
const STOP = new Set(['오늘', '하루', '당신', '보세', '있습', '합니', '입니', '됩니', '하세', '해보', '하는', '하면', '하게', '그리', '이번', '날입', '니다', '세요', '습니', '에서', '으로', '지만', '처럼', '보다', '자리', '좋습', '좋은', '수있', '것이', '것을', '것도', '한번', '조금', '먼저']);
const stems = (t, extra) => new Set((String(t).match(/[가-힣A-Za-z0-9]{2,}/g) || []).map((w) => w.slice(0, 2)).filter((w) => !STOP.has(w) && w !== extra));
// 특정 날짜에 묶인 문장(요일·오늘·내일·다음 주·첫날·마지막·절기·기념일 등)은 다른 날짜 묶음에 옮겨 놓으면 뜻이 틀어지므로 대표 문장 후보에서 뺀다
const DATE_BOUND = /요일|오늘|내일|모레|어제|이번 주|다음 주|지난주|이번 달|다음 달|주말|주중|주 중반|평일|첫날|첫 주|마지막|월말|월초|새달|새 달|연휴|휴일|공휴일|입동|소설|수능|수험|빼빼로|추석|한글날|개천절|절기|\d+일|\d+월|아침부터/;
function pickRep(items, used, extra) {
  // 날짜에 묶인 문장은 첫 문장(대개 요일·행사 소개)을 뺀 나머지가 일반 조언이면 그 부분만 후보로 쓴다
  items = items.map((it) => {
    if (!DATE_BOUND.test(it.text)) return it;
    const rest = String(it.text).split(/(?<=[.!?])\s+/).slice(1).join(' ');
    return rest && !DATE_BOUND.test(rest) ? { ...it, text: rest } : null;
  }).filter(Boolean);
  if (!items.length) return null;
  const S = items.map((it) => stems(it.text, extra));
  const score = S.map((Si, i) => S.reduce((acc, Sj, j) => { if (i === j) return acc; let inter = 0; for (const x of Si) if (Sj.has(x)) inter++; const uni = Si.size + Sj.size - inter; return acc + (uni ? inter / uni : 0); }, 0) * (used.has(items[i].d) ? 0.8 : 1));
  let best = 0;
  score.forEach((v, i) => { if (v > score[best]) best = i; });
  return items[best];
}

function pageMonth(s, mo, idx) {
  const dd = (d) => String(d).padStart(2, '0');
  const path = monthUrl(s.k, mo);
  const rows = [];
  for (let d = 1; d <= mo.days; d++) { const f = mo.data[s.k]?.[dd(d)]; if (f) rows.push({ d, f }); }
  const stem = s.n.slice(0, 2);
  const overview = mo.overview[s.k];
  const evOf = (d) => mo.events.filter((e) => Number(e.date.slice(8, 10)) === d);
  const weeks = [[1, 7, '첫째 주'], [8, 14, '둘째 주'], [15, 21, '셋째 주'], [22, mo.days, '넷째 주와 월말']];
  const cats = [['summary', '총운'], ['love', '연애'], ['work', '일'], ['money', '돈']];
  const weekHtml = weeks.map(([from, to, label]) => {
    const it = rows.filter((r) => r.d >= from && r.d <= to);
    if (!it.length) return '';
    const used = new Set();
    const lis = cats.map(([c, lab]) => { const r = pickRep(it.map((x) => ({ d: x.d, text: x.f[c] })), used, stem); if (!r) return `<li><span class="wk-cat">${lab}</span><span class="wk-txt wk-none">이 주의 ${lab} 문장은 모두 특정 날짜에 묶여 있어 아래 날짜별 운세에서 확인해 주세요.</span></li>`; used.add(r.d); return `<li><span class="wk-cat">${lab}</span><span class="wk-txt">${esc(r.text)} <a class="wk-d" href="#d${dd(r.d)}">${mo.m}월 ${r.d}일</a></span></li>`; }).join('');
    const ev = mo.events.filter((e) => { const d = Number(e.date.slice(8, 10)); return d >= from && d <= to; });
    return `<div class="wk"><h3>${label} <small>${mo.m}월 ${from}일(${mo.wd(from)}) ~ ${to}일(${mo.wd(to)})</small></h3><ul class="wk-list">${lis}</ul>${ev.length ? `<p class="wk-ev">이 주의 일정: ${ev.map((e) => `${Number(e.date.slice(8, 10))}일(${mo.wd(Number(e.date.slice(8, 10)))}) ${esc(e.name)}`).join(', ')}</p>` : ''}</div>`;
  }).join('');
  const prev = months[idx - 1], next = months[idx + 1];
  const body = `
${crumbHtml([['홈', '/'], [s.n, urlOf(s.k)], [`${mo.y}년 ${mo.m}월`, path]])}
<article class="sign-page">
<header class="sign-hero">
  <div>
    <h1>${esc(s.n)} ${mo.m}월 운세 <span class="sign-en">${mo.y}</span></h1>
    <p class="sign-meta">${esc(fmtP(s.p))} · ${esc(s.el)}의 별자리 · 지배행성 ${esc(s.ruler)}</p>
    <p class="sign-trait">${mo.y}년 ${mo.m}월 · 날짜별 운세 ${rows.length}일치</p>
  </div>
</header>

<section>
  <div class="prose"><p>${mo.y}년 ${mo.m}월 ${esc(s.n)} 운세를 한 페이지에 모았습니다. 운세는 재미로 읽는 글입니다.</p></div>
  ${overview ? `<div class="month-quote"><h2 class="ov-title">${mo.m}월 흐름 요약</h2><p>${esc(overview)}</p><p class="ov-note">이달 날짜별 운세 문장에 자주 나온 내용을 묶어 정리한 요약입니다. 날짜별 운세에 없는 새 예측은 넣지 않았습니다.</p></div>` : ''}
  ${mo.check.wdBad ? '<p class="note">이달 운세의 일부 문장에 적힌 요일은 실제 달력과 다를 수 있습니다. 날짜 옆의 요일이 실제 요일입니다.</p>' : ''}
</section>

<section>
  <h2 class="sec-title">주차별 대표 문장</h2>
  <p class="sec-lead">그 주의 총운·연애·일·돈 문장 가운데 다른 날들과 내용이 가장 많이 겹치는 문장을 하나씩 그대로 옮겼습니다. 특정 날짜·요일에 묶인 문장은 고르지 않았고, 총운은 요일·행사를 소개하는 첫 문장을 뺀 나머지 문장을 옮긴 경우가 있습니다. 날짜를 누르면 그날 운세로 이동합니다.</p>
  ${weekHtml}
</section>
${mo.events.length ? `
<section>
  <h2 class="sec-title">${mo.m}월 일정</h2>
  <p class="sec-lead">이달 운세를 쓸 때 반영한 일정입니다. 날짜와 내용은 아래 출처에서 확인했습니다.</p>
  <ul class="ev-list">${mo.events.map((e) => { const d = Number(e.date.slice(8, 10)); return `<li><b>${mo.m}월 ${d}일(${mo.wd(d)}) ${esc(e.name)}</b><p>${esc(e.desc)}</p><p class="ev-src">출처: ${(e.sources || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join(' · ')}</p></li>`; }).join('')}</ul>
</section>` : ''}

<section>
  <h2 class="sec-title">날짜별 운세</h2>
  <ol class="day-list">${rows.map((r) => `<li id="d${dd(r.d)}"><div class="dl-date"><b>${r.d}</b><small>${mo.wd(r.d)}</small></div><div class="dl-body">${evOf(r.d).map((e) => `<span class="dl-ev">${esc(e.name)}</span>`).join('')}<p class="dl-sum">${esc(r.f.summary)}</p><p class="dl-sub"><b>연애</b> ${esc(r.f.love)}</p><p class="dl-sub"><b>일</b> ${esc(r.f.work)}</p><p class="dl-sub"><b>돈</b> ${esc(r.f.money)}</p></div></li>`).join('')}</ol>
</section>

<section>
  <h2 class="sec-title">다른 달, 다른 별자리</h2>
  <div class="month-nav">${prev ? `<a href="${monthUrl(s.k, prev)}">‹ ${prev.y}년 ${prev.m}월</a>` : '<span></span>'}<a href="${urlOf(s.k)}">${esc(s.n)} 오늘의 운세</a>${next ? `<a href="${monthUrl(s.k, next)}">${next.y}년 ${next.m}월 ›</a>` : '<span></span>'}</div>
  <h3 class="sub-title">${mo.m}월 다른 별자리 운세</h3>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip${x.k === s.k ? ' on' : ''}" href="${monthUrl(x.k, mo)}">${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  const title = `${s.n} ${mo.m}월 운세 (${mo.y}) — 연애·일·돈 흐름`;
  const desc = `${mo.y}년 ${mo.m}월 ${s.n}(${fmtP(s.p)}) 운세. ${overview ? String(overview).split(/(?<=[.!?])\s+/)[0] + ' ' : ''}주차별 대표 문장과 날짜별 운세 ${rows.length}일치를 모았습니다.`.slice(0, 160);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, inLanguage: 'ko', mainEntityOfPage: SITE.url + path, image: SITE.ogImage, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    crumbLd([['홈', '/'], [s.n, urlOf(s.k)], [`${mo.y}년 ${mo.m}월`, path]]),
  ];
  // 월별 페이지는 한 달 남짓만 걸려 있다 내려가는 페이지라 검색에는 내보내지 않는다(sitemap 에서도 뺀다)
  return layout({ title, desc, path, body, ld, robots: 'noindex, follow', nav: 'home' });
}

// ---------- 별자리 경계 시각 (계산기·경계 시각표 공용) ----------
// 1950~2030년은 Astronomy Engine 계산값(data/sun-ingress-calc.json, tools/sun-ingress/gen.mjs 생성), 한국천문연구원 자료가 있는 해는 그 값을 우선 쓴다.
const ingressCalc = JSON.parse(readFileSync(join(root, 'data/sun-ingress-calc.json'), 'utf8'));
const ING_YEARS = Object.keys(ingressCalc.years).sort();
const ING = Object.fromEntries(ING_YEARS.map((y) => {
  const k = ingress.years?.[y];
  return [y, { src: k ? 'kasi' : 'calc', list: (k || ingressCalc.years[y]).map((r) => [r.starts, r.kst]) }];
}));
// 계산값을 공개 자료와 대조 — 한국천문연구원 분 단위 시각, 홍콩천문대 날짜(홍콩 시각 UTC+8)
const ING_CHECK = (() => {
  const diffs = [];
  for (const [y, list] of Object.entries(ingress.years || {})) for (const r of list) {
    const c = ingressCalc.years[y]?.find((x) => x.deg === r.deg);
    if (c) diffs.push((Date.parse(c.kst + ':00Z') - Date.parse(r.kst + ':00Z')) / 60000);
  }
  let hkoN = 0, hkoSame = 0;
  for (const [y, list] of Object.entries(ingressHko.years || {})) {
    const H = Object.fromEntries(list);
    for (const r of ingressCalc.years[y] || []) {
      if (!H[r.starts]) continue;
      hkoN++;
      const d = new Date(Date.parse(r.kst + ':00Z') - 3600e3);
      if (`${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` === H[r.starts]) hkoSame++;
    }
  }
  const abs = diffs.map(Math.abs);
  return { n: diffs.length, max: Math.max(...abs), mean: abs.reduce((a, b) => a + b, 0) / abs.length, exact: abs.filter((x) => x === 0).length, one: abs.filter((x) => x === 1).length, hkoN, hkoSame };
})();
if (!ING_CHECK.n || ING_CHECK.max > 2) { console.error(`✖ 계산 경계 시각이 한국천문연구원 값과 최대 ${ING_CHECK.max}분 어긋납니다(기준 2분) — tools/sun-ingress 확인`); process.exit(1); }
const KASI_YEARS = Object.keys(ingress.years || {}).sort();
const KASI_RANGE = `${KASI_YEARS[0]}~${KASI_YEARS[KASI_YEARS.length - 1]}`;
const CALC_RANGE = `${ING_YEARS[0]}~${ING_YEARS[ING_YEARS.length - 1]}`;
// 표준시가 UTC+9 가 아니었거나 일광절약시간을 쓴 해(위키백과 영어판 Time in South Korea — 연 단위로만 확인됨)
const TZ_ODD_YEARS = [1948, 1949, 1950, 1951, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1987, 1988];
const fmtMean = (x) => x.toFixed(2).replace(/0$/, '');

// ---------- 별자리 계산기 ----------
function pageCalculator() {
  const path = '/zodiac-calculator';
  const years = KASI_YEARS;
  const ordered = ORDER.map((k) => byKey.get(k));
  const startTerm = (k) => (ingress.years?.[years[years.length - 1]] || []).find((r) => r.starts === k)?.term || '';
  const cell = (y, k) => { const r = (ingress.years[y] || []).find((x) => x.starts === k); return r ? `${Number(r.kst.slice(5, 7))}/${Number(r.kst.slice(8, 10))} ${r.kst.slice(11)}` : '—'; };
  const body = `
${crumbHtml([['홈', '/'], ['별자리 계산기', path]])}
<article class="sign-page">
<header class="home-hero" style="padding-top:20px"><h1>별자리 계산기</h1>
<p class="hero-sub">생년월일을 넣으면 태양 별자리를 알려 드립니다. ${CALC_RANGE}년생은 태양이 별자리 경계를 지나는 시각을 분 단위로 비교해 판정합니다.</p></header>
<section class="calc-box">
  <div class="calc-row">
    <label>태어난 해 <small>(선택)</small><input id="cy" type="number" inputmode="numeric" min="1900" max="2100" placeholder="예: 1995"></label>
    <label>월<select id="cm">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('')}</select></label>
    <label>일<select id="cd">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('')}</select></label>
    <label>태어난 시각 <small>(선택)</small><input id="ct" type="time"></label>
  </div>
  <button class="result-btn" id="calcBtn" type="button">내 별자리 찾기</button>
  <div class="result-card" id="calcOut" aria-live="polite"></div>
  <p class="note">입력한 생년월일은 이 브라우저 안에서만 계산하고 어디에도 저장하거나 보내지 않습니다.</p>
</section>

<section>
  <h2 class="sec-title">별자리는 이렇게 정해집니다</h2>
  <div class="prose">
    <p>운세에서 말하는 별자리는 태어난 순간 태양이 황도 위 어느 구간에 있었는지로 정해집니다. 황도를 춘분점부터 30°씩 12구간으로 나눈 것이 황도 12궁이고, 태양이 30°의 배수를 지나는 순간마다 별자리가 바뀝니다. 자세한 유래는 <a href="/guide/what-is-zodiac">황도 12궁이란</a>에 정리해 두었습니다.</p>
    <p>그 순간은 해마다 조금씩 달라집니다. 1년이 정확히 365일이 아니어서 같은 절기라도 시각이 매년 몇 시간씩 밀리고, 윤년에 다시 당겨지기 때문입니다. 그래서 아래 표의 날짜 범위는 대표값이고, 경계일 앞뒤 하루는 태어난 해와 시각에 따라 별자리가 달라질 수 있습니다.</p>
  </div>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>별자리</th><th>일반 날짜 범위</th><th>시작 절기</th><th>원소</th></tr></thead>
  <tbody>${ordered.map((s) => `<tr><th scope="row"><a href="${urlOf(s.k)}">${esc(s.n)}</a></th><td>${esc(fmtP(s.p))}</td><td>${esc(startTerm(s.k))}</td><td>${esc(s.el)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<section>
  <h2 class="sec-title">계산기가 쓰는 경계 시각</h2>
  <div class="prose">
    <p><b>${KASI_RANGE}년</b>은 한국천문연구원이 공개한 연도별 24절기 시각 가운데 태양이 황경 30°의 배수를 지나는 12개 중기의 시각을 씁니다. <b>그 밖의 ${CALC_RANGE}년</b>은 공개 천문 계산 라이브러리 Astronomy Engine으로 같은 순간을 직접 계산한 값을 씁니다. 두 값을 겹치는 ${KASI_RANGE}년 ${ING_CHECK.n}개 시각에서 비교하면 ${ING_CHECK.exact}개는 분까지 같고 나머지 ${ING_CHECK.n - ING_CHECK.exact}개는 ${ING_CHECK.max}분 차이였습니다(평균 ${fmtMean(ING_CHECK.mean)}분). 결과 화면에는 어느 쪽 값으로 판정했는지 함께 적습니다.</p>
    <p>태어난 날이 경계일이거나 그 앞뒤 하루라면 태어난 시각을 넣어 주세요. 경계일에 시각 없이 계산하면 두 별자리를 함께 안내합니다. 연도별 시각 전체와 비교 방법은 <a href="/zodiac-calculator/boundaries">연도별 별자리 경계 시각표</a>에 정리했습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">한국천문연구원 경계 시각 (${KASI_RANGE}년)</h2>
  <div class="tbl-wrap"><table class="data-table nowrap">
  <thead><tr><th>시작하는 별자리</th>${years.map((y) => `<th>${y}</th>`).join('')}</tr></thead>
  <tbody>${ordered.map((s) => `<tr><th scope="row">${esc(s.n)}</th>${years.map((y) => `<td>${cell(y, s.k)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <p class="note">시각은 한국 표준시(KST)입니다. ${esc(ingress.source?.note || '')} 해외에서 태어났다면 출생 시각을 한국 시각으로 바꿔 입력해 주세요.</p>
</section>

<section>
  <h2 class="sec-title">경계일에 태어났다면</h2>
  <div class="prose">
    <p>생일이 두 별자리의 경계에 걸쳐 있다면 계산 결과의 두 별자리 설명을 모두 읽어 보세요. 점성술에서는 이런 경우를 “커스프(cusp)”라고 부르기도 합니다. 정확한 판정에는 태어난 해와 시각, 그리고 태어난 곳의 시간대가 필요합니다.</p>
    <p>한국의 표준시는 늘 지금과 같지 않았습니다. 1954년부터 1961년 다시 바꾸기 전까지는 UTC+8:30을 썼고, 1948~1951년·1955~1960년·1987~1988년에는 여름철 일광절약시간을 썼습니다(<a href="${SRC.tzKorea.url}" target="_blank" rel="noopener">Wikipedia — Time in South Korea</a>). 계산기의 시각은 모두 UTC+9 기준이므로, 이 시기에 경계일 무렵 태어났다면 출생 기록의 시각이 어느 기준인지 확인해 보세요.</p>
    <p>별자리를 알았다면 <a href="/guide/elements">원소</a>와 <a href="/guide/modalities">모달리티</a>, <a href="/guide/ruling-planets">지배 행성</a>으로 그 별자리가 어떻게 분류되는지 볼 수 있고, <a href="/compatibility">궁합</a>에서 다른 별자리와의 관계도 확인할 수 있습니다.</p>
  </div>
</section>
<p class="note">출처: ${srcLinks(['kasi', 'almanac', 'astroEngine', 'hko', 'tzKorea', 'terms24', 'sign'])}</p>
</article>`;
  const extraScript = `<script>
var Z=${JSON.stringify(signs.map((x) => ({ k: x.k, n: x.n, e: x.e, p: x.p, el: x.el, r: x.ruler })))}, I=${JSON.stringify(Object.fromEntries(ING_YEARS.map((y) => [y, ING[y].list])))}, S=${JSON.stringify(Object.fromEntries(ING_YEARS.map((y) => [y, ING[y].src === 'kasi' ? 1 : 0])))}, TZ=${JSON.stringify(TZ_ODD_YEARS)}, MU='${curMonth.ym}', MM=${M}, YR='${CALC_RANGE}';
function rng(p){var a=p.split('-'),s=a[0].split('.'),e=a[1].split('.');return {s:(+s[0])*100+(+s[1]),e:(+e[0])*100+(+e[1])};}
function byDate(m,d){var v=m*100+d;for(var i=0;i<Z.length;i++){var r=rng(Z[i].p);if(r.s<=r.e?(v>=r.s&&v<=r.e):(v>=r.s||v<=r.e))return Z[i];}return null;}
function byKey(k){for(var i=0;i<Z.length;i++)if(Z[i].k===k)return Z[i];return null;}
function pad(n){return (n<10?'0':'')+n;}
function card(z){return '<div class="rc-pair">'+z.n+'</div><p class="rc-asp">'+z.p.replace('-',' ~ ')+' · '+z.el+'의 별자리 · 지배 행성 '+z.r+'</p>';}
function links(z){return '<div class="rc-links"><a href="/zodiac/'+z.k+'">'+z.n+' 페이지</a><a href="/zodiac/'+z.k+'/'+MU+'">'+MM+'월 운세</a><a href="/compatibility/'+z.k+'">'+z.n+' 궁합</a></div>';}
function hm(s){return (+s.slice(5,7))+'월 '+(+s.slice(8,10))+'일 '+s.slice(11);}
function dayNo(s){return Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))/864e5;}
function calc(){
  var y=parseInt(document.getElementById('cy').value,10), m=+document.getElementById('cm').value, d=+document.getElementById('cd').value, t=document.getElementById('ct').value, out=document.getElementById('calcOut');
  var maxD=[31,(!y||(y%4===0&&y%100!==0)||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
  if(d>maxD){out.innerHTML='<p class="rc-text">'+m+'월에는 '+d+'일이 없습니다. 날짜를 다시 확인해 주세요.</p>';out.classList.add('on');return;}
  var html='', z=byDate(m,d), L=y&&I[y];
  if(L){
    var ds=y+'-'+pad(m)+'-'+pad(d), src=S[y]?'한국천문연구원 '+y+'년 절기 시각':'Astronomy Engine으로 계산한 '+y+'년 경계 시각', near=null, prev=byKey('capricorn'), cur=byKey('capricorn');
    for(var i=0;i<L.length;i++){var bd=L[i][1].slice(0,10);if(Math.abs(dayNo(bd)-dayNo(ds))<=1&&!near){near=L[i];prev=cur;}if(bd<ds)cur=byKey(L[i][0]);}
    var tzNote=TZ.indexOf(y)>=0?' '+y+'년에는 한국 표준시가 UTC+9가 아니었거나 일광절약시간을 쓴 기간이 있어, 출생 기록의 시각 기준을 확인해 보세요.':'';
    if(t){var full=ds+'T'+t;z=byKey('capricorn');for(var j=0;j<L.length;j++)if(L[j][1]<=full)z=byKey(L[j][0]);
      html=card(z)+'<p class="rc-text">'+y+'년 '+m+'월 '+d+'일 '+t+'(한국 시각)에 태양은 <b>'+z.n+'</b> 구간에 있었습니다.'+(near?' 가장 가까운 경계는 '+hm(near[1])+'에 '+byKey(near[0]).n+'로 바뀌는 시각입니다.'+tzNote:'')+' 판정 근거: '+src+'.</p>'+links(z);}
    else if(near&&near[1].slice(0,10)===ds){var nz=byKey(near[0]);
      html='<div class="rc-pair">'+prev.n+' 또는 '+nz.n+'</div><p class="rc-text">'+y+'년 '+m+'월 '+d+'일은 별자리가 바뀌는 날입니다. '+src+'으로 이날 '+near[1].slice(11)+'(한국 시각) 전에 태어났다면 '+prev.n+', 그 뒤라면 '+nz.n+'입니다. <b>태어난 시각을 넣으면 하나로 알려 드립니다.</b>'+tzNote+'</p><div class="rc-links"><a href="/zodiac/'+prev.k+'">'+prev.n+' 페이지</a><a href="/zodiac/'+nz.k+'">'+nz.n+' 페이지</a></div>';}
    else{z=cur;html=card(z)+'<p class="rc-text">'+y+'년 '+m+'월 '+d+'일에 태양은 '+z.n+' 구간에 있었습니다. 판정 근거: '+src+'.</p>';
      if(near)html+='<p class="rc-text"><b>경계일 바로 옆입니다</b> — '+hm(near[1])+'(한국 시각)에 '+byKey(near[0]).n+'로 바뀝니다. 해외에서 태어났거나 출생 시각 기준이 다르면 결과가 달라질 수 있으니, 태어난 시각을 넣어 분 단위로 확인해 보세요.'+tzNote+'</p>';
      html+=links(z);}
  } else if(z){
    // Z 는 물병자리부터 황도 순서. 별자리 시작일 ±1일이면 경계 안내 — 시작일·다음날은 앞 별자리, 전날은 그 별자리와 경계
    var v=m*100+d, other=null;
    function shiftMD(base,off){var dt=new Date(2000,Math.floor(base/100)-1,base%100+off);return (dt.getMonth()+1)*100+dt.getDate();}
    for(var k=0;k<Z.length;k++){var s=rng(Z[k].p).s;
      if(v===s||v===shiftMD(s,1))other=Z[(k+11)%12]; else if(v===shiftMD(s,-1))other=Z[k];}
    html=card(z)+'<p class="rc-text">'+m+'월 '+d+'일은 일반 날짜 범위로 '+z.n+'입니다.</p>';
    if(other){
      html+='<p class="rc-text"><b>경계일 안내</b> — 이 날짜는 '+z.n+'와 '+other.n+'의 경계에 가깝습니다. 태어난 해와 시각에 따라 '+other.n+'일 수 있습니다.'+(y?' 입력하신 '+y+'년은 경계 시각 자료('+YR+'년) 범위 밖이라 일반 범위로 계산했습니다.':' 태어난 해와 시각을 넣으면 '+YR+'년생은 분 단위로 판정합니다.')+'</p>';}
    html+=links(z);
  }
  out.innerHTML=html; out.classList.add('on');
}
document.getElementById('calcBtn').addEventListener('click',calc);
</script>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: '별자리 계산기', url: SITE.url + path, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web Browser', inLanguage: 'ko', description: '생년월일과 시각으로 태양 별자리를 찾고 경계일이면 분 단위 경계 시각으로 판정하는 도구', offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' } },
    crumbLd([['홈', '/'], ['별자리 계산기', path]]),
  ];
  return layout({ title: '별자리 계산기 — 생년월일로 내 별자리 찾기 (경계일 판정)', desc: `생년월일을 넣으면 태양 별자리를 알려 드립니다. ${CALC_RANGE}년생은 경계 시각을 분 단위로 비교해 판정합니다(${KASI_RANGE}년은 한국천문연구원 시각, 그 밖은 천문 계산값).`, path, body, ld, extraScript, nav: 'calc' });
}

// ---------- 연도별 별자리 경계 시각표 ----------
function pageBoundaries() {
  const path = '/zodiac-calculator/boundaries';
  const cols = ['aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn'].map((k) => byKey.get(k));
  const termOf = Object.fromEntries(ingressCalc.years[ING_YEARS[0]].map((r) => [r.starts, r.term]));
  const fmt = (kst) => `${Number(kst.slice(5, 7))}/${Number(kst.slice(8, 10))} ${kst.slice(11)}`;
  const rows = ING_YEARS.map((y) => { const L = Object.fromEntries(ING[y].list); return `<tr data-y="${y}"><th scope="row">${y}<small> ${ING[y].src === 'kasi' ? '천문연' : '계산'}</small></th>${cols.map((c) => `<td>${fmt(L[c.k])}</td>`).join('')}</tr>`; }).join('');
  const body = `
${crumbHtml([['홈', '/'], ['별자리 계산기', '/zodiac-calculator'], ['연도별 경계 시각표', path]])}
<article class="sign-page">
<header class="home-hero" style="padding-top:20px"><h1>연도별 별자리 경계 시각표</h1>
<p class="hero-sub">${CALC_RANGE}년, 태양이 황경 30°의 배수를 지나 별자리가 바뀌는 순간을 한국 시각(UTC+9) 분 단위로 정리했습니다.</p></header>

<section>
  <h2 class="sec-title">표 보는 법</h2>
  <div class="prose">
    <p>각 칸은 그 별자리가 시작되는 순간입니다. 예를 들어 양자리 칸의 시각은 태양이 황경 0°(춘분점)를 지나는 춘분 시각이고, 이 순간부터 양자리, 그 직전까지는 물고기자리입니다. 같은 별자리의 시작 시각이 해마다 약 6시간씩 늦어지다가 윤년이 지나면 다시 당겨지는 것을 볼 수 있습니다.</p>
    <p>연도 옆에 <b>천문연</b>이라고 적힌 ${KASI_RANGE}년은 한국천문연구원이 공개한 절기 시각이고, <b>계산</b>이라고 적힌 해는 아래 방법으로 직접 계산한 값입니다. <a href="/zodiac-calculator">별자리 계산기</a>도 같은 값으로 판정합니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">경계 시각표</h2>
  <div class="calc-row" style="margin-bottom:12px"><label>연도 선택<select id="yf"><option value="">전체 (${ING_YEARS.length}년)</option>${ING_YEARS.map((y) => `<option value="${y}">${y}년</option>`).join('')}</select></label></div>
  <div class="tbl-wrap"><table class="data-table nowrap" id="bt">
  <thead><tr><th>연도</th>${cols.map((c) => `<th scope="col" title="${esc(termOf[c.k] || '')}">${esc(c.n)}<br><small>${esc(termOf[c.k] || '')}</small></th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody>
  </table></div>
  <p class="note">시각은 모두 UTC+9 기준 “월/일 시:분”입니다. 1954~1961년의 UTC+8:30 표준시나 일광절약시간(1948~1951·1955~1960·1987~1988년)은 반영하지 않았습니다(<a href="${SRC.tzKorea.url}" target="_blank" rel="noopener">Wikipedia — Time in South Korea</a>).</p>
</section>

<section>
  <h2 class="sec-title">계산 방법</h2>
  <div class="prose">
    <p>공개 천문 계산 라이브러리 <a href="${SRC.astroEngine.url}" target="_blank" rel="noopener">Astronomy Engine</a>(${esc(ingressCalc.method.library)})의 SearchSunLongitude 함수로, 지구 중심에서 본 태양의 겉보기 황경이 0°, 30°, 60° … 330°가 되는 순간을 해마다 12개씩 찾았습니다. 이 함수의 황경은 그날의 춘분점을 기준으로 하며 세차와 장동, 태양빛이 지구까지 오는 시간을 반영합니다. 결과(세계시)에 9시간을 더해 한국 시각으로 바꾸고 초는 반올림해 분 단위로 적었습니다.</p>
    <p>계산 스크립트와 결과 파일은 사이트 저장소의 tools/sun-ingress/gen.mjs와 data/sun-ingress-calc.json입니다. 라이브러리 버전은 ${esc(ingressCalc.method.library.split(' (')[0])}로 고정했습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">공개 자료와 비교한 오차</h2>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>비교 대상</th><th>비교 개수</th><th>결과</th></tr></thead>
  <tbody>
  <tr><th scope="row"><a href="${SRC.kasi.url}" target="_blank" rel="noopener">한국천문연구원</a> 절기 시각 (${KASI_RANGE}년, 분 단위)</th><td>${ING_CHECK.n}개</td><td>분까지 같음 ${ING_CHECK.exact}개 · 1분 차이 ${ING_CHECK.one}개${ING_CHECK.max > 1 ? ` · 최대 ${ING_CHECK.max}분` : ''}<br>최대 오차 ${ING_CHECK.max}분, 평균 절대 오차 ${fmtMean(ING_CHECK.mean)}분</td></tr>
  <tr><th scope="row"><a href="${SRC.hko.url}" target="_blank" rel="noopener">홍콩천문대</a> 절기 날짜 (${CALC_RANGE}년, 홍콩 시각 날짜)</th><td>${ING_CHECK.hkoN}개</td><td>계산 시각을 홍콩 시각(UTC+8)으로 바꾼 날짜가 같은 것 ${ING_CHECK.hkoSame}개</td></tr>
  </tbody></table></div>
  <div class="prose" style="margin-top:14px">
    <p>1분 차이는 두 자료가 초 단위 값을 분으로 줄이는 방식이나 계산에 쓴 천체력이 조금씩 다르기 때문으로 보입니다. 분 단위 판정에서는 경계 시각과 같은 분에 태어난 경우만 결과가 갈릴 수 있습니다. 이 비교는 사이트를 빌드할 때마다 두 자료 파일로 다시 계산해 표시하며, 한국천문연구원 값과 2분 넘게 어긋나면 빌드가 멈추도록 해 두었습니다.</p>
  </div>
</section>
<p class="note">출처: ${srcLinks(['kasi', 'almanac', 'astroEngine', 'hko', 'tzKorea', 'terms24'])}</p>
</article>`;
  const extraScript = `<script>
(function(){var s=document.getElementById('yf'),rows=document.querySelectorAll('#bt tbody tr');
function apply(){var v=s.value;rows.forEach(function(r){r.style.display=!v||r.getAttribute('data-y')===v?'':'none';});try{history.replaceState(null,'',v?'?y='+v:location.pathname);}catch(e){}}
s.addEventListener('change',apply);
try{var q=new URLSearchParams(location.search).get('y');if(q&&s.querySelector('option[value="'+q+'"]')){s.value=q;apply();}}catch(e){}})();
</script>`;
  const title = `연도별 별자리 경계 시각표 (${CALC_RANGE}) — 별자리가 바뀌는 시각`;
  const desc = `${CALC_RANGE}년 태양이 별자리 경계(황경 30° 배수)를 지나는 시각을 한국 시각 분 단위로 정리했습니다. ${KASI_RANGE}년은 한국천문연구원 자료, 그 밖은 Astronomy Engine 계산값이며 오차를 공개합니다.`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Dataset', name: '연도별 별자리 경계 시각표', description: desc, url: SITE.url + path, inLanguage: 'ko', temporalCoverage: `${ING_YEARS[0]}/${ING_YEARS[ING_YEARS.length - 1]}`, creator: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    crumbLd([['홈', '/'], ['별자리 계산기', '/zodiac-calculator'], ['연도별 경계 시각표', path]]),
  ];
  return layout({ title, desc, path, body, ld, extraScript, nav: 'calc' });
}

// ---------- 가이드 ----------
function pageGuide(g) {
  const crumbs = g.path === '/guide' ? [['홈', '/'], ['별자리 기초', '/guide']] : [['홈', '/'], ['별자리 기초', '/guide'], [g.name, g.path]];
  const body = `${crumbHtml(crumbs)}\n<article class="sign-page">${g.body}\n</article>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, inLanguage: 'ko', mainEntityOfPage: SITE.url + g.path, image: SITE.ogImage, dateModified: CONTENT_UPDATED, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    crumbLd(crumbs),
  ];
  return layout({ title: g.title, desc: g.desc, path: g.path, body, ld, nav: 'guide' });
}

// ---------- 소개 ----------
function pageAbout() {
  const calFiles = readdirSync(join(root, 'data')).filter((f) => /^calendar-\d{4}-\d{2}\.json$/.test(f)).sort();
  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>사이트 소개</span></nav>
<article class="sign-page">
<header class="home-hero" style="padding-top:20px"><h1>사이트 소개</h1>
  <p class="hero-sub">${SITE.name}는 12별자리의 오늘 운세와 별자리별 성격·궁합·유래를 정리한 무료 읽을거리입니다.</p></header>

<section>
  <h2 class="sec-title">먼저 알아 두실 것 — 운세는 재미로 읽는 글입니다</h2>
  <div class="prose">
    <p>점성술은 과학적으로 검증된 예측 방법이 아닙니다. 이 사이트의 운세와 궁합은 모두 <b>재미와 참고를 위한 글</b>이며, 건강·법률·투자·진로처럼 중요한 판단의 근거로 삼아서는 안 됩니다. 운세가 나쁘게 나왔다고 걱정하거나 좋게 나왔다고 무리한 결정을 내리지 마세요.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">무엇을 볼 수 있나요</h2>
  <div class="prose">
    <p><b>별자리 페이지</b>(12장)에는 오늘의 총운·연애운·직장운·재물운, 성격의 강점과 주의할 점, 연애·일·돈을 대하는 방식, 잘 맞는 별자리와 부딪히기 쉬운 별자리, 그리스 신화 속 유래와 상징을 담았습니다. 페이지 아래쪽 “실제 하늘의 별자리” 단락에는 같은 이름의 천문학적 별자리에 관한 사실 정보(IAU 약어와 넓이, 가장 밝은 별, 관측하기 좋은 달, 태양이 실제로 그 별자리를 지나는 기간)를 위키백과 영어판 등 공개 자료와 직접 계산한 값으로 정리하고, 문장마다 출처를 달았습니다.</p>
    <p><b>월별 운세</b>는 별자리마다 한 달 치 날짜별 운세를 모은 페이지입니다. 맨 위에는 그달 문장에 자주 나온 내용을 묶은 흐름 요약을, 그 아래에는 주마다 다른 날들과 내용이 가장 많이 겹치는 문장을 그대로 옮긴 주차별 대표 문장을 둡니다. 월별 운세는 이번 달과 다음 달 것만 두고, 달이 바뀌면 지난달 페이지는 내리고 그 주소는 별자리 페이지로 연결합니다. 한 달 남짓만 걸리는 페이지라 검색 결과에는 내보내지 않습니다.</p>
    <p><b><a href="/compatibility">별자리 궁합</a></b>에서는 12 × 12 궁합표와 별자리별 궁합 해설(별자리마다 한 페이지에 열두 조합, 모두 78개 조합)을, <b><a href="/zodiac-calculator">별자리 계산기</a></b>에서는 생년월일로 별자리를 찾을 수 있습니다. 계산기는 ${CALC_RANGE}년생을 태양이 별자리 경계를 지나는 시각과 분 단위로 비교해 판정하며(${KASI_RANGE}년은 한국천문연구원 시각, 그 밖은 Astronomy Engine 계산값), 그 시각 전체와 공개 자료 대비 오차는 <a href="/zodiac-calculator/boundaries">연도별 별자리 경계 시각표</a>에 공개했습니다. 원소·모달리티·지배 행성 같은 기본 개념은 <b><a href="/guide">별자리 기초</a></b>에 출처와 함께 정리했습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">운세는 어떻게 작성하나요</h2>
  <div class="prose">
    <p>운세는 날짜와 별자리마다 미리 써 둔 글입니다. 무작위로 문장을 뽑는 방식이 아니라, 한 달 단위로 12별자리 × 날짜만큼의 총운·연애·일·돈 문장을 따로 작성해 날짜별 파일로 보관하고, 매일 자정이 지나면 그날 몫이 표시됩니다. 같은 날 같은 별자리를 여러 번 열어도 내용은 바뀌지 않습니다.</p>
    <p>작성할 때는 몇 가지 규칙을 지킵니다. 별자리마다 정리해 둔 성향(원소·지배 행성·강점과 약점)에 맞춰 쓰고, 그날의 실제 요일과 절기·기념일 같은 확인된 일정을 반영하며, 존댓말로 씁니다. 불안을 부추기는 문장, 병원 진료·검진이나 투자처럼 건강과 돈에 관한 구체적인 결정을 권하는 문장은 쓰지 않는 것을 원칙으로 하고, 지출 점검이나 휴식 같은 생활 습관 수준의 제안만 담습니다. 예전 운세에 이 원칙에 맞지 않는 표현이 남아 있다면 알려 주세요. 확인하는 대로 고치겠습니다.</p>
    <p><b>날짜별 운세, 별자리 설명, 궁합 해설, 월별 흐름 요약, 별자리 기초 가이드는 모두 AI의 도움을 받아 초안을 만들고, 운영자가 직접 읽고 고친 뒤 올립니다.</b> 가이드의 사실 정보는 각 페이지에 단 공개 출처와 대조했습니다. 운영자는 점성술 전문가가 아니며, 이 사이트의 글은 서양 점성술의 전통적 해석을 참고한 읽을거리입니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">올리기 전에 거치는 검사</h2>
  <div class="prose">
    <p>사이트는 매일 자정 직후 자동으로 다시 만들어지며, 그때마다 아래 검사를 거칩니다.</p>
  </div>
  <ul class="fact-list">
    <li>12별자리 × 그달 모든 날짜에 총운·연애·일·돈 네 항목이 빠짐없이 있는지</li>
    <li>문장에 적힌 요일이 실제 달력의 요일과 맞는지, 반말 문장이 섞이지 않았는지 — 기준을 넘으면 빌드 기록에 경고를 남겨 고칩니다</li>
    <li>페이지마다 본문 분량이 충분한지, 화면에 채워지지 않은 빈 값이 그대로 드러나지 않는지, 사이트 안의 링크와 페이지 안 이동 위치(#)가 모두 있는지</li>
    <li>공유 버튼 등에 쓰는 스크립트에 문법 오류가 없는지</li>
  </ul>
</section>

<section>
  <h2 class="sec-title">일정과 사실 정보의 출처</h2>
  <div class="prose">
    <p>운세에 반영한 절기·기념일·시험 일정은 달마다 따로 정리해 두고, 월별 운세 페이지에 날짜와 출처 링크를 함께 실었습니다. 절기 날짜와 시각은 <a href="${SRC.kasi.url}" target="_blank" rel="noopener">한국천문연구원 천문우주정보</a>를, 시험 일정은 교육부·한국교육과정평가원 발표를 따랐습니다.${calFiles.length ? ` 지금 정리된 달: ${calFiles.map((f) => { const ym = f.slice(9, 16); return `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5))}월`; }).join(', ')}.` : ''}</p>
    <p>황도 12궁의 유래, 원소·모달리티·지배 행성 같은 분류는 위키백과 등 공개 자료에 있는 내용만 옮기고, 각 페이지 아래에 출처를 달았습니다. 별자리 신화는 판본에 따라 세부가 다를 수 있어 가장 널리 알려진 줄거리만 실었습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">운영자와 문의</h2>
  <div class="prose">
    <p>서울에서 일하는 소프트웨어 개발자가 개인적으로 만들고 운영합니다. 사업자 등록을 한 상업 사이트가 아니며, 운영 비용은 광고로 충당합니다.</p>
    <p>잘못된 내용이나 오탈자, 고쳤으면 하는 부분은 <a href="mailto:comeonyourboyz@gmail.com">comeonyourboyz@gmail.com</a>으로 알려 주세요. 자세한 안내는 <a href="/contact">문의하기</a>에 있습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">광고와 개인정보</h2>
  <div class="prose">
    <p>이 사이트는 회원가입 없이 누구나 무료로 볼 수 있습니다. 광고는 본문이 끝난 뒤 페이지 아래쪽과, 넓은 화면의 양옆 여백에만 둡니다. 수집하는 정보와 쿠키에 관한 내용은 <a href="/privacy">개인정보처리방침</a>에 정리해 두었습니다. 별자리 계산기에 넣은 생년월일은 브라우저 안에서만 계산하고 저장하지 않습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">별자리 바로 가기</h2>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip" href="${urlOf(x.k)}">${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: '사이트 소개', url: SITE.url + '/about', inLanguage: 'ko', description: `${SITE.name} 소개와 운세 작성 방식, 이용 시 유의사항` },
    crumbLd([['홈', '/'], ['사이트 소개', '/about']])];
  return layout({ title: `사이트 소개 — 운세 작성 방식과 출처`, desc: `${SITE.name}가 어떤 사이트인지, 운세를 어떤 규칙과 검사를 거쳐 작성하는지(AI 도움·운영자 검토), 일정과 사실 정보의 출처, 문의처를 정리했습니다.`, path: '/about', body, ld, nav: 'about' });
}

// ---------- 개인정보처리방침 (본문은 src/privacy-body.html) ----------
function pagePrivacy() {
  const body = `
${crumbHtml([['홈', '/'], ['개인정보처리방침', '/privacy']])}
<article class="sign-page doc">
${readFileSync(join(root, 'src/privacy-body.html'), 'utf8').trim()}
</article>`;
  return layout({ title: '개인정보처리방침 — 오늘의 운세', desc: '오늘의 운세가 수집하는 정보와 쿠키·광고 처리 방침입니다. 회원가입 없이 이용하며 생년월일은 저장하지 않습니다.', path: '/privacy', body, ads: false });
}

// ---------- 404 (Vercel 이 없는 주소에 404.html 을 돌려준다. 검색 제외·sitemap 제외) ----------
function pageNotFound() {
  const sun = sunToday(), cur = byKey.get(sun.astro.starts);
  const body = `
<article class="sign-page nf">
<header class="home-hero"><p class="eyebrow">404</p><h1>찾는 페이지가 없습니다</h1>
<p class="hero-sub">주소가 바뀌었거나 내려간 페이지입니다. 지난달 월별 운세는 달이 바뀌면 내리고 별자리 페이지로 연결합니다.</p></header>
<section>
  <h2 class="sec-title">여기서 다시 찾아 보세요</h2>
  <div class="guide-cards"><a class="guide-card" href="/"><b>오늘의 운세 홈</b><span>12별자리 오늘의 한 줄과 별자리 경계 시각표</span></a><a class="guide-card" href="${urlOf(cur.k)}"><b>${esc(cur.n)} 오늘의 운세</b><span>오늘 태양이 지나는 점성술 구간의 별자리</span></a><a class="guide-card" href="/compatibility"><b>별자리 궁합</b><span>12 × 12 궁합표와 별자리별 해설</span></a><a class="guide-card" href="/zodiac-calculator"><b>별자리 계산기</b><span>생년월일로 내 별자리 찾기</span></a></div>
</section>
<section>
  <h2 class="sec-title">별자리 바로 가기</h2>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip" href="${urlOf(x.k)}">${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  return layout({ title: '페이지를 찾을 수 없습니다 — 오늘의 운세', desc: '찾는 페이지가 없습니다. 오늘의 운세 홈이나 별자리 페이지에서 다시 찾아 보세요.', path: '/404', body, robots: 'noindex, follow', ads: false });
}

// ---------- 실행 ----------
for (const s of signs) write(`zodiac/${s.k}/index.html`, pageSign(s));
write('index.html', pageHome());
write('compatibility.html', pageCompat());
write('about.html', pageAbout());
write('contact.html', pageContact());
write('privacy.html', pagePrivacy());
write('404.html', pageNotFound());
months.forEach((mo, i) => { for (const s of signs) write(`zodiac/${s.k}/${mo.ym}/index.html`, pageMonth(s, mo, i)); });
for (const k of ORDER) write(`compatibility/${k}/index.html`, pageSignCompat(byKey.get(k)));
write('zodiac-calculator/index.html', pageCalculator());
write('zodiac-calculator/boundaries/index.html', pageBoundaries());
const guides = makeGuides({ signs, esc, urlOf, ingress, ELEM_PAIR, pairUrl });
for (const g of guides) write(`${g.path.slice(1)}/index.html`, pageGuide(g));

// 지금 만들지 않는 예전 산출물 정리 — 지난달 월별 페이지, 예전 조합별 궁합 페이지(<a>-<b>)
// 매일 빌드(GitHub Action)가 git add -A 로 커밋하므로 여기서 지우면 저장소에서도 빠진다
const removed = [];
for (const s of signs) {
  const dir = join(root, 'zodiac', s.k);
  for (const d of readdirSync(dir)) if (/^\d{4}-\d{2}$/.test(d) && !months.some((mo) => mo.ym === d)) { rmSync(join(dir, d), { recursive: true, force: true }); removed.push(`zodiac/${s.k}/${d}`); }
}
for (const d of readdirSync(join(root, 'compatibility'))) if (!ORDER.includes(d)) { rmSync(join(root, 'compatibility', d), { recursive: true, force: true }); removed.push(`compatibility/${d}`); }
if (removed.length) console.log(`  예전 산출물 ${removed.length}개 정리 (${removed.slice(0, 3).join(', ')}${removed.length > 3 ? ' …' : ''})`);

// vercel.json redirects — 빌드가 매번 다시 쓴다(직접 고치지 말 것)
//  1) 지난달 월별 페이지 /zodiac/<sign>/<YYYY-MM> → /zodiac/<sign>  (data/fortune-YYYY-MM.json 이 있는 지난달 전부)
//  2) 예전 궁합 상세 /compatibility/<a>-<b>, /compatibility/<b>-<a> → /compatibility/<a>#<b>
const signAlt = ORDER.join('|');
const redirects = [
  ...pastMonths.map((ym) => ({ source: `/zodiac/:sign(${signAlt})/${ym}`, destination: '/zodiac/:sign', statusCode: 301 })),
  ...ORDER.flatMap((a) => ORDER.map((b) => ({ source: `/compatibility/${a}-${b}`, destination: `/compatibility/${a}#${b}`, statusCode: 301 }))),
];
{
  const vp = join(root, 'vercel.json');
  const vj = JSON.parse(readFileSync(vp, 'utf8'));
  vj.redirects = redirects;
  writeFileSync(vp, JSON.stringify(vj, null, 2) + '\n');
}

const urls = [
  { loc: '/', p: '1.0', f: 'daily', lm: TODAY },
  ...signs.map((s) => ({ loc: urlOf(s.k), p: '0.9', f: 'daily', lm: TODAY })),
  { loc: '/compatibility', p: '0.8', f: 'monthly', lm: CONTENT_UPDATED },
  ...ORDER.map((a) => ({ loc: signCompatUrl(a), p: '0.7', f: 'yearly', lm: CONTENT_UPDATED })),
  { loc: '/zodiac-calculator', p: '0.7', f: 'yearly', lm: CONTENT_UPDATED },
  { loc: '/zodiac-calculator/boundaries', p: '0.6', f: 'yearly', lm: CONTENT_UPDATED },
  ...guides.map((g) => ({ loc: g.path, p: '0.6', f: 'yearly', lm: CONTENT_UPDATED })),
  { loc: '/about', p: '0.3', f: 'yearly' },
  { loc: '/contact', p: '0.3', f: 'yearly' },
  { loc: '/privacy', p: '0.2', f: 'yearly' },
];
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE.url}${u.loc}</loc>${u.lm ? `<lastmod>${u.lm}</lastmod>` : ''}<changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n')}\n</urlset>\n`);

// 본문 분량 검증 — 애드센스 거절 원인이 "HTML에 본문 없음"이었으므로 빌드마다 확인
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
let minLen = Infinity, minWho = '';
for (const s of signs) { const n = strip(readFileSync(join(root, `zodiac/${s.k}/index.html`), 'utf8')).length; if (n < minLen) { minLen = n; minWho = s.k; } }
const homeLen = strip(readFileSync(join(root, 'index.html'), 'utf8')).length;
let newMin = Infinity, newMinWho = '';
for (const f of written.filter((f) => /^(compatibility\/|zodiac-calculator|guide|zodiac\/[a-z]+\/\d{4}-\d{2})/.test(f))) { const n = strip(readFileSync(join(root, f), 'utf8')).length; if (n < newMin) { newMin = n; newMinWho = f; } }

// 생성된 HTML 검사 — 인라인 <script> 문법, 깨진 값 누출, 사이트 안 링크
{
  let checked = 0;
  const fail = (m) => { console.error(`✖ ${m}`); process.exit(1); };
  // vercel.json cleanUrls: /x → x.html 또는 x/index.html, 확장자가 있으면 그 파일
  const exists = (p) => { if (p === '/') return true; const r = join(root, p); return /\.[a-z0-9]+$/i.test(p) ? existsSync(r) : existsSync(r + '.html') || existsSync(join(r, 'index.html')); };
  const broken = new Set();
  for (const f of written) {
    const html = readFileSync(join(root, f), 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      if (!m[1].trim()) continue;
      try { new Function(m[1]); checked++; } catch (e) { fail(`${f} 인라인 스크립트 문법 오류: ${e.message}`); }
    }
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    const leak = visible.match(/undefined|NaN|\[object |\$\{|\{\{|\}\}/);
    if (leak) fail(`${f} 깨진 값 누출: "${leak[0]}" — ${visible.slice(Math.max(0, leak.index - 60), leak.index + 40).replace(/\s+/g, ' ')}`);
    for (const m of visible.matchAll(/href="(\/[^"#?]*)/g)) if (!exists(m[1])) broken.add(`${f} → ${m[1]}`);
    // 같은 사이트 안 #앵커 — 대상 페이지에 그 id 가 있어야 한다
    for (const m of visible.matchAll(/href="(\/[^"#?]*)?#([^"]+)"/g)) {
      const target = m[1] ? written.find((w) => w === `${m[1].slice(1)}.html` || w === `${m[1].slice(1)}/index.html` || (m[1] === '/' && w === 'index.html')) : f;
      if (target && !readFileSync(join(root, target), 'utf8').includes(`id="${m[2]}"`)) broken.add(`${f} → ${m[1] || ''}#${m[2]} (앵커 없음)`);
    }
  }
  if (broken.size) fail(`깨진 내부 링크 ${broken.size}개:\n  ${[...broken].slice(0, 20).join('\n  ')}`);
  console.log(`  인라인 스크립트 ${checked}개 문법 검증 통과, 깨진 값·내부 링크 검사 통과 (${written.length}개 파일)`);
}

if (constDropped.length) console.warn(`  ⚠ 출처가 없어 출력하지 않은 별자리 자료 ${new Set(constDropped).size}개: ${[...new Set(constDropped)].slice(0, 8).join(', ')}`);
console.log(`✔ 빌드 완료 — 별자리 ${signs.length}장 + 홈, 월별 ${months.length * signs.length}장(${months.map((mo) => mo.ym).join(', ')} · noindex), 별자리별 궁합 12장(조합 78개), 리다이렉트 ${redirects.length}개(지난달 ${pastMonths.join(', ') || '없음'}), 계산기 1장 + 경계 시각표 1장(KASI 대조 최대 ${ING_CHECK.max}분·평균 ${fmtMean(ING_CHECK.mean)}분), 가이드 ${guides.length}장, sitemap ${urls.length}개 (기준일 ${TODAY})`);
console.log(`  HTML 본문 글자수: 홈 ${homeLen}자, 별자리 최소 ${minLen}자 (${minWho}), 새 페이지 최소 ${newMin}자 (${newMinWho})`);
if (minLen < 1500 || homeLen < 800 || newMin < 1500) { console.error('✖ 본문이 너무 짧습니다. 애드센스 재심사 전에 확인하세요.'); process.exit(1); }
