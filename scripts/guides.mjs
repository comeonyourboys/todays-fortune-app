// 별자리 기초 가이드 4장 + 허브. 사실 문장은 content.mjs 의 SRC 출처에 있는 내용만 쓴다.
import { SRC, MOD_OF, CLASSIC_RULER, QUAL, PLANET, ELEM_TEXT, MOD_TEXT } from './content.mjs';

const ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const ELEMS = ['불', '땅', '공기', '물'];

export const GUIDES = [
  { slug: 'what-is-zodiac', name: '황도 12궁이란', short: '황도 12궁의 유래, 천문 별자리와 점성술 별자리의 차이' },
  { slug: 'elements', name: '4원소', short: '불·땅·공기·물 네 원소의 기원과 별자리 배치' },
  { slug: 'modalities', name: '활동·고정·변통', short: '세 가지 모달리티와 계절의 관계' },
  { slug: 'ruling-planets', name: '지배 행성', short: '전통 지배 행성과 현대 지배 행성의 차이' },
];

export function makeGuides({ signs, esc, urlOf, ingress, ELEM_PAIR, pairUrl }) {
  const by = new Map(signs.map((s) => [s.k, s]));
  const ordered = ORDER.map((k) => by.get(k));
  const link = (k) => { const s = by.get(k); return `<a href="${urlOf(k)}">${esc(s.n)}</a>`; };
  const src = (...keys) => `<section class="sources"><h2 class="sec-title">출처</h2><ul>${keys.map((k) => `<li><a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].label)}</a></li>`).join('')}</ul></section>`;
  const ruler = (s) => s.ruler;
  const classic = (s) => CLASSIC_RULER[s.k] || s.ruler;
  const next = (slug) => `<section><h2 class="sec-title">다른 기초 설명</h2><div class="guide-cards">${GUIDES.filter((g) => g.slug !== slug).map((g) => `<a class="guide-card" href="/guide/${g.slug}"><b>${esc(g.name)}</b><span>${esc(g.short)}</span></a>`).join('')}<a class="guide-card" href="/zodiac-calculator"><b>별자리 계산기</b><span>생년월일로 내 별자리 찾기</span></a></div></section>`;
  const disclaimer = `<p class="note">점성술은 과학적으로 검증된 예측 방법이 아닙니다. 위의 성향 해석은 점성술 전통을 소개하는 것이며, 이 사이트의 운세와 궁합은 재미로 읽는 글입니다.</p>`;
  // 2026년 태양 황경 30° 배수 통과 시각(한국천문연구원) — 있으면 표에 쓴다
  const y26 = ingress?.years?.['2026'] || [];
  const at26 = (k) => { const r = y26.find((x) => x.starts === k); return r ? `${Number(r.kst.slice(5, 7))}월 ${Number(r.kst.slice(8, 10))}일 ${r.kst.slice(11)}` : '—'; };
  const termOf = (k) => (y26.find((x) => x.starts === k) || {}).term || '';

  const pages = [];

  // ---------- 허브 ----------
  pages.push({
    path: '/guide', name: '별자리 기초',
    title: '별자리 기초 — 원소·모달리티·지배 행성 한눈에 보기',
    desc: '12별자리의 날짜 범위와 원소, 활동·고정·변통 모달리티, 전통·현대 지배 행성을 한 표로 정리하고 각각의 뜻을 출처와 함께 설명합니다.',
    body: `
<header class="home-hero" style="padding-top:20px"><h1>별자리 기초</h1>
<p class="hero-sub">별자리 운세와 궁합에서 자주 나오는 말 — 원소, 모달리티, 지배 행성 — 을 출처와 함께 정리했습니다.</p></header>
<section>
  <h2 class="sec-title">12별자리 분류표</h2>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>별자리</th><th>날짜(일반 범위)</th><th>원소</th><th>모달리티</th><th>지배 행성<br><small>현대 / 전통</small></th></tr></thead>
  <tbody>${ordered.map((s) => `<tr><th scope="row">${s.e} ${link(s.k)}</th><td>${esc(s.p.replace('-', ' ~ '))}</td><td>${esc(s.el)}</td><td>${esc(MOD_OF[s.k])}</td><td>${esc(ruler(s))}${classic(s) !== ruler(s) ? ` / ${esc(classic(s))}` : ''}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="note">원소와 모달리티 분류는 Wikipedia “Astrological sign”, 전통 지배 행성은 “Domicile (astrology)”를 따랐습니다. 날짜 범위는 해마다 하루 정도 달라질 수 있어 <a href="/zodiac-calculator">별자리 계산기</a>에서 경계일 안내를 함께 보여 드립니다.</p>
</section>
<section>
  <h2 class="sec-title">주제별 설명</h2>
  <div class="guide-cards">${GUIDES.map((g) => `<a class="guide-card" href="/guide/${g.slug}"><b>${esc(g.name)}</b><span>${esc(g.short)}</span></a>`).join('')}<a class="guide-card" href="/zodiac-calculator"><b>별자리 계산기</b><span>생년월일로 내 별자리 찾기</span></a></div>
</section>
<section>
  <h2 class="sec-title">이 사이트는 이 분류를 어디에 쓰나요</h2>
  <div class="prose">
    <p><a href="/compatibility">별자리 궁합</a> 점수는 두 별자리가 황도에서 몇 칸 떨어져 있는지(각도)와 원소 조합으로 계산합니다. 각 <a href="/compatibility/aries-leo">궁합 상세 페이지</a>에서는 여기에 모달리티와 지배 행성의 조합을 더해 두 별자리가 어디서 잘 맞고 어디서 부딪히는지 설명합니다.</p>
    <p>별자리별 페이지의 성격 설명과 날짜별 운세도 이 분류를 바탕으로 썼습니다. 예를 들어 불의 원소이면서 활동궁인 양자리의 운세에는 시작과 추진에 관한 문장이 자주 나옵니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">자주 묻는 것</h2>
  <div class="prose">
    <p><b>원소와 모달리티가 같은 별자리가 있나요?</b> 없습니다. 원소 4개와 모달리티 3개를 곱하면 정확히 12가지 조합이 나오고, 12별자리가 하나씩 나눠 가집니다. 불이면서 활동궁인 별자리는 양자리 하나뿐입니다. 그래서 원소와 모달리티 두 가지만 알면 별자리를 하나로 특정할 수 있습니다.</p>
    <p><b>13번째 별자리가 있다는데요?</b> 천문학에서 황도는 뱀주인자리도 지나가지만, 점성술의 12궁은 황도를 30°씩 똑같이 나눈 구간이라 뱀주인자리가 들어갈 자리가 없습니다. 두 체계의 차이는 <a href="/guide/what-is-zodiac">황도 12궁이란</a>에서 자세히 설명합니다.</p>
    <p><b>지배 행성이 두 개인 별자리는요?</b> 망원경으로 새로 발견된 천왕성(1781년)·해왕성(1846년)·명왕성(1930년)이 근대 이후 점성술에서 각각 물병자리·물고기자리·전갈자리의 지배 행성으로 배정되면서, 이 세 별자리는 전통 지배 행성과 현대 지배 행성을 함께 갖게 됐습니다. 위 표에서 “현대 / 전통”으로 함께 적은 별자리입니다.</p>
    <p><b>날짜 범위가 사이트마다 하루씩 다른 이유는요?</b> 태양이 별자리 경계를 지나는 시각이 해마다 몇 시간씩 달라지기 때문입니다. 대표 범위를 어느 해 기준으로 잡느냐에 따라 표기가 하루 정도 갈립니다.</p>
  </div>
</section>
${disclaimer}
${src('sign', 'domicile', 'zodiacKo')}`,
  });

  // ---------- 황도 12궁 ----------
  pages.push({
    path: '/guide/what-is-zodiac', name: '황도 12궁이란',
    title: '황도 12궁이란 — 별자리의 유래와 천문 별자리와의 차이',
    desc: '황도 12궁은 기원전 바빌로니아 천문학에서 시작됐습니다. 12궁이 정해진 과정, 30°씩 나눈 점성술 별자리와 국제천문연맹(IAU) 별자리의 차이, 뱀주인자리와 세차운동을 출처와 함께 정리했습니다.',
    body: `
<header class="home-hero" style="padding-top:20px"><h1>황도 12궁이란</h1>
<p class="hero-sub">운세에서 말하는 “별자리”가 어디서 왔는지, 밤하늘의 실제 별자리와는 무엇이 다른지 정리했습니다.</p></header>
<section>
  <h2 class="sec-title">황도와 황도대</h2>
  <div class="prose">
    <p><b>황도</b>는 지구에서 볼 때 태양이 1년 동안 별들 사이를 지나가는 것처럼 보이는 길입니다. 이 길을 중심으로 남북으로 약 8~9°씩 펼쳐진 띠를 <b>황도대</b>(zodiac)라고 부르며, 달과 행성도 대부분 이 띠 안에서 움직입니다.</p>
    <p>점성술의 별자리, 정확히는 <b>태양 별자리</b>는 태어난 순간 태양이 황도 위 어느 구간에 있었는지를 가리킵니다. “나는 양자리”라는 말은 태어난 날 태양이 양자리 구간을 지나고 있었다는 뜻입니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">12궁은 바빌로니아에서 시작됐습니다</h2>
  <div class="prose">
    <p>황도를 12구간으로 나누는 방식은 기원전 1천년기 전반의 바빌로니아 천문학에서 비롯됐습니다. 바빌로니아 천문학자들은 30일짜리 열두 달에 빗대어 황도를 똑같은 크기의 12개 “궁”으로 나눴고, 이 체계가 도입된 시기는 페르시아 지배기인 기원전 409~398년 사이로 추정됩니다.</p>
    <p>이후 2세기 그리스의 프톨레마이오스가 『알마게스트』에서 황도대의 구성을 설명했고, 점성술서 『테트라비블로스』는 서양 점성술 전통의 토대가 됐습니다. 프톨레마이오스는 서양의 황도 12궁이 계절, 즉 춘분점을 기준으로 하는 좌표계라는 점을 분명히 했습니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">12궁은 모두 정확히 30°입니다</h2>
  <div class="prose"><p>점성술의 12궁은 춘분점(황경 0°)에서 시작해 30°씩 똑같이 나눈 구간입니다. 태양이 각 구간의 시작점을 지나는 순간은 24절기 가운데 12개의 “중기”와 정확히 겹칩니다. 아래 표의 시각은 한국천문연구원이 공개한 2026년 자료입니다.</p></div>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>별자리</th><th>황경</th><th>시작 절기</th><th>2026년 시작 시각</th></tr></thead>
  <tbody>${ordered.map((s, i) => `<tr><th scope="row">${s.e} ${link(s.k)}</th><td>${i * 30}° ~ ${i * 30 + 30}°</td><td>${esc(termOf(s.k))}</td><td>${esc(at26(s.k))}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="note">시각은 한국 표준시 기준입니다. 같은 절기라도 해마다 시각이 달라져 별자리 경계일이 하루 정도 앞뒤로 움직입니다. 내 생일이 경계에 걸리는지는 <a href="/zodiac-calculator">별자리 계산기</a>에서 확인할 수 있습니다.</p>
</section>
<section>
  <h2 class="sec-title">밤하늘의 별자리와는 다릅니다</h2>
  <div class="prose">
    <p>천문학의 별자리는 국제천문연맹(IAU)이 정한 88개 구역입니다. 경계는 벨기에의 천문학자 외젠 델포르트가 그었고, 1928년 IAU가 공식 채택해 1930년에 발표했습니다. 이 별자리들은 하늘에서 차지하는 폭이 제각각이라, 황도 위에서도 어떤 별자리는 넓고 어떤 별자리는 좁습니다.</p>
    <p>반면 점성술의 12궁은 모두 30°로 똑같습니다. 이름은 같은 별자리에서 따왔지만 서로 다른 체계이고, 점성술의 궁은 천문학 별자리의 경계를 정하는 데 쓰인 적이 없습니다. 이름도 조금 다릅니다. 점성술의 “사수자리”는 천문학에서 보통 “궁수자리”라고 부르는 별자리에서 이름을 땄습니다.</p>
    <p>또 황도는 실제로는 전갈자리와 궁수자리 사이에서 <b>뱀주인자리</b>를 지나갑니다. 태양은 해마다 11월 말부터 12월 중순 무렵까지 뱀주인자리 구역에 머무르지만, 전통적인 12궁 체계에는 뱀주인자리가 없습니다. 뉴스에서 가끔 보이는 “13번째 별자리” 이야기는 이 차이에서 나온 것입니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">세차운동 — 기준점이 조금씩 움직입니다</h2>
  <div class="prose">
    <p>지구의 자전축은 팽이처럼 천천히 돌며, 한 바퀴에 약 2만 6천 년이 걸립니다. 약 72년에 1°씩 춘분점이 별들 사이에서 거꾸로 이동하는 셈이고, 이 현상은 기원전 2세기의 히파르코스가 처음 발견한 것으로 알려져 있습니다.</p>
    <p>그래서 바빌로니아 시대와 지금은 같은 날짜에 태양이 지나는 천문 별자리가 다릅니다. 현재 점성술의 양자리 구간(춘분점부터 30°)은 천문학적으로는 대부분 물고기자리 안에 있습니다. 서양 점성술은 춘분점을 기준으로 하는 <b>트로피컬</b> 방식을, 인도 점성술은 실제 별을 기준으로 하는 <b>사이드리얼</b> 방식을 씁니다. 이 사이트는 서양 점성술의 트로피컬 방식을 따릅니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">점성술은 과학이 아닙니다</h2>
  <div class="prose">
    <p>과학계는 점성술을 유사과학으로 봅니다. 지금까지의 과학적 검증에서 별자리가 성격이나 미래를 설명하거나 예측한다는 근거는 확인되지 않았습니다. 이 사이트의 운세와 궁합은 그 점을 전제로, 하루를 돌아보는 읽을거리로 쓰고 있습니다.</p>
  </div>
</section>
${next('what-is-zodiac')}
${src('zodiacEn', 'zodiacKo', 'ecliptic', 'tetrabiblos', 'terms24', 'kasi', 'iau', 'ophiuchus', 'precession', 'sign', 'astrology')}`,
  });

  // ---------- 4원소 ----------
  const pairKeys = ['불-불', '땅-땅', '공기-공기', '물-물', '공기-불', '땅-물', '공기-물', '땅-불', '공기-땅', '물-불'];
  const shared = (a, b) => QUAL[a].filter((q) => QUAL[b].includes(q));
  pages.push({
    path: '/guide/elements', name: '4원소',
    title: '별자리 4원소 — 불·땅·공기·물 별자리와 원소 궁합',
    desc: '별자리의 4원소는 고대 그리스의 4원소설에서 왔습니다. 불·땅·공기·물에 속하는 별자리, 아리스토텔레스의 네 성질, 원소 조합에 따른 궁합 점수 보정을 정리했습니다.',
    body: `
<header class="home-hero" style="padding-top:20px"><h1>별자리 4원소</h1>
<p class="hero-sub">12별자리는 불·땅·공기·물 네 원소에 세 개씩 나뉩니다. 이 분류가 어디서 왔고 운세와 궁합에 어떻게 쓰이는지 정리했습니다.</p></header>
<section>
  <h2 class="sec-title">4원소설의 기원</h2>
  <div class="prose">
    <p>세상이 네 가지 근본 물질로 이루어졌다는 생각은 기원전 450년 무렵 그리스의 엠페도클레스가 처음 하나의 묶음으로 제시했습니다. 그는 불·공기·물·흙을 네 개의 “뿌리”라고 불렀습니다.</p>
    <p>아리스토텔레스는 여기에 뜨거움·차가움·습함·건조함이라는 네 성질을 두 개씩 짝지었습니다. 점성술의 원소 해석은 이 고전 원소론을 그대로 물려받았습니다.</p>
  </div>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>원소</th><th>성질(아리스토텔레스)</th><th>속한 별자리</th></tr></thead>
  <tbody>${ELEMS.map((el) => `<tr><th scope="row">${esc(el)}</th><td>${esc(QUAL[el].join(' · '))}</td><td>${ordered.filter((s) => s.el === el).map((s) => link(s.k)).join(', ')}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="note">점성술에서는 “흙” 대신 “땅”이라는 말을 주로 씁니다.</p>
</section>
<section>
  <h2 class="sec-title">원소마다 세 별자리, 세 모달리티</h2>
  <div class="prose">
    <p>한 원소에 속한 세 별자리를 트리플리시티(triplicity)라고 부릅니다. 세 별자리는 황도에서 정확히 120°씩 떨어져 정삼각형을 이루고, 각각 활동·고정·변통 가운데 서로 다른 모달리티를 하나씩 맡습니다. 그래서 같은 원소라도 시작하는 별자리, 지키는 별자리, 바꾸는 별자리로 성격이 갈립니다.</p>
  </div>
  <div class="elem-grid">${ELEMS.map((el) => `<div class="elem-box"><h3>${esc(el)}의 별자리</h3><div class="elem-signs">${ordered.filter((s) => s.el === el).map((s) => `<a href="${urlOf(s.k)}">${s.e} ${esc(s.n)} · ${esc(MOD_OF[s.k])}</a>`).join('')}</div><p>${ordered.filter((s) => s.el === el).map((s) => `${esc(s.n)}: ${esc(s.trait)}`).join(' / ')}</p></div>`).join('')}</div>
  <p class="note">각 별자리의 성향 문구는 이 사이트의 별자리 페이지 요약입니다.</p>
</section>
<section>
  <h2 class="sec-title">원소별 전통 해석</h2>
  <div class="prose">
    <p><b>불</b>은 열정과 자기표현, 행동으로 먼저 반응하는 기질로 해석합니다. 뜨겁고 건조한 성질처럼 빨리 붙고 밖으로 퍼집니다.</p>
    <p><b>땅</b>은 현실 감각과 꾸준함, 눈에 보이는 결과를 중시하는 기질로 해석합니다. 차갑고 건조한 성질처럼 쉽게 형태가 바뀌지 않습니다.</p>
    <p><b>공기</b>는 생각과 말, 사람 사이의 연결을 중시하는 기질로 해석합니다. 뜨겁고 습한 성질처럼 퍼져 나가며 섞입니다.</p>
    <p><b>물</b>은 감정과 공감, 직관으로 먼저 반응하는 기질로 해석합니다. 차갑고 습한 성질처럼 담긴 그릇에 따라 모양을 바꿉니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">원소 조합과 궁합 점수</h2>
  <div class="prose"><p>이 사이트의 <a href="/compatibility">궁합 점수</a>는 황도상 각도로 정한 기본 점수에 아래 원소 보정을 더해 계산합니다. 같은 원소, 그리고 불·공기와 땅·물은 서로 돕는 짝으로 보아 점수를 더하고, 나머지 조합은 점수를 뺍니다.</p>
  <p>보정값은 공유하는 성질의 개수로 계산한 것이 아닙니다. 점성술에서 흔히 쓰는 “같은 원소·서로 돕는 원소·그 밖의 원소” 구분을 따른 이 사이트의 기준이라, 성질을 하나 공유하는 공기·물(−6점)이 공유하는 성질이 없는 공기·땅(−4점)보다 낮게 매겨지기도 합니다. 표의 “공유하는 성질”은 고전 원소론의 분류를 참고로 함께 보여 드리는 것입니다.</p></div>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>원소 조합</th><th>점수 보정</th><th>공유하는 성질</th><th>예시</th></tr></thead>
  <tbody>${pairKeys.map((key) => { const [a, b] = key.split('-'); const v = ELEM_PAIR(a, b); const sa = ordered.find((s) => s.el === a); const sb = ordered.find((s) => s.el === b && s.k !== sa.k); const sh = shared(a, b); return `<tr><th scope="row">${esc(a)} × ${esc(b)}</th><td>${v > 0 ? '+' : ''}${v}</td><td>${a === b ? '두 성질 모두' : sh.length ? esc(sh.join(', ')) : '없음'}</td><td><a href="${pairUrl(sa.k, sb.k)}">${esc(sa.n)} × ${esc(sb.n)}</a></td></tr>`; }).join('')}</tbody>
  </table></div>
</section>
<section id="combos">
  <h2 class="sec-title">원소 조합별 전통 해석</h2>
  <div class="prose"><p>점성술에서 두 별자리의 원소 조합을 어떻게 읽는지 정리했습니다. 각 조합의 대표 궁합 페이지에서 별자리 쌍마다 다른 장면과 대화 요령을 볼 수 있습니다.</p></div>
  <ul class="fact-list">${pairKeys.map((key) => { const [a, b] = key.split('-'); return `<li><b>${esc(a)} × ${esc(b)}</b> — ${esc(ELEM_TEXT[key].rel)}</li>`; }).join('')}</ul>
</section>
${disclaimer}
${next('elements')}
${src('element', 'triplicity', 'sign')}`,
  });

  // ---------- 모달리티 ----------
  const seasons = [['봄', 'aries', 'taurus', 'gemini'], ['여름', 'cancer', 'leo', 'virgo'], ['가을', 'libra', 'scorpio', 'sagittarius'], ['겨울', 'capricorn', 'aquarius', 'pisces']];
  pages.push({
    path: '/guide/modalities', name: '활동·고정·변통',
    title: '별자리 모달리티 — 활동궁·고정궁·변통궁의 뜻과 계절',
    desc: '별자리의 세 모달리티(활동·고정·변통)는 계절 안에서의 위치로 정해집니다. 춘분·하지·추분·동지에 시작하는 활동궁부터 각 모달리티의 별자리와 궁합에서의 의미를 정리했습니다.',
    body: `
<header class="home-hero" style="padding-top:20px"><h1>활동궁 · 고정궁 · 변통궁</h1>
<p class="hero-sub">원소가 “무엇으로 반응하는지”를 말한다면, 모달리티는 “어떤 방식으로 움직이는지”를 말합니다.</p></header>
<section>
  <h2 class="sec-title">모달리티는 계절 속 위치입니다</h2>
  <div class="prose">
    <p>12별자리는 원소와 별개로 활동(카디널)·고정(픽스드)·변통(뮤터블) 세 모달리티에 네 개씩 나뉩니다. 네 개씩 묶인 이 무리를 콰드루플리시티(quadruplicity)라고 부릅니다.</p>
    <p>모달리티는 그 별자리가 계절의 어느 지점에 놓였는지로 정해집니다. 북반구 기준으로 각 계절의 첫 달이 활동궁, 한가운데 달이 고정궁, 마지막 달이 변통궁입니다. 예를 들어 양자리는 북반구 봄의 첫 달에 놓여 활동궁이 됩니다.</p>
  </div>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>계절</th><th>활동궁<br><small>계절의 시작</small></th><th>고정궁<br><small>한가운데</small></th><th>변통궁<br><small>끝무렵</small></th></tr></thead>
  <tbody>${seasons.map(([n, c, f, m]) => `<tr><th scope="row">${n}</th><td>${link(c)}</td><td>${link(f)}</td><td>${link(m)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
<section>
  <h2 class="sec-title">활동궁은 춘분·하지·추분·동지에 시작합니다</h2>
  <div class="prose"><p>네 활동궁의 시작점은 황경 0°·90°·180°·270°로, 각각 춘분·하지·추분·동지와 같은 순간입니다. 한국천문연구원 자료로 본 2026년의 시각은 다음과 같습니다.</p></div>
  <ul class="fact-list">${['aries', 'cancer', 'libra', 'capricorn'].map((k) => `<li>${link(k)} — ${esc(termOf(k))}, ${esc(at26(k))}</li>`).join('')}</ul>
  <p class="note">남반구에서는 계절이 반대지만 별자리의 모달리티 이름은 그대로 씁니다.</p>
</section>
<section>
  <h2 class="sec-title">세 모달리티의 전통 해석</h2>
  <div class="prose">
    <p><b>활동궁</b>(${['aries', 'cancer', 'libra', 'capricorn'].map((k) => esc(by.get(k).n)).join('·')})은 계절을 여는 자리라 일을 시작하고 방향을 정하는 힘으로 해석합니다. 주도권을 쥐려는 성향이 강하고, 새 출발 앞에서 가장 활기를 띱니다.</p>
    <p><b>고정궁</b>(${['taurus', 'leo', 'scorpio', 'aquarius'].map((k) => esc(by.get(k).n)).join('·')})은 계절이 무르익는 자리라 이미 시작된 것을 지키고 끝까지 밀고 가는 힘으로 해석합니다. 한번 정한 마음이 잘 바뀌지 않는 대신 꾸준합니다.</p>
    <p><b>변통궁</b>(${['gemini', 'virgo', 'sagittarius', 'pisces'].map((k) => esc(by.get(k).n)).join('·')})은 다음 계절로 넘어가는 자리라 상황에 맞춰 바꾸고 조정하는 힘으로 해석합니다. 적응이 빠른 대신 결정이 흔들리기 쉽습니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">궁합에서 모달리티가 중요한 이유</h2>
  <div class="prose">
    <p>같은 모달리티의 별자리는 황도에서 서로 3칸(90°) 또는 6칸(180°) 떨어져 있습니다. 점성술에서 90°는 <b>스퀘어</b>, 180°는 <b>어포지션</b>이라 부르는 긴장의 각도입니다. 같은 방식으로 움직이는 둘이 서로 다른 원소를 가졌기 때문에 정면으로 부딪히기 쉽다고 해석합니다.</p>
    <p>반대로 120° 떨어진 <b>트라인</b>은 언제나 같은 원소이면서 모달리티가 서로 다른 조합입니다. 이 사이트의 궁합 점수가 트라인에서 가장 높게 나오는 이유이기도 합니다. 예시: <a href="${pairUrl('aries', 'cancer')}">양자리 × 게자리</a>(같은 활동궁, 스퀘어), <a href="${pairUrl('taurus', 'scorpio')}">황소자리 × 전갈자리</a>(같은 고정궁, 어포지션), <a href="${pairUrl('gemini', 'libra')}">쌍둥이자리 × 천칭자리</a>(같은 공기, 트라인).</p>
  </div>
</section>
<section id="combos">
  <h2 class="sec-title">모달리티 조합별 해석</h2>
  <ul class="fact-list">${['활동-활동', '고정-고정', '변통-변통', '활동-고정', '활동-변통', '고정-변통'].map((k) => { const [a, b] = k.split('-'); return `<li><b>${a}궁 × ${b}궁</b> — ${esc(MOD_TEXT[k].rel)}</li>`; }).join('')}</ul>
</section>
${disclaimer}
${next('modalities')}
${src('sign', 'aspect', 'kasi', 'terms24')}`,
  });

  // ---------- 지배 행성 ----------
  const planetsUsed = [...new Set(ordered.flatMap((s) => [ruler(s), classic(s)]))];
  pages.push({
    path: '/guide/ruling-planets', name: '지배 행성',
    title: '별자리 지배 행성 — 전통 지배 행성과 현대 지배 행성의 차이',
    desc: '별자리마다 정해진 지배 행성을 정리했습니다. 맨눈으로 보이는 일곱 천체로 정한 전통 체계와, 천왕성·해왕성·명왕성 발견 뒤 바뀐 현대 체계의 차이를 출처와 함께 설명합니다.',
    body: `
<header class="home-hero" style="padding-top:20px"><h1>별자리 지배 행성</h1>
<p class="hero-sub">점성술에서는 별자리마다 그 별자리를 “다스리는” 행성이 하나씩 정해져 있습니다.</p></header>
<section>
  <h2 class="sec-title">전통 체계 — 맨눈으로 보이는 일곱 천체</h2>
  <div class="prose">
    <p>고대 점성술은 맨눈으로 볼 수 있는 일곱 천체, 곧 태양·달·수성·금성·화성·목성·토성만 알고 있었습니다. 그래서 전통 체계에서는 태양과 달이 사자자리와 게자리를 하나씩 맡고, 나머지 다섯 행성이 각각 두 별자리를 맡습니다. 이렇게 별자리와 행성을 짝짓는 개념을 영어로 도미사일(domicile)이라고 부릅니다.</p>
  </div>
</section>
<section>
  <h2 class="sec-title">현대 체계 — 새로 발견된 세 행성</h2>
  <div class="prose">
    <p>1781년 윌리엄 허셜이 천왕성을, 1846년에는 해왕성을 발견했고, 1930년 클라이드 톰보가 명왕성을 발견했습니다. 이 행성들이 발견된 뒤 근대 이후의 점성술은 세 천체를 각각 물병자리(천왕성), 물고기자리(해왕성), 전갈자리(명왕성)의 지배 행성으로 새로 배정했습니다. 명왕성은 그중 가장 나중에 전갈자리에 배정됐습니다. 그 결과 세 별자리는 전통 지배 행성(토성·목성·화성)과 현대 지배 행성을 함께 갖게 됐습니다.</p>
    <p>명왕성은 2006년 국제천문연맹(IAU)이 행성 정의를 정하면서 왜행성으로 분류가 바뀌었지만, 점성술에서는 지금도 전갈자리의 현대 지배 행성으로 씁니다. 이 사이트의 별자리 페이지는 현대 지배 행성을 기준으로 표기합니다.</p>
  </div>
  <div class="tbl-wrap"><table class="data-table">
  <thead><tr><th>별자리</th><th>현대 지배 행성</th><th>전통 지배 행성</th><th>같은 행성을 쓰는 별자리</th></tr></thead>
  <tbody>${ordered.map((s) => { const same = ordered.filter((x) => x.k !== s.k && ruler(x) === ruler(s)); return `<tr><th scope="row">${s.e} ${link(s.k)}</th><td>${esc(ruler(s))}</td><td>${esc(classic(s))}${classic(s) !== ruler(s) ? ' <small>(다름)</small>' : ''}</td><td>${same.length ? same.map((x) => link(x.k)).join(', ') : '—'}</td></tr>`; }).join('')}</tbody>
  </table></div>
</section>
<section>
  <h2 class="sec-title">행성별 전통적 상징</h2>
  <div class="prose"><p>점성술은 각 행성에 고유한 상징을 붙여 그 행성이 지배하는 별자리의 성향을 설명합니다. 아래는 그 전통적 상징을 짧게 요약한 것입니다.</p></div>
  <ul class="fact-list">${planetsUsed.map((p) => { const both = ordered.filter((s) => ruler(s) === p && classic(s) === p); const modOnly = ordered.filter((s) => ruler(s) === p && classic(s) !== p); const clOnly = ordered.filter((s) => classic(s) === p && ruler(s) !== p); const parts = [both.length ? `전통·현대 모두 ${both.map((s) => link(s.k)).join(', ')}` : '', modOnly.length ? `현대 체계에서 ${modOnly.map((s) => link(s.k)).join(', ')}` : '', clOnly.length ? `전통 체계에서 ${clOnly.map((s) => link(s.k)).join(', ')}` : ''].filter(Boolean); return `<li><b>${esc(p)}</b> — ${esc(PLANET[p])}. 지배하는 별자리: ${parts.join(' / ')}</li>`; }).join('')}</ul>
</section>
<section>
  <h2 class="sec-title">궁합에서 지배 행성 읽기</h2>
  <div class="prose">
    <p>두 별자리의 지배 행성이 같으면 그 행성이 상징하는 영역에서 기준이 비슷하다고 해석합니다. 금성을 함께 쓰는 <a href="${pairUrl('taurus', 'libra')}">황소자리와 천칭자리</a>, 수성을 함께 쓰는 <a href="${pairUrl('gemini', 'virgo')}">쌍둥이자리와 처녀자리</a>가 그런 예입니다. 원소가 달라 같은 행성의 상징이 다르게 드러난다는 점도 함께 봅니다.</p>
    <p>전통 체계로 보면 짝이 하나 더 생깁니다. 전갈자리는 양자리와 화성을, 물병자리는 염소자리와 토성을, 물고기자리는 사수자리와 목성을 공유합니다.</p>
  </div>
</section>
${disclaimer}
${next('ruling-planets')}
${src('domicile', 'planets', 'uranus', 'neptune', 'pluto', 'tetrabiblos')}`,
  });

  return pages;
}

