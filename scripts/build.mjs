// data/*.json → 정적 HTML 생성
//  - zodiac/<key>/index.html  12장 (본문이 HTML에 직접 들어감)
//  - index.html               홈 (별자리 카드 + 소개 본문)
//  - sitemap.xml
// 실행: node scripts/build.mjs [YYYY-MM-DD]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = {
  url: 'https://todays-fortune-app.vercel.app',
  name: '오늘의 운세',
  desc: '12별자리 운세와 별자리별 성격·궁합·신화를 정리한 별자리 사전. 오늘의 총운, 연애운, 직장운, 재물운을 확인하세요.',
  ogImage: 'https://todays-fortune-app.vercel.app/og-image.png?v=2',
  adsense: 'ca-pub-5479403345572412',
  coupang: { tracking: 'AF7330023', id: 1017186 },
  gsv: '1f373KtNH3atCzIil1snRuWtDwrzIfDYspZs5GWiRT4',
};

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
const fortunePath = join(root, `data/fortune-${MM}.json`);
if (!existsSync(fortunePath)) { console.error(`✖ ${fortunePath} 없음`); process.exit(1); }
const fortune = JSON.parse(readFileSync(fortunePath, 'utf8'));
const style = readFileSync(join(root, 'src/style.css'), 'utf8') + readFileSync(join(root, 'src/extra.css'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (t) => String(t).split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const byKey = new Map(signs.map((s) => [s.k, s]));
const urlOf = (k) => `/zodiac/${k}`;   // trailingSlash:false 라 슬래시 없이 링크
const dayKey = (d) => String(d).padStart(2, '0');
const fortuneOf = (k, d) => fortune[k]?.[dayKey(d)] ?? fortune[k]?.[String(d)] ?? null;
const daysInMonth = new Date(Y, M, 0).getDate();

let pages = 0;
const write = (rel, html) => { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); pages++; };

function layout({ title, desc, path, body, ld = [], extraHead = '', extraScript = '' }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE.url}${path}">
<meta name="robots" content="index, follow">
<meta name="google-site-verification" content="${SITE.gsv}">
<meta name="theme-color" content="#1a1a2e">
<meta property="og:type" content="${path === '/' ? 'website' : 'article'}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE.url}${path}">
<meta property="og:image" content="${SITE.ogImage}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE.ogImage}">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>${style}</style>
${ld.map(jsonld).join('\n')}
${extraHead}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsense}" crossorigin="anonymous"></script>
</head>
<body>
<header class="site-hdr"><div class="container hdr-in">
  <a class="brand" href="/"><span class="brand-star">✦</span> ${SITE.name}</a>
  <nav class="hdr-nav"><a href="/">별자리 12</a><a href="/compatibility">궁합</a><a href="/about">소개</a></nav>
</div></header>
<main class="container">
${body}
</main>
<div class="container ad-wrap"><div class="ad-inner"><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G({"id":${SITE.coupang.id},"template":"carousel","trackingCode":"${SITE.coupang.tracking}","width":"100%","height":"140","tsource":""});</script></div>
<p class="disclose">이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p></div>
<footer class="site-ftr"><div class="container">
  <div class="ftr-links">${signs.map((s) => `<a href="${urlOf(s.k)}">${esc(s.n)}</a>`).join('')}</div>
  <div class="ftr-links"><a href="/">홈</a><a href="/compatibility">별자리 궁합</a><a href="/about">사이트 소개</a><a href="/privacy">개인정보처리방침</a></div>
  <p class="ftr-note">별자리 운세는 서양 점성술의 전통적 해석을 참고해 정리한 읽을거리입니다. 의학·법률·투자 등 중요한 판단의 근거로 삼지 마세요. © ${Y} ${SITE.name}</p>
</div></footer>
${extraScript}
</body>
</html>`;
}

// ---------- 별자리 페이지 ----------
function pageSign(s) {
  const p = profiles[s.k];
  const today = fortuneOf(s.k, D);
  const path = urlOf(s.k);
  const monthRows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const f = fortuneOf(s.k, d);
    if (f) monthRows.push(`<tr${d === D ? ' class="is-today"' : ''}><th scope="row">${M}월 ${d}일</th><td>${esc(f.summary)}</td></tr>`);
  }
  const monthData = {};
  for (let d = 1; d <= daysInMonth; d++) { const f = fortuneOf(s.k, d); if (f) monthData[dayKey(d)] = f; }

  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>${esc(s.n)}</span></nav>

<article class="sign-page">
<header class="sign-hero">
  <div class="sign-emoji">${s.e}</div>
  <div>
    <h1>${esc(s.n)} <span class="sign-en">${esc(s.k)}</span></h1>
    <p class="sign-meta">${esc(s.p)} · ${esc(s.el)}의 별자리 · 지배행성 ${esc(s.ruler)}</p>
    <p class="sign-trait">${esc(s.trait)} 성향</p>
  </div>
</header>

<section class="today-box" id="todayBox">
  <h2 class="sec-title">오늘의 ${esc(s.n)} 운세 <span class="today-date" id="todayDate">${Y}년 ${M}월 ${D}일</span></h2>
  ${today ? `
  <div class="f-card f-main"><span class="f-label">총운</span><p id="f-summary">${esc(today.summary)}</p></div>
  <div class="f-grid">
    <div class="f-card"><span class="f-label">💕 연애운</span><p id="f-love">${esc(today.love)}</p></div>
    <div class="f-card"><span class="f-label">💼 직장운</span><p id="f-work">${esc(today.work)}</p></div>
    <div class="f-card"><span class="f-label">💰 재물운</span><p id="f-money">${esc(today.money)}</p></div>
  </div>` : '<p class="empty">오늘 운세를 준비 중입니다.</p>'}
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
  <h2 class="sec-title">${esc(s.n)}의 연애·일·돈</h2>
  <div class="style-grid">
    <div class="style-card"><h3>💕 연애 스타일</h3><p>${esc(p.love)}</p></div>
    <div class="style-card"><h3>💼 일하는 방식</h3><p>${esc(p.work)}</p></div>
    <div class="style-card"><h3>💰 돈 쓰는 습관</h3><p>${esc(p.money)}</p></div>
  </div>
</section>

<section>
  <h2 class="sec-title">${esc(s.n)}와 잘 맞는 별자리</h2>
  <div class="match-grid">
    ${p.match.map((m) => { const t = byKey.get(m.key); return `<a class="match-card good" href="${urlOf(m.key)}"><span class="m-emoji">${t ? t.e : '✦'}</span><span class="m-name">${esc(m.sign)}</span><span class="m-why">${esc(m.why)}</span></a>`; }).join('')}
  </div>
  <h3 class="sub-title">부딪히기 쉬운 별자리</h3>
  <div class="match-grid">
    ${p.clash.map((m) => { const t = byKey.get(m.key); return `<a class="match-card bad" href="${urlOf(m.key)}"><span class="m-emoji">${t ? t.e : '✦'}</span><span class="m-name">${esc(m.sign)}</span><span class="m-why">${esc(m.why)}</span></a>`; }).join('')}
  </div>
  <p class="note">궁합은 성향 차이를 보는 참고일 뿐입니다. 자세한 조합은 <a href="/compatibility">별자리 궁합 페이지</a>에서 볼 수 있습니다.</p>
</section>

<section>
  <h2 class="sec-title">${esc(s.n)}의 유래</h2>
  <div class="prose">${paras(p.myth)}</div>
</section>

<section>
  <h2 class="sec-title">${esc(s.n)}의 상징</h2>
  <table class="sym-table"><tbody>
    <tr><th>기간</th><td>${esc(s.p)}</td><th>원소</th><td>${esc(s.el)}</td></tr>
    <tr><th>지배행성</th><td>${esc(s.ruler)}</td><th>탄생석</th><td>${esc(p.symbols.stone)}</td></tr>
    <tr><th>행운의 색</th><td>${esc(p.symbols.color)}</td><th>행운의 숫자</th><td>${esc(p.symbols.number)}</td></tr>
    <tr><th>요일</th><td>${esc(p.symbols.day)}</td><th>꽃</th><td>${esc(p.symbols.flower)}</td></tr>
  </tbody></table>
  <p class="prose-sm">${esc(p.famous)}</p>
</section>

<section>
  <h2 class="sec-title">${M}월 ${esc(s.n)} 운세 흐름</h2>
  <div class="month-wrap"><table class="month-table"><tbody>${monthRows.join('')}</tbody></table></div>
</section>

<section>
  <h2 class="sec-title">다른 별자리 보기</h2>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip${x.k === s.k ? ' on' : ''}" href="${urlOf(x.k)}"><span>${x.e}</span>${esc(x.n)}</a>`).join('')}</div>
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
})();</script>`;

  return layout({
    title: `${s.n} 오늘의 운세와 성격·궁합 (${s.p}) | ${SITE.name}`,
    desc: `${s.n}(${s.p}) 오늘의 총운·연애운·직장운·재물운과 성격, 강점과 약점, 잘 맞는 별자리, 신화 유래까지 한 페이지에 정리했습니다.`,
    path, body, ld, extraScript,
  });
}

// ---------- 홈 ----------
function pageHome() {
  const body = `
<section class="home-hero">
  <p class="hero-date">${Y}년 ${M}월 ${D}일</p>
  <h1>오늘의 별자리 운세</h1>
  <p class="hero-sub">12별자리의 오늘 총운·연애운·직장운·재물운과 별자리별 성격·궁합·신화를 정리했습니다. 별자리를 눌러 보세요.</p>
</section>

<section>
  <div class="home-grid">
    ${signs.map((s) => { const f = fortuneOf(s.k, D); return `<a class="home-card" href="${urlOf(s.k)}">
      <span class="hc-emoji">${s.e}</span>
      <span class="hc-name">${esc(s.n)}</span>
      <span class="hc-period">${esc(s.p)}</span>
      <span class="hc-sum">${esc(f ? f.summary.slice(0, 48) + (f.summary.length > 48 ? '…' : '') : s.trait + ' 별자리')}</span>
    </a>`; }).join('')}
  </div>
</section>

<section>
  <h2 class="sec-title">별자리 운세, 이렇게 보세요</h2>
  <div class="prose">
    <p>별자리 운세는 태어난 날짜를 기준으로 태양이 어느 별자리 구간에 있었는지를 따지는 서양 점성술의 해석입니다. 흔히 말하는 "무슨 자리"는 이 태양 별자리를 가리킵니다. 생일이 두 별자리의 경계에 걸쳐 있다면 출생 연도와 시각에 따라 달라질 수 있어, 두 별자리 설명을 모두 읽어 보는 편이 낫습니다.</p>
    <p>이 사이트는 별자리마다 오늘의 운세와 함께 <b>성격의 강점과 약점, 연애·일·돈을 대하는 방식, 잘 맞는 별자리와 부딪히기 쉬운 별자리, 별자리에 얽힌 신화</b>를 정리해 두었습니다. 운세만 확인하고 닫기보다 자기 별자리 페이지를 한 번 읽어 보시면 왜 그런 해석이 나오는지 이해하는 데 도움이 됩니다.</p>
    <p>점성술은 과학적으로 검증된 예측 도구가 아닙니다. 오늘 하루를 돌아보는 계기 정도로 가볍게 보시고, 중요한 결정은 스스로의 판단으로 내리시기 바랍니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">원소별로 묶어 보기</h2>
  <div class="elem-grid">
    ${['불', '땅', '공기', '물'].map((el) => `<div class="elem-box">
      <h3>${el}의 별자리</h3>
      <div class="elem-signs">${signs.filter((s) => s.el === el).map((s) => `<a href="${urlOf(s.k)}">${s.e} ${esc(s.n)}</a>`).join('')}</div>
      <p>${{ 불: '행동이 앞서고 에너지가 밖으로 향합니다. 시작하는 힘이 강한 대신 지구력에서 아쉬울 때가 있습니다.', 땅: '현실 감각과 꾸준함이 강점입니다. 안정을 중시해 변화 앞에서는 속도가 느려집니다.', 공기: '생각과 말이 빠르고 사람을 잇는 데 능합니다. 감정보다 논리를 앞세우는 편입니다.', 물: '감정과 직관으로 상황을 읽습니다. 공감 능력이 뛰어난 만큼 주변 분위기에 쉽게 물듭니다.' }[el]}</p>
    </div>`).join('')}
  </div>
</section>`;

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, description: SITE.desc, inLanguage: 'ko' },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: '12별자리', itemListElement: signs.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.n, url: SITE.url + urlOf(s.k) })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: '별자리는 어떻게 정해지나요?', acceptedAnswer: { '@type': 'Answer', text: '태어난 날짜에 태양이 지나던 황도 12궁 구간으로 정해집니다. 흔히 말하는 별자리는 이 태양 별자리를 가리키며, 생일이 경계에 걸치면 출생 시각에 따라 달라질 수 있습니다.' } },
      { '@type': 'Question', name: '별자리 운세는 매일 바뀌나요?', acceptedAnswer: { '@type': 'Answer', text: '네, 12별자리 모두 날짜별로 총운·연애운·직장운·재물운이 준비되어 있습니다.' } },
      { '@type': 'Question', name: '별자리 궁합은 얼마나 믿을 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '점성술의 궁합은 성향 차이를 설명하는 전통적 해석입니다. 과학적 근거가 있는 예측이 아니므로 관계를 이해하는 참고 자료로만 활용하시기 바랍니다.' } },
    ] },
  ];
  return layout({ title: `${SITE.name} — 12별자리 오늘의 운세와 별자리별 성격·궁합`, desc: SITE.desc, path: '/', body, ld });
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
  5: { name: '쿼드컨스', score: 58, text: '공통분모가 가장 적은 각도입니다. 서로를 이해하려면 의식적인 노력이 필요하고, 그 노력이 관계의 질을 정합니다.' },
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
  const rows = signs.map((a) => `<tr><th scope="row"><a href="${urlOf(a.k)}">${a.e} ${esc(a.n)}</a></th>${signs.map((b) => { const { score } = pairScore(a, b); const cls = score >= 88 ? 'c-best' : score >= 78 ? 'c-good' : score >= 65 ? 'c-mid' : 'c-low'; return `<td class="${cls}" title="${esc(a.n)} × ${esc(b.n)}">${score}</td>`; }).join('')}</tr>`).join('');
  const seen = new Set(); const details = [];
  for (const a of signs) for (const b of signs) {
    const key = [a.k, b.k].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    const { asp, score } = pairScore(a, b);
    details.push({ a, b, asp, score });
  }
  details.sort((x, y) => y.score - x.score);
  const card = (d) => `<div class="pair-card"><div class="pair-head"><span class="pair-name">${d.a.e} ${esc(d.a.n)} × ${d.b.e} ${esc(d.b.n)}</span><span class="pair-score">${d.score}</span></div><p class="pair-asp">${esc(d.asp.name)} · ${esc(d.a.el)}과 ${esc(d.b.el)}</p><p class="pair-text">${esc(d.asp.text)}</p></div>`;
  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>별자리 궁합</span></nav>
<article class="sign-page">
<header class="home-hero" style="padding-top:20px">
  <h1>별자리 궁합표</h1>
  <p class="hero-sub">12별자리 78개 조합의 궁합을 원소와 각도로 정리했습니다. 표에서 두 별자리가 만나는 칸의 숫자가 궁합 점수입니다.</p>
</header>

<section>
  <h2 class="sec-title">12 × 12 궁합표</h2>
  <div class="month-wrap" style="overflow-x:auto"><table class="compat-table"><thead><tr><th></th>${signs.map((s) => `<th title="${esc(s.n)}">${s.e}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">세로줄이 나, 가로줄이 상대입니다. 색이 진할수록 전통적으로 조화롭다고 보는 조합입니다.</p>
</section>

<section>
  <h2 class="sec-title">궁합은 무엇으로 정해지나요</h2>
  <div class="prose">
    <p>점성술에서 두 별자리의 궁합은 크게 두 가지로 봅니다. 하나는 <b>원소</b>입니다. 12별자리는 불·땅·공기·물 네 원소로 나뉘고, 같은 원소끼리는 세상을 보는 방식이 비슷해 말이 잘 통합니다. 불과 공기, 땅과 물은 서로를 북돋우는 짝으로 봅니다. 반대로 불과 물, 공기와 땅은 속도와 관심사가 어긋나 조율이 필요합니다.</p>
    <p>다른 하나는 <b>각도</b>입니다. 황도 12궁을 원으로 놓았을 때 두 별자리가 몇 칸 떨어져 있는지를 따집니다. 네 칸 떨어진 트라인은 가장 편안하고, 세 칸 떨어진 스퀘어는 긴장이 크며, 정반대인 어포지션은 강하게 끌리면서도 부딪힙니다. 이 표의 점수는 두 기준을 합쳐 계산한 값입니다.</p>
    <p>점수가 낮다고 맞지 않는 관계라는 뜻은 아닙니다. 점성술에서도 긴장이 큰 조합이 서로를 가장 많이 성장시킨다고 봅니다. 잘 맞는 조합은 편안한 대신 자극이 적습니다. 어느 쪽이 좋은지는 두 사람이 관계에서 무엇을 원하는지에 달려 있습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">각도별 의미</h2>
  <div class="style-grid" style="grid-template-columns:repeat(2,1fr)">
    ${Object.values(ASPECT).map((a) => `<div class="style-card"><h3>${esc(a.name)}</h3><p>${esc(a.text)}</p></div>`).join('')}
  </div>
</section>

<section>
  <h2 class="sec-title">조합 78개 전체</h2>
  <div class="pair-grid">${details.map(card).join('')}</div>
</section>

<section>
  <h2 class="sec-title">별자리별 페이지</h2>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip" href="${urlOf(x.k)}"><span>${x.e}</span>${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: '별자리 궁합표 — 12별자리 78개 조합', description: '원소와 각도로 계산한 12별자리 궁합 점수와 해석', inLanguage: 'ko', mainEntityOfPage: SITE.url + '/compatibility', image: SITE.ogImage, datePublished: '2026-09-01', dateModified: TODAY, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: '별자리 궁합', item: SITE.url + '/compatibility' }] },
  ];
  return layout({ title: `별자리 궁합표 — 12별자리 78개 조합 점수 | ${SITE.name}`, desc: '12별자리 궁합을 원소와 각도로 계산한 표와 조합별 해석. 어떤 별자리끼리 잘 맞고 왜 부딪히는지 정리했습니다.', path: '/compatibility', body, ld });
}

// ---------- 소개 ----------
function pageAbout() {
  const body = `
<nav class="crumb"><a href="/">홈</a> › <span>사이트 소개</span></nav>
<article class="sign-page">
<header class="home-hero" style="padding-top:20px"><h1>사이트 소개</h1>
  <p class="hero-sub">${SITE.name}는 12별자리의 오늘 운세와 별자리별 성격·궁합·유래를 정리한 무료 읽을거리입니다.</p></header>

<section>
  <h2 class="sec-title">무엇을 볼 수 있나요</h2>
  <div class="prose">
    <p>별자리마다 페이지가 하나씩 있습니다. 각 페이지에는 <b>오늘의 총운·연애운·직장운·재물운</b>, 그 별자리의 성격적 강점과 주의할 점, 연애와 일과 돈을 대하는 방식, 잘 맞는 별자리와 부딪히기 쉬운 별자리, 별자리에 얽힌 그리스 신화, 탄생석과 행운의 색 같은 상징, 그리고 이번 달 운세 흐름이 담겨 있습니다.</p>
    <p><a href="/compatibility">별자리 궁합표</a>에서는 12별자리 78개 조합의 궁합 점수를 한 표로 볼 수 있습니다. 점수는 두 별자리의 원소 관계와 황도상 각도를 합쳐 계산했습니다. 계산 방식은 궁합 페이지에 그대로 적어 두었습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">운세는 어떻게 만들어지나요</h2>
  <div class="prose">
    <p>이 사이트의 운세는 날짜와 별자리를 조합해 미리 작성해 둔 글입니다. 무작위로 뽑아낸 문장이 아니라 별자리마다 성향에 맞춰 날짜별로 따로 써 두었고, 매일 자정이 지나면 그날 몫이 표시됩니다. 같은 날 같은 별자리를 여러 번 열어도 내용은 바뀌지 않습니다.</p>
    <p>별자리별 성격·궁합·신화 설명은 서양 점성술의 전통적 해석과 널리 알려진 그리스 신화를 바탕으로 정리했습니다. 신화는 판본에 따라 세부가 다를 수 있어, 가장 널리 통용되는 줄거리만 실었습니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">꼭 알아 두실 것</h2>
  <div class="prose">
    <p>점성술은 과학적으로 검증된 예측 방법이 아닙니다. 이 사이트의 모든 내용은 <b>재미로 읽는 글</b>이며, 건강·법률·투자·진로처럼 중요한 판단의 근거로 삼아서는 안 됩니다. 운세가 나쁘게 나왔다고 걱정하거나 좋게 나왔다고 무리한 결정을 내리지 마세요.</p>
    <p>별자리는 태어난 날 태양이 지나던 황도 구간으로 정합니다. 생일이 두 별자리의 경계에 걸쳐 있으면 출생 연도와 시각에 따라 달라질 수 있으니, 두 별자리 설명을 모두 읽어 보시기 바랍니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">운영과 광고</h2>
  <div class="prose">
    <p>이 사이트는 회원가입 없이 누구나 무료로 볼 수 있습니다. 운영 비용은 Google AdSense 광고와 쿠팡 파트너스 제휴 링크로 충당합니다. 쿠팡 파트너스 활동으로 일정액의 수수료를 제공받습니다. 수집하는 정보와 쿠키에 관한 내용은 <a href="/privacy">개인정보처리방침</a>에 정리해 두었습니다.</p>
    <p>잘못된 내용이나 고쳤으면 하는 부분이 있으면 알려 주시기 바랍니다.</p>
  </div>
</section>

<section>
  <h2 class="sec-title">별자리 바로 가기</h2>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip" href="${urlOf(x.k)}"><span>${x.e}</span>${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: '사이트 소개', url: SITE.url + '/about', inLanguage: 'ko', description: `${SITE.name} 소개와 운세 작성 방식, 이용 시 유의사항` },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' }, { '@type': 'ListItem', position: 2, name: '사이트 소개', item: SITE.url + '/about' }] }];
  return layout({ title: `사이트 소개 | ${SITE.name}`, desc: `${SITE.name}가 어떤 사이트인지, 운세와 별자리 설명을 어떻게 만들었는지, 이용할 때 무엇을 주의해야 하는지 정리했습니다.`, path: '/about', body, ld });
}

// ---------- 실행 ----------
for (const s of signs) write(`zodiac/${s.k}/index.html`, pageSign(s));
write('index.html', pageHome());
write('compatibility.html', pageCompat());
write('about.html', pageAbout());

const urls = [
  { loc: '/', p: '1.0', f: 'daily' },
  ...signs.map((s) => ({ loc: urlOf(s.k), p: '0.9', f: 'daily' })),
  { loc: '/compatibility', p: '0.8', f: 'monthly' },
  { loc: '/about', p: '0.3', f: 'yearly' },
  { loc: '/privacy', p: '0.2', f: 'yearly' },
];
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE.url}${u.loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n')}\n</urlset>\n`);

// 본문 분량 검증 — 애드센스 거절 원인이 "HTML에 본문 없음"이었으므로 빌드마다 확인
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
let minLen = Infinity, minWho = '';
for (const s of signs) { const n = strip(readFileSync(join(root, `zodiac/${s.k}/index.html`), 'utf8')).length; if (n < minLen) { minLen = n; minWho = s.k; } }
const homeLen = strip(readFileSync(join(root, 'index.html'), 'utf8')).length;
console.log(`✔ 빌드 완료 — 별자리 ${signs.length}장 + 홈, sitemap ${urls.length}개 (기준일 ${TODAY})`);
console.log(`  HTML 본문 글자수: 홈 ${homeLen}자, 별자리 최소 ${minLen}자 (${minWho})`);
if (minLen < 1500 || homeLen < 800) { console.error('✖ 본문이 너무 짧습니다. 애드센스 재심사 전에 확인하세요.'); process.exit(1); }
