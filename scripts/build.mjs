// data/*.json → 정적 HTML 생성
//  - zodiac/<key>/index.html           12장 (본문이 HTML에 직접 들어감)
//  - zodiac/<key>/<YYYY-MM>/index.html 월별 운세 (data/fortune-YYYY-MM.json 이 있는 달마다)
//  - compatibility/<a>-<b>/index.html  궁합 상세 78장
//  - zodiac-calculator/, guide/...     별자리 계산기·기초 설명
//  - index.html                        홈 (별자리 카드 + 소개 본문)
//  - sitemap.xml
// 실행: node scripts/build.mjs [YYYY-MM-DD]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SRC, MOD_OF, MOD_NAME, CLASSIC_RULER, QUAL } from './content.mjs';
import { makeGuides } from './guides.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = {
  url: 'https://todays-fortune-app.vercel.app',
  name: '오늘의 운세',
  desc: '12별자리 운세와 별자리별 성격·궁합·신화를 정리한 별자리 사전. 오늘의 총운, 연애운, 직장운, 재물운을 확인하세요.',
  ogImage: 'https://todays-fortune-app.vercel.app/og-image.png?v=2',
  // 카카오 애드핏 — 2026-08 에 이 사이트 매체로 등록해 둔 기존 광고 단위
  adfit: { bottom: 'DAN-XKdPIuDkSo3uxN1l', side: ['DAN-PJDk9Ix8QSZwmho2', 'DAN-oPwQwRMLYEcXD02F'] },
  gsv: ['1f373KtNH3atCzIil1snRuWtDwrzIfDYspZs5GWiRT4', 'WjzFs7iu4kDSzcJKM5QyAqGDAqx9J1P0uj-Ry4z1_NU'], // Search Console 인증 토큰(계정별). 어느 계정으로도 인증되게 모두 둔다
};

// 하단 320x50 은 모든 화면에 둔다. 양옆 160x600 은 본문(최대 920px) 밖에 자리가 남는
// 넓은 화면에서만 스크립트로 만들어 붙인다 — 좁은 화면에 숨긴 광고를 두지 않기 위해서다.
const adfitHtml = () => `<div class="adfit-bottom"><ins class="kakao_ad_area" style="display:none;" data-ad-unit="${SITE.adfit.bottom}" data-ad-width="320" data-ad-height="50"></ins></div>
<script>(function(){if(window.innerWidth<1320)return;${JSON.stringify(SITE.adfit.side)}.forEach(function(id,i){var d=document.createElement('div');d.className='adfit-side '+(i?'adfit-right':'adfit-left');d.innerHTML='<ins class="kakao_ad_area" style="display:none;" data-ad-unit="'+id+'" data-ad-width="160" data-ad-height="600"></ins>';document.body.appendChild(d);});})();</script>
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
const CONTENT_UPDATED = '2026-10-19';

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
const months = readdirSync(join(root, 'data'))
  .map((f) => f.match(/^fortune-(\d{4})-(\d{2})\.json$/)).filter(Boolean)
  .map((m) => { const y = Number(m[1]), mm = Number(m[2]); return { y, m: mm, ym: `${m[1]}-${m[2]}`, data: y === Y && mm === M ? fortune : JSON.parse(readFileSync(join(root, 'data', m[0]), 'utf8')) }; })
  .sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
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
const written = [];
const write = (rel, html) => { const p = join(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); pages++; written.push(rel); };

function layout({ title, desc, path, body, ld = [], extraHead = '', extraScript = '', robots = 'index, follow' }) {
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
<meta name="theme-color" content="#1a1a2e">
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>${style}</style>
${ld.map(jsonld).join('\n')}
${extraHead}
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" defer></script>
</head>
<body>
<header class="site-hdr"><div class="container hdr-in">
  <a class="brand" href="/"><span class="brand-star">✦</span> ${SITE.name}</a>
  <nav class="hdr-nav"><a href="/">별자리 12</a><a href="/compatibility">궁합</a><a href="/zodiac-calculator">계산기</a><a href="/guide">기초</a><a href="/about">소개</a></nav>
</div></header>
<main class="container">
${body}
</main>
${adfitHtml()}
<footer class="site-ftr"><div class="container">
  <div class="ftr-links">${signs.map((s) => `<a href="${urlOf(s.k)}">${esc(s.n)}</a>`).join('')}</div>
  <div class="ftr-links"><a href="/">홈</a><a href="/compatibility">별자리 궁합</a><a href="/zodiac-calculator">별자리 계산기</a><a href="/guide">별자리 기초</a><a href="/about">사이트 소개</a><a href="/contact">문의하기</a><a href="/privacy">개인정보처리방침</a></div>
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
  <div class="share-row">
    <button class="share-btn kakao" type="button" onclick="shareKakao()">💬 카카오톡</button>
    <button class="share-btn x" type="button" onclick="shareX()">𝕏 공유</button>
    <button class="share-btn link" type="button" onclick="copyLink()">🔗 링크 복사</button>
  </div>
</section>

<section>
  <h2 class="sec-title">월별 ${esc(s.n)} 운세</h2>
  <a class="month-cta" href="${monthUrl(s.k, curMonth)}"><b>${M}월 운세 전체 보기</b><span>주차별 흐름과 ${curMonth.days}일치 날짜별 운세를 한 페이지에 모았습니다</span></a>
  ${months.length > 1 ? `<div class="sign-links">${months.filter((mo) => mo !== curMonth).map((mo) => `<a class="sign-chip" href="${monthUrl(s.k, mo)}">${mo.y}년 ${mo.m}월</a>`).join('')}</div>` : ''}
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

<details class="fold"><summary>${esc(s.n)}의 연애·일·돈 스타일</summary>
  <div class="style-grid">
    <div class="style-card"><h3>💕 연애</h3><p>${esc(p.love)}</p></div>
    <div class="style-card"><h3>💼 일</h3><p>${esc(p.work)}</p></div>
    <div class="style-card"><h3>💰 돈</h3><p>${esc(p.money)}</p></div>
  </div>
</details>

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
  <h3 class="sub-title">${esc(s.n)}의 궁합 상세</h3>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip" href="${pairUrl(s.k, x.k)}"><span>${x.e}</span>${esc(x.n)}</a>`).join('')}</div>
</section>

<details class="fold"><summary>${esc(s.n)}의 유래와 상징</summary>
  <div class="prose">${paras(p.myth)}</div>
  <p class="prose-sm">탄생석 ${esc(p.symbols.stone)} · 행운의 색 ${esc(p.symbols.color)} · 행운의 숫자 ${esc(p.symbols.number)} · ${esc(p.symbols.day)}</p>
</details>

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
  <div class="sign-picker">
    ${signs.map((s) => `<a class="sp-tile" href="${urlOf(s.k)}"><span class="sp-emoji">${s.e}</span><span class="sp-name">${esc(s.n)}</span><span class="sp-period">${esc(s.p)}</span></a>`).join('')}
  </div>
  <div class="share-row home-share">
    <button class="share-btn kakao" type="button" onclick="shareKakao()">💬 카카오톡</button>
    <button class="share-btn x" type="button" onclick="shareX()">𝕏 공유</button>
    <button class="share-btn link" type="button" onclick="copyLink()">🔗 링크 복사</button>
  </div>
</section>

<section>
  <h2 class="sec-title">오늘의 한 줄 운세</h2>
  <div class="today-list">
    ${signs.map((s) => { const f = fortuneOf(s.k, D); return `<a class="tl-row" href="${urlOf(s.k)}">
      <span class="tl-emoji">${s.e}</span>
      <span class="tl-body"><span class="tl-name">${esc(s.n)} <small>${esc(s.p)}</small></span><span class="tl-sum">${esc(f ? f.summary : s.trait + ' 별자리')}</span></span>
    </a>`; }).join('')}
  </div>
</section>

<section>
  <h2 class="sec-title">이번 달 운세 <span class="today-date">${Y}년 ${M}월</span></h2>
  <p class="sec-lead">별자리마다 ${M}월 한 달의 주차별 흐름과 날짜별 운세를 모아 두었습니다.</p>
  <div class="sign-links">${signs.map((s) => `<a class="sign-chip" href="${monthUrl(s.k, curMonth)}"><span>${s.e}</span>${esc(s.n)} ${M}월</a>`).join('')}</div>
</section>

<section class="info-sec">
  <div class="info-box">
    <h2 class="info-title"><span class="info-ic">💡</span> 별자리 운세, 이렇게 보세요</h2>
    <p>별자리는 <b>태어난 날 태양이 지나던 구간</b>으로 정해집니다. 생일이 두 별자리 경계에 걸쳐 있다면 양쪽을 다 읽어 보세요.</p>
    <p>별자리 페이지에는 오늘의 운세와 함께 성격의 강점·약점, 잘 맞는 별자리를 정리해 두었습니다. 내 별자리가 헷갈리면 <a href="/zodiac-calculator">별자리 계산기</a>를, 원소나 지배 행성 같은 말이 궁금하면 <a href="/guide">별자리 기초</a>를 보세요.</p>
    <p class="info-note"><span class="info-ic">⚠️</span> 점성술은 검증된 예측 도구가 아닙니다. 하루를 돌아보는 계기 정도로 가볍게 보시고, 중요한 결정은 스스로 내리시기 바랍니다.</p>
  </div>
</section>

`;

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, description: SITE.desc, inLanguage: 'ko' },
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
  return layout({ title: `${SITE.name} — 12별자리 오늘의 운세와 별자리별 성격·궁합`, desc: SITE.desc, path: '/', body, ld, extraScript });
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
  const rows = signs.map((a, i) => `<tr><th scope="row"><a href="${urlOf(a.k)}">${a.e} ${esc(a.n)}</a></th>${signs.map((b, j) => { const score = matrix[i][j][0]; const cls = score >= 88 ? 'c-best' : score >= 78 ? 'c-good' : score >= 65 ? 'c-mid' : 'c-low'; return `<td class="${cls}"><a href="${pairUrl(a.k, b.k)}" title="${esc(a.n)} × ${esc(b.n)} 궁합 자세히">${score}</a></td>`; }).join('')}</tr>`).join('');
  const pickGrid = (id) => `<div class="pick-grid" id="${id}">${signs.map((x, i) => `<button class="pick-btn" type="button" data-i="${i}"><span class="e">${x.e}</span><span class="n">${esc(x.n)}</span></button>`).join('')}</div>`;
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
<details class="fold"><summary>12 × 12 궁합표 전체 보기</summary>
  <div class="month-wrap" style="overflow-x:auto;border-radius:0"><table class="compat-table"><thead><tr><th></th>${signs.map((s) => `<th title="${esc(s.n)}">${s.e}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">세로줄이 나, 가로줄이 상대입니다. 점수를 누르면 그 조합의 상세 설명으로 이동합니다. 점수는 두 별자리의 원소 관계와 황도상 각도를 합쳐 계산했습니다.</p>
</details>
<details class="fold"><summary>궁합은 무엇으로 정해지나요</summary>
  <div class="prose">
    <p>점성술에서 두 별자리의 궁합은 두 가지로 봅니다. 하나는 <b>원소</b>입니다. 불·땅·공기·물 네 원소 중 같은 원소끼리는 세상을 보는 방식이 비슷해 말이 잘 통하고, 불과 공기, 땅과 물은 서로를 북돋우는 짝으로 봅니다. 다른 하나는 <b>각도</b>입니다. 황도 12궁을 원으로 놓았을 때 몇 칸 떨어져 있는지에 따라 트라인(4칸, 가장 편안), 스퀘어(3칸, 긴장), 어포지션(정반대, 끌림과 충돌)으로 나눕니다.</p>
    <p>점수가 낮다고 맞지 않는 관계라는 뜻은 아닙니다. 긴장이 큰 조합이 서로를 가장 많이 성장시킨다고도 봅니다. 재미로 보시고 관계를 이해하는 참고 자료로만 쓰시기 바랍니다.</p>
    <p>원소와 모달리티, 지배 행성이 무엇인지는 <a href="/guide">별자리 기초</a>에 출처와 함께 정리해 두었습니다.</p>
  </div>
</details>
<section>
  <h2 class="sec-title">78개 조합 상세 해설</h2>
  <p class="sec-lead">조합마다 원소·모달리티·지배 행성 관계와 부딪히기 쉬운 지점, 대화 요령을 따로 정리했습니다.</p>
  ${ORDER.map((ka) => { const a = byKey.get(ka); return `<details class="fold"><summary>${a.e} ${esc(a.n)}의 궁합 ${12 - idxOf(ka)}개</summary><div class="sign-links">${ORDER.slice(idxOf(ka)).map((kb) => { const b = byKey.get(kb); return `<a class="sign-chip" href="${pairUrl(ka, kb)}"><span>${b.e}</span>${esc(a.n)} × ${esc(b.n)} ${pairScore(a, b).score}</a>`; }).join('')}</div></details>`; }).join('\n  ')}
</section>
<section>
  <h2 class="sec-title">별자리별 페이지</h2>
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip" href="${urlOf(x.k)}"><span>${x.e}</span>${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  const extraScript = `<script>
var __Z=${JSON.stringify(signs.map((x) => ({ e: x.e, n: x.n, k: x.k })))}, __M=${JSON.stringify(matrix)};
var my=-1, you=-1, __S={title:'별자리 궁합',url:'${SITE.url}/compatibility',img:'${SITE.ogImage}',desc:'내 별자리와 상대 별자리 궁합을 바로 확인해 보세요.'};
function pick(grid,i){ if(grid==='myGrid')my=i; else you=i; document.querySelectorAll('#'+grid+' .pick-btn').forEach(function(b,j){b.classList.toggle('active',j===i);}); document.getElementById('goBtn').disabled=!(my>=0&&you>=0); }
['myGrid','yourGrid'].forEach(function(g){ document.querySelectorAll('#'+g+' .pick-btn').forEach(function(b){ b.addEventListener('click',function(){pick(g,Number(b.dataset.i));}); }); });
function show(){ if(my<0||you<0)return; var a=__Z[my],b=__Z[you],m=__M[my][you];
  document.getElementById('rcPair').innerHTML=a.e+' '+a.n+' <span style="opacity:.5">×</span> '+b.e+' '+b.n;
  document.getElementById('rcScore').innerHTML=m[0]+'<small>점</small>';
  document.getElementById('rcAsp').textContent=m[1]+' · '+(m[0]>=88?'최상의 조합':m[0]>=78?'잘 맞는 조합':m[0]>=65?'노력하면 좋아지는 조합':'서로를 배우는 조합');
  document.getElementById('rcText').textContent=m[2];
  var o=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'], p=o.indexOf(a.k)<=o.indexOf(b.k)?a.k+'-'+b.k:b.k+'-'+a.k;
  document.getElementById('rcLinks').innerHTML='<a href="/compatibility/'+p+'">궁합 상세 해설</a><a href="/zodiac/'+a.k+'">'+a.n+' 자세히</a><a href="/zodiac/'+b.k+'">'+b.n+' 자세히</a>';
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
  return layout({ title: `별자리 궁합 — 내 별자리 × 상대 별자리 점수 바로 보기`, desc: '내 별자리와 상대 별자리를 고르면 원소와 각도로 계산한 궁합 점수와 해설을 바로 보여 드립니다. 12별자리 78개 조합.', path: '/compatibility', body, ld, extraScript });
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
    <p style="margin:0;color:#555">운세 내용이 이상하거나, 오탈자를 찾으셨거나, 화면이 깨질 때 편하게 보내주세요.</p>
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
function pairUrl(a, b) { return `/compatibility/${pairKey(a, b)}`; }
const crumbLd = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE.url + path })) });
const crumbHtml = (items) => `<nav class="crumb">${items.map(([name, path], i) => (i === items.length - 1 ? `<span>${esc(name)}</span>` : `<a href="${path}">${esc(name)}</a>`)).join(' › ')}</nav>`;
const fmtP = (p) => { const [s, e] = p.split('-').map((x) => x.split('.').map(Number)); return `${s[0]}월 ${s[1]}일 ~ ${e[0]}월 ${e[1]}일`; };
const verdict = (sc) => (sc >= 88 ? '최상의 조합' : sc >= 78 ? '잘 맞는 조합' : sc >= 65 ? '노력하면 좋아지는 조합' : '서로를 배우는 조합');
const srcLinks = (keys) => keys.map((k) => `<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].label)}</a>`).join(' · ');
const PAIRS = JSON.parse(readFileSync(join(root, 'data/compat-pairs.json'), 'utf8'));
const ingressHko = (() => { const p = join(root, 'data/sun-ingress-hko.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { years: {} }; })();
const ingress = (() => { const p = join(root, 'data/sun-ingress-kasi.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { years: {} }; })();

// ---------- 궁합 상세 ----------
function pagePair(a, b) {
  const same = a.k === b.k;
  const { asp, score } = pairScore(a, b);
  const d0 = Math.abs(idxOf(a.k) - idxOf(b.k)), dist = Math.min(d0, 12 - d0);
  const bonus = ELEM_PAIR(a.el, b.el);
  const path = pairUrl(a.k, b.k);
  const P = PAIRS[pairKey(a.k, b.k)];
  if (!P || !['love', 'friend', 'repair', 'tip'].every((x) => P[x])) { console.error(`✖ data/compat-pairs.json 에 ${pairKey(a.k, b.k)} 의 love·friend·repair·tip 이 없습니다`); process.exit(1); }
  const nm = same ? `${a.n}끼리` : `${a.n}와 ${b.n}`;
  const row = (label, f) => `<tr><th scope="row">${label}</th><td>${f(a)}</td>${same ? '' : `<td>${f(b)}</td>`}</tr>`;
  const shared = QUAL[a.el].filter((q) => QUAL[b.el].includes(q));
  const combo = [
    a.el === b.el ? `같은 ${a.el}` : `${a.el} × ${b.el}${shared.length ? ` (공유 성질: ${shared.join(', ')})` : ' (공유 성질 없음)'}`,
    MOD_OF[a.k] === MOD_OF[b.k] ? `같은 ${MOD_OF[a.k]}궁` : `${MOD_OF[a.k]}궁 × ${MOD_OF[b.k]}궁`,
    a.ruler === b.ruler ? `같은 ${a.ruler}` : `${a.ruler} × ${b.ruler}`,
  ];

  const body = `
${crumbHtml([['홈', '/'], ['별자리 궁합', '/compatibility'], [same ? `${a.n} × ${a.n}` : `${a.n} × ${b.n}`, path]])}
<article class="sign-page">
<header class="pair-hero">
  <div class="ph-signs"><a href="${urlOf(a.k)}">${a.e}</a>${same ? '' : `<span>×</span><a href="${urlOf(b.k)}">${b.e}</a>`}</div>
  <h1>${esc(nm)} 궁합</h1>
  <div class="ph-score">${score}<small>점</small></div>
  <p class="ph-asp">${esc(asp.name)} · ${esc(verdict(score))}</p>
</header>

<section>
  <h2 class="sec-title">한눈에 보기</h2>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th></th><th>${a.e} ${esc(a.n)}</th>${same ? '' : `<th>${b.e} ${esc(b.n)}</th>`}</tr></thead>
  <tbody>
  ${row('날짜', (s) => esc(fmtP(s.p)))}
  ${row('원소', (s) => esc(s.el))}
  ${row('모달리티', (s) => esc(MOD_NAME[MOD_OF[s.k]]))}
  ${row('지배 행성', (s) => esc(s.ruler) + (CLASSIC_RULER[s.k] ? ` <small>(전통: ${esc(CLASSIC_RULER[s.k])})</small>` : ''))}
  <tr><th scope="row">조합</th><td${same ? '' : ' colspan="2"'}>${esc(combo.join(' · '))} — <a href="/guide/elements#combos">원소</a>·<a href="/guide/modalities#combos">모달리티</a>·<a href="/guide/ruling-planets">지배 행성</a> 해석 보기</td></tr>
  </tbody></table></div>
  <p class="note">점수: ${same ? '같은 별자리(0°)' : `황도에서 ${dist * 30}° 떨어진`} ${esc(asp.name)}의 기본 점수 ${asp.score}점에 원소 보정 ${bonus > 0 ? '+' : ''}${bonus}점을 더하면 ${asp.score + bonus}점${asp.score + bonus > score ? `이고, 점수는 최대 ${score}점으로 표시합니다` : asp.score + bonus < score ? `이고, 점수는 최소 ${score}점으로 표시합니다` : '입니다'}. 계산 방식은 <a href="/compatibility">궁합표</a>와 같습니다.</p>
</section>

<section>
  <h2 class="sec-title">연애할 때</h2>
  <div class="prose"><p>${esc(P.love)}</p></div>
</section>

<section>
  <h2 class="sec-title">친구·동료일 때</h2>
  <div class="prose"><p>${esc(P.friend)}</p></div>
</section>

<section>
  <h2 class="sec-title">다툰 뒤 회복하는 법</h2>
  <div class="prose"><p>${esc(P.repair)}</p></div>
</section>

<section>
  <h2 class="sec-title">대화 팁</h2>
  <div class="tip-box"><p>${esc(P.tip)}</p></div>
</section>
${same ? (() => { const others = ORDER.filter((k) => k !== a.k).map((k) => ({ x: byKey.get(k), ...pairScore(a, byKey.get(k)) })).sort((p, q) => q.score - p.score); const li = (o) => `<li><a href="${pairUrl(a.k, o.x.k)}">${o.x.e} ${esc(o.x.n)}</a> ${o.score}점 · ${esc(o.asp.name)}</li>`; return `
<section>
  <h2 class="sec-title">${esc(a.n)}의 다른 조합과 비교</h2>
  <div class="two-col"><div class="list-box good"><h3>점수가 높은 조합</h3><ul>${others.slice(0, 3).map(li).join('')}</ul></div><div class="list-box bad"><h3>점수가 낮은 조합</h3><ul>${others.slice(-3).reverse().map(li).join('')}</ul></div></div>
</section>`; })() : ''}

<section>
  <h2 class="sec-title">${esc(a.n)}의 다른 궁합</h2>
  <div class="sign-links">${ORDER.filter((k) => k !== b.k || same).filter((k) => !(same && k === a.k)).map((k) => { const x = byKey.get(k); return `<a class="sign-chip" href="${pairUrl(a.k, k)}"><span>${x.e}</span>${esc(x.n)} ${pairScore(a, x).score}</a>`; }).join('')}</div>
  ${same ? '' : `<h3 class="sub-title">${esc(b.n)}의 다른 궁합</h3>
  <div class="sign-links">${ORDER.filter((k) => k !== a.k).map((k) => { const x = byKey.get(k); return `<a class="sign-chip" href="${pairUrl(b.k, k)}"><span>${x.e}</span>${esc(x.n)} ${pairScore(b, x).score}</a>`; }).join('')}</div>`}
</section>
<p class="note">궁합은 재미로 읽는 점성술 해석입니다. 분류 출처: ${srcLinks(['sign', 'element', 'domicile', 'aspect'])}</p>
</article>`;

  const title = same ? `${a.n}끼리 궁합 — ${score}점, 연애·친구·다툰 뒤` : `${a.n} ${b.n} 궁합 — ${score}점, 연애·친구·다툰 뒤`;
  const lead = String(P.love).split(/(?<=[.!?])\s+/)[0];
  const desc = `${same ? `${a.n}끼리` : `${a.n}와 ${b.n}`} 별자리 궁합 ${score}점(${asp.name}). ${lead}`.slice(0, 160);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, inLanguage: 'ko', mainEntityOfPage: SITE.url + path, image: SITE.ogImage, dateModified: CONTENT_UPDATED, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    crumbLd([['홈', '/'], ['별자리 궁합', '/compatibility'], [same ? `${a.n} × ${a.n}` : `${a.n} × ${b.n}`, path]]),
  ];
  return layout({ title, desc, path, body, ld });
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
  <div class="sign-emoji">${s.e}</div>
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
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip${x.k === s.k ? ' on' : ''}" href="${monthUrl(x.k, mo)}"><span>${x.e}</span>${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  const title = `${s.n} ${mo.m}월 운세 (${mo.y}) — 연애·일·돈 흐름`;
  const desc = `${mo.y}년 ${mo.m}월 ${s.n}(${fmtP(s.p)}) 운세. ${overview ? String(overview).split(/(?<=[.!?])\s+/)[0] + ' ' : ''}주차별 대표 문장과 날짜별 운세 ${rows.length}일치를 모았습니다.`.slice(0, 160);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, inLanguage: 'ko', mainEntityOfPage: SITE.url + path, image: SITE.ogImage, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    crumbLd([['홈', '/'], [s.n, urlOf(s.k)], [`${mo.y}년 ${mo.m}월`, path]]),
  ];
  return layout({ title, desc, path, body, ld, robots: mo.indexable ? 'index, follow' : 'noindex, follow' });
}

// ---------- 별자리 계산기 ----------
function pageCalculator() {
  const path = '/zodiac-calculator';
  const years = Object.keys(ingress.years || {}).sort();
  const I = Object.fromEntries(years.map((y) => [y, ingress.years[y].map((r) => [r.starts, r.kst])]));
  const ordered = ORDER.map((k) => byKey.get(k));
  const startTerm = (k) => (ingress.years?.[years[years.length - 1]] || []).find((r) => r.starts === k)?.term || '';
  const cell = (y, k) => { const r = (ingress.years[y] || []).find((x) => x.starts === k); return r ? `${Number(r.kst.slice(5, 7))}/${Number(r.kst.slice(8, 10))} ${r.kst.slice(11)}` : '—'; };
  const body = `
${crumbHtml([['홈', '/'], ['별자리 계산기', path]])}
<article class="sign-page">
<header class="home-hero" style="padding-top:20px"><h1>별자리 계산기</h1>
<p class="hero-sub">생년월일을 넣으면 태양 별자리를 알려 드립니다. 경계일에 태어났다면 태어난 해와 시각에 따라 달라지는지도 함께 안내합니다.</p></header>
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
  <tbody>${ordered.map((s) => `<tr><th scope="row">${s.e} <a href="${urlOf(s.k)}">${esc(s.n)}</a></th><td>${esc(fmtP(s.p))}</td><td>${esc(startTerm(s.k))}</td><td>${esc(s.el)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
${years.length ? `
<section>
  <h2 class="sec-title">경계 시각 자료 (${years[0]}~${years[years.length - 1]}년)</h2>
  <div class="prose"><p>한국천문연구원이 공개한 연도별 24절기 시각 가운데, 태양이 황경 30°의 배수를 지나는 12개 중기의 시각입니다. 이 기간에 태어났다면 계산기가 이 시각으로 경계일을 판정합니다. 표에서 같은 별자리의 시작일이 해마다 하루씩 앞뒤로 움직이는 것을 볼 수 있습니다.</p></div>
  <div class="tbl-wrap"><table class="data-table nowrap">
  <thead><tr><th>시작하는 별자리</th>${years.map((y) => `<th>${y}</th>`).join('')}</tr></thead>
  <tbody>${ordered.map((s) => `<tr><th scope="row">${esc(s.n)}</th>${years.map((y) => `<td>${cell(y, s.k)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <p class="note">시각은 한국 표준시(KST)입니다. ${esc(ingress.source?.note || '')} 해외에서 태어났다면 출생 시각을 한국 시각으로 바꿔 입력해 주세요.</p>
</section>
${Object.keys(ingressHko.years || {}).length ? (() => { const hy = Object.keys(ingressHko.years); return `
<section>
  <h2 class="sec-title">${hy[0]}~${hy[hy.length - 1]}년은 절기 날짜로 판정합니다</h2>
  <div class="prose"><p>분 단위 시각 자료가 없는 해는 <a href="${esc(ingressHko.source.url)}" target="_blank" rel="noopener">홍콩천문대의 양력-음력 대조표</a>에 실린 절기 날짜를 씁니다. 이 날짜는 홍콩 시각 기준이라 한국 시각으로는 같은 날이거나 다음 날입니다. 2021~2028년 구간에서 한국천문연구원 시각과 비교해 보면 96개 절기 가운데 91개는 날짜가 같고, 한국 시각 0시대에 든 5개는 한국 날짜가 하루 늦었습니다. 그래서 그 해의 절기 날짜와 다음 날, 이 두 날에 태어났다면 바뀌기 전과 후의 두 별자리 가운데 하나이며 어느 쪽인지는 태어난 시각에 따라 달라진다고 안내합니다. 그 밖의 날짜는 별자리 하나로 알려 드립니다. ${hy[0]}년보다 이른 해나 ${hy[hy.length - 1]}년보다 늦은 해는 일반 날짜 범위로 계산하고, 별자리 시작일 앞뒤 하루씩은 경계일로 안내합니다.</p></div>`; })() : ''}
</section>` : ''}

<section>
  <h2 class="sec-title">경계일에 태어났다면</h2>
  <div class="prose">
    <p>생일이 두 별자리의 경계에 걸쳐 있다면 계산 결과의 두 별자리 설명을 모두 읽어 보세요. 점성술에서는 이런 경우를 “커스프(cusp)”라고 부르기도 합니다. 정확한 판정에는 태어난 해와 시각, 그리고 태어난 곳의 시간대가 필요합니다.</p>
    <p>별자리를 알았다면 <a href="/guide/elements">원소</a>와 <a href="/guide/modalities">모달리티</a>, <a href="/guide/ruling-planets">지배 행성</a>으로 그 별자리가 어떻게 분류되는지 볼 수 있고, <a href="/compatibility">궁합</a>에서 다른 별자리와의 관계도 확인할 수 있습니다.</p>
  </div>
</section>
<p class="note">출처: ${srcLinks(['kasi', 'almanac', 'hko', 'terms24', 'sign'])}</p>
</article>`;
  const extraScript = `<script>
var Z=${JSON.stringify(signs.map((x) => ({ k: x.k, n: x.n, e: x.e, p: x.p, el: x.el, r: x.ruler })))}, I=${JSON.stringify(I)}, H=${JSON.stringify(ingressHko.years || {})}, MU='${curMonth.ym}', MM=${M};
function rng(p){var a=p.split('-'),s=a[0].split('.'),e=a[1].split('.');return {s:(+s[0])*100+(+s[1]),e:(+e[0])*100+(+e[1])};}
function byDate(m,d){var v=m*100+d;for(var i=0;i<Z.length;i++){var r=rng(Z[i].p);if(r.s<=r.e?(v>=r.s&&v<=r.e):(v>=r.s||v<=r.e))return Z[i];}return null;}
function byKey(k){for(var i=0;i<Z.length;i++)if(Z[i].k===k)return Z[i];return null;}
function pad(n){return (n<10?'0':'')+n;}
function card(z){return '<div class="rc-pair">'+z.e+' '+z.n+'</div><p class="rc-asp">'+z.p.replace('-',' ~ ')+' · '+z.el+'의 별자리 · 지배 행성 '+z.r+'</p>';}
function links(z){return '<div class="rc-links"><a href="/zodiac/'+z.k+'">'+z.n+' 페이지</a><a href="/zodiac/'+z.k+'/'+MU+'">'+MM+'월 운세</a><a href="/compatibility">궁합 보기</a></div>';}
function calc(){
  var y=parseInt(document.getElementById('cy').value,10), m=+document.getElementById('cm').value, d=+document.getElementById('cd').value, t=document.getElementById('ct').value, out=document.getElementById('calcOut');
  var maxD=[31,(!y||(y%4===0&&y%100!==0)||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
  if(d>maxD){out.innerHTML='<p class="rc-text">'+m+'월에는 '+d+'일이 없습니다. 날짜를 다시 확인해 주세요.</p>';out.classList.add('on');return;}
  var html='', z=byDate(m,d), list=y&&I[y];
  if(list){
    var ds=y+'-'+pad(m)+'-'+pad(d), cur=byKey('capricorn'), edge=null;
    for(var i=0;i<list.length;i++){var day=list[i][1].slice(0,10);if(day<ds)cur=byKey(list[i][0]);else if(day===ds){edge=list[i];break;}else break;}
    if(edge){var nz=byKey(edge[0]), hm=edge[1].slice(11);
      if(t){var after=t>=hm;z=after?nz:cur;html=card(z)+'<p class="rc-text">'+y+'년 '+m+'월 '+d+'일은 '+cur.n+'에서 '+nz.n+'로 바뀌는 날입니다. 한국천문연구원 자료로 이날 '+hm+'(한국 시각)에 바뀌므로, '+t+' 출생은 <b>'+z.n+'</b>입니다.</p>'+links(z);}
      else{html='<div class="rc-pair">'+cur.e+' '+cur.n+' 또는 '+nz.e+' '+nz.n+'</div><p class="rc-text">'+y+'년 '+m+'월 '+d+'일은 별자리가 바뀌는 날입니다. 한국천문연구원 자료로 이날 '+hm+'(한국 시각) 이전에 태어났다면 '+cur.n+', 이후라면 '+nz.n+'입니다. 태어난 시각을 넣으면 하나로 알려 드립니다.</p><div class="rc-links"><a href="/zodiac/'+cur.k+'">'+cur.n+' 페이지</a><a href="/zodiac/'+nz.k+'">'+nz.n+' 페이지</a></div>';}
    } else {z=cur;html=card(z)+'<p class="rc-text">'+y+'년 '+m+'월 '+d+'일에 태양은 '+z.n+' 구간에 있었습니다. 한국천문연구원의 '+y+'년 절기 시각으로 확인했습니다.</p>'+links(z);}
  } else if(y&&H[y]){
    // 홍콩천문대 절기 날짜(홍콩 시각, 날짜만). 한국 날짜로는 그날 또는 다음 날 바뀐다
    var birthMD=pad(m)+'-'+pad(d), cz=byKey('capricorn'), hit=null;
    for(var k=0;k<H[y].length;k++){var D=H[y][k][1], nextDate=new Date(y,+D.slice(0,2)-1,+D.slice(3)+1), D1=pad(nextDate.getMonth()+1)+'-'+pad(nextDate.getDate());
      if(birthMD<D)break; if(birthMD===D||birthMD===D1){hit=H[y][k];break;} cz=byKey(H[y][k][0]);}
    if(hit){var hz=byKey(hit[0]), hm=+hit[1].slice(0,2), hd=+hit[1].slice(3);
      html='<div class="rc-pair">'+cz.e+' '+cz.n+' 또는 '+hz.e+' '+hz.n+'</div><p class="rc-text">홍콩천문대 자료로 '+y+'년에는 '+hm+'월 '+hd+'일(홍콩 시각)에 '+cz.n+'에서 '+hz.n+'로 바뀝니다. 한국 시각으로는 그날이나 다음 날 바뀌므로, '+m+'월 '+d+'일에 태어났다면 태어난 시각에 따라 '+cz.n+' 또는 '+hz.n+'입니다. 분 단위 시각 자료는 '+Object.keys(I).join(', ')+'년만 있습니다.</p><div class="rc-links"><a href="/zodiac/'+cz.k+'">'+cz.n+' 페이지</a><a href="/zodiac/'+hz.k+'">'+hz.n+' 페이지</a></div>';}
    else{html=card(cz)+'<p class="rc-text">'+y+'년 '+m+'월 '+d+'일에 태양은 '+cz.n+' 구간에 있었습니다. 홍콩천문대의 '+y+'년 절기 날짜로 확인했습니다.</p>'+links(cz);}
  } else if(z){
    // Z 는 물병자리부터 황도 순서. 별자리 시작일 ±1일이면 경계 안내 — 시작일·다음날은 앞 별자리, 전날은 그 별자리와 경계
    var v=m*100+d, other=null;
    function shiftMD(base,off){var dt=new Date(2000,Math.floor(base/100)-1,base%100+off);return (dt.getMonth()+1)*100+dt.getDate();}
    for(var j=0;j<Z.length;j++){var s=rng(Z[j].p).s;
      if(v===s||v===shiftMD(s,1))other=Z[(j+11)%12]; else if(v===shiftMD(s,-1))other=Z[j];}
    html=card(z)+'<p class="rc-text">'+m+'월 '+d+'일은 일반 날짜 범위로 '+z.n+'입니다.</p>';
    if(other){
      html+='<p class="rc-text"><b>경계일 안내</b> — 이 날짜는 '+z.n+'와 '+other.n+'의 경계에 가깝습니다. 태어난 해와 시각에 따라 '+other.n+'일 수 있습니다.'+(y?' 입력하신 '+y+'년은 계산기에 절기 자료가 없어 일반 범위로 계산했습니다.':' 태어난 해를 넣으면 '+Object.keys(H)[0]+'~'+Object.keys(H).slice(-1)[0]+'년은 절기 날짜로 판정합니다.')+'</p>';}
    html+=links(z);
  }
  out.innerHTML=html; out.classList.add('on');
}
document.getElementById('calcBtn').addEventListener('click',calc);
</script>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: '별자리 계산기', url: SITE.url + path, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web Browser', inLanguage: 'ko', description: '생년월일로 태양 별자리를 찾고 경계일이면 절기 날짜·시각 자료로 판정하는 도구', offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' } },
    crumbLd([['홈', '/'], ['별자리 계산기', path]]),
  ];
  return layout({ title: '별자리 계산기 — 생년월일로 내 별자리 찾기 (경계일 판정)', desc: `생년월일을 넣으면 태양 별자리를 알려 드립니다. 1950~2030년생은 홍콩천문대 절기 날짜로, ${years[0] || ''}~${years[years.length - 1] || ''}년생은 한국천문연구원 절기 시각으로 경계일까지 판정합니다.`, path, body, ld, extraScript });
}

// ---------- 가이드 ----------
function pageGuide(g) {
  const crumbs = g.path === '/guide' ? [['홈', '/'], ['별자리 기초', '/guide']] : [['홈', '/'], ['별자리 기초', '/guide'], [g.name, g.path]];
  const body = `${crumbHtml(crumbs)}\n<article class="sign-page">${g.body}\n</article>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, inLanguage: 'ko', mainEntityOfPage: SITE.url + g.path, image: SITE.ogImage, dateModified: CONTENT_UPDATED, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } },
    crumbLd(crumbs),
  ];
  return layout({ title: g.title, desc: g.desc, path: g.path, body, ld });
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
    <p><b>별자리 페이지</b>(12장)에는 오늘의 총운·연애운·직장운·재물운, 성격의 강점과 주의할 점, 연애·일·돈을 대하는 방식, 잘 맞는 별자리와 부딪히기 쉬운 별자리, 그리스 신화 속 유래와 상징을 담았습니다.</p>
    <p><b>월별 운세</b>는 별자리마다 한 달 치 날짜별 운세를 모은 페이지입니다. 맨 위에는 그달 문장에 자주 나온 내용을 묶은 흐름 요약을, 그 아래에는 주마다 다른 날들과 내용이 가장 많이 겹치는 문장을 그대로 옮긴 주차별 대표 문장을 둡니다. 지난달 운세도 그대로 남겨 둡니다.</p>
    <p><b><a href="/compatibility">별자리 궁합</a></b>에서는 78개 조합의 점수와 조합별 상세 해설을, <b><a href="/zodiac-calculator">별자리 계산기</a></b>에서는 생년월일로 별자리를 찾을 수 있습니다. 원소·모달리티·지배 행성 같은 기본 개념은 <b><a href="/guide">별자리 기초</a></b>에 출처와 함께 정리했습니다.</p>
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
    <li>문장에 적힌 요일이 실제 달력의 요일과 맞는지, 반말 문장이 섞이지 않았는지 — 기준을 넘는 달은 월별 페이지를 검색에 노출하지 않습니다</li>
    <li>페이지마다 본문 분량이 충분한지, 화면에 채워지지 않은 빈 값이 그대로 드러나지 않는지, 사이트 안의 링크가 모두 열리는지</li>
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
  <div class="sign-links">${signs.map((x) => `<a class="sign-chip" href="${urlOf(x.k)}"><span>${x.e}</span>${esc(x.n)}</a>`).join('')}</div>
</section>
</article>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: '사이트 소개', url: SITE.url + '/about', inLanguage: 'ko', description: `${SITE.name} 소개와 운세 작성 방식, 이용 시 유의사항` },
    crumbLd([['홈', '/'], ['사이트 소개', '/about']])];
  return layout({ title: `사이트 소개 — 운세 작성 방식과 출처`, desc: `${SITE.name}가 어떤 사이트인지, 운세를 어떤 규칙과 검사를 거쳐 작성하는지(AI 도움·운영자 검토), 일정과 사실 정보의 출처, 문의처를 정리했습니다.`, path: '/about', body, ld });
}

// ---------- 실행 ----------
for (const s of signs) write(`zodiac/${s.k}/index.html`, pageSign(s));
write('index.html', pageHome());
write('compatibility.html', pageCompat());
write('about.html', pageAbout());
write('contact.html', pageContact());
months.forEach((mo, i) => { for (const s of signs) write(`zodiac/${s.k}/${mo.ym}/index.html`, pageMonth(s, mo, i)); });
for (let i = 0; i < 12; i++) for (let j = i; j < 12; j++) write(`compatibility/${ORDER[i]}-${ORDER[j]}/index.html`, pagePair(byKey.get(ORDER[i]), byKey.get(ORDER[j])));
write('zodiac-calculator/index.html', pageCalculator());
const guides = makeGuides({ signs, esc, urlOf, ingress, ELEM_PAIR, pairUrl });
for (const g of guides) write(`${g.path.slice(1)}/index.html`, pageGuide(g));

const urls = [
  { loc: '/', p: '1.0', f: 'daily', lm: TODAY },
  ...signs.map((s) => ({ loc: urlOf(s.k), p: '0.9', f: 'daily', lm: TODAY })),
  ...months.filter((mo) => mo.indexable).flatMap((mo) => signs.map((s) => ({ loc: monthUrl(s.k, mo), p: '0.6', f: 'monthly' }))),
  { loc: '/compatibility', p: '0.8', f: 'monthly', lm: TODAY },
  ...ORDER.flatMap((a, i) => ORDER.slice(i).map((b) => ({ loc: pairUrl(a, b), p: '0.5', f: 'yearly', lm: CONTENT_UPDATED }))),
  { loc: '/zodiac-calculator', p: '0.7', f: 'yearly', lm: CONTENT_UPDATED },
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
  }
  if (broken.size) fail(`깨진 내부 링크 ${broken.size}개:\n  ${[...broken].slice(0, 20).join('\n  ')}`);
  console.log(`  인라인 스크립트 ${checked}개 문법 검증 통과, 깨진 값·내부 링크 검사 통과 (${written.length}개 파일)`);
}

console.log(`✔ 빌드 완료 — 별자리 ${signs.length}장 + 홈, 월별 ${months.length * signs.length}장(${months.map((mo) => mo.ym + (mo.indexable ? '' : ' noindex')).join(', ')}), 궁합 상세 78장, 계산기 1장, 가이드 ${guides.length}장, sitemap ${urls.length}개 (기준일 ${TODAY})`);
console.log(`  HTML 본문 글자수: 홈 ${homeLen}자, 별자리 최소 ${minLen}자 (${minWho}), 새 페이지 최소 ${newMin}자 (${newMinWho})`);
if (minLen < 1500 || homeLen < 800 || newMin < 1500) { console.error('✖ 본문이 너무 짧습니다. 애드센스 재심사 전에 확인하세요.'); process.exit(1); }
