// 궁합 상세·가이드 페이지에 쓰는 본문 사전.
// 사실(분류·연도·정의)은 SRC 의 공개 출처에 있는 내용만 쓴다. 해석 문장은 점성술 전통 해석을 옮긴 것이며
// 페이지마다 "재미로 읽는 글" 안내를 함께 낸다.

export const SRC = {
  zodiacEn: { label: 'Wikipedia — Zodiac', url: 'https://en.wikipedia.org/wiki/Zodiac' },
  zodiacKo: { label: '위키백과 — 황도 12궁', url: 'https://ko.wikipedia.org/wiki/황도_12궁' },
  ecliptic: { label: '위키백과 — 황도', url: 'https://ko.wikipedia.org/wiki/황도' },
  sign: { label: 'Wikipedia — Astrological sign', url: 'https://en.wikipedia.org/wiki/Astrological_sign' },
  triplicity: { label: 'Wikipedia — Triplicity', url: 'https://en.wikipedia.org/wiki/Triplicity' },
  element: { label: 'Wikipedia — Classical element', url: 'https://en.wikipedia.org/wiki/Classical_element' },
  domicile: { label: 'Wikipedia — Domicile (astrology)', url: 'https://en.wikipedia.org/wiki/Domicile_(astrology)' },
  planets: { label: 'Wikipedia — Planets in astrology', url: 'https://en.wikipedia.org/wiki/Planets_in_astrology' },
  aspect: { label: 'Wikipedia — Astrological aspect', url: 'https://en.wikipedia.org/wiki/Astrological_aspect' },
  tetrabiblos: { label: 'Wikipedia — Tetrabiblos', url: 'https://en.wikipedia.org/wiki/Tetrabiblos' },
  precession: { label: 'Wikipedia — Axial precession', url: 'https://en.wikipedia.org/wiki/Axial_precession' },
  iau: { label: 'Wikipedia — IAU designated constellations', url: 'https://en.wikipedia.org/wiki/IAU_designated_constellations' },
  ophiuchus: { label: '위키백과 — 뱀주인자리', url: 'https://ko.wikipedia.org/wiki/뱀주인자리' },
  astrology: { label: '위키백과 — 점성술', url: 'https://ko.wikipedia.org/wiki/점성술' },
  uranus: { label: '위키백과 — 천왕성', url: 'https://ko.wikipedia.org/wiki/천왕성' },
  neptune: { label: '위키백과 — 해왕성', url: 'https://ko.wikipedia.org/wiki/해왕성' },
  pluto: { label: '위키백과 — 명왕성', url: 'https://ko.wikipedia.org/wiki/명왕성' },
  terms24: { label: '위키백과 — 24절기', url: 'https://ko.wikipedia.org/wiki/24절기' },
  kasi: { label: '한국천문연구원 — 연도별 달력자료(24절기)', url: 'https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026' },
  almanac: { label: '한국천문연구원 — 월력요항', url: 'https://astro.kasi.re.kr/kor/life/post/almanac' },
  hko: { label: '홍콩천문대 — 양력-음력 대조표(절기 날짜)', url: 'https://www.hko.gov.hk/en/gts/time/conversion.htm' },
  astroEngine: { label: 'Astronomy Engine (MIT, cosinekitty)', url: 'https://github.com/cosinekitty/astronomy' },
  tzKorea: { label: 'Wikipedia — Time in South Korea', url: 'https://en.wikipedia.org/wiki/Time_in_South_Korea' },
};

// 모달리티(Quadruplicity) — Wikipedia "Astrological sign" 의 분류
export const MOD_OF = {
  aries: '활동', cancer: '활동', libra: '활동', capricorn: '활동',
  taurus: '고정', leo: '고정', scorpio: '고정', aquarius: '고정',
  gemini: '변통', virgo: '변통', sagittarius: '변통', pisces: '변통',
};
export const MOD_NAME = { 활동: '활동궁(카디널)', 고정: '고정궁(픽스드)', 변통: '변통궁(뮤터블)' };
// 전통(고전) 지배 행성 — 천왕성·해왕성·명왕성 발견 이전 체계. 현대 지배 행성은 data/signs.json 의 ruler
export const CLASSIC_RULER = { scorpio: '화성', aquarius: '토성', pisces: '목성' };
// 고전 원소론(아리스토텔레스)의 두 성질 — Wikipedia "Classical element"
export const QUAL = { 불: ['뜨거움', '건조함'], 공기: ['뜨거움', '습함'], 물: ['차가움', '습함'], 땅: ['차가움', '건조함'] };
// 점성술에서 각 행성에 붙이는 전통적 상징 — Wikipedia "Planets in astrology" 요약
export const PLANET = {
  태양: '자아와 자기표현', 달: '감정과 습관', 수성: '소통과 사고', 금성: '조화와 애정', 화성: '행동과 투지',
  목성: '성장과 확장', 토성: '책임과 규율', 천왕성: '독창성과 변화', 해왕성: '이상과 상상', 명왕성: '변형과 집중',
};

// 원소 조합(정렬 키) → 관계 설명(여러 궁합 페이지가 공유하는 분류 설명). 조합마다 다른 설명은 data/compat-pairs.json. 점수 보정값은 build.mjs 의 ELEM_PAIR 와 같다.
export const ELEM_TEXT = {
  '불-불': {
    rel: '불의 원소는 점성술에서 열정·자기표현·행동력과 묶입니다. 같은 원소끼리는 반응 속도와 감정 표현의 온도가 비슷해 서로를 길게 설명할 필요가 적습니다.',
  },
  '땅-땅': {
    rel: '땅의 원소는 점성술에서 현실 감각·안정·실용과 묶입니다. 약속과 일정, 돈을 다루는 기본값이 비슷해 생활 리듬을 맞추는 데 드는 힘이 적습니다.',
  },
  '공기-공기': {
    rel: '공기의 원소는 점성술에서 생각·소통·관계와 묶입니다. 대화의 속도와 관심사의 폭이 비슷해 이야깃거리가 쉽게 떨어지지 않습니다.',
  },
  '물-물': {
    rel: '물의 원소는 점성술에서 감정·공감·직관과 묶입니다. 말하지 않은 기분을 읽는 감각이 비슷해 정서적인 안정감이 큽니다.',
  },
  '공기-불': {
    rel: '불과 공기는 점성술에서 서로를 북돋우는 짝으로 봅니다. 불이 공기를 만나 더 크게 타오르듯, 공기 쪽의 생각이 불 쪽의 행동에 불을 붙이는 관계로 설명합니다.',
  },
  '땅-물': {
    rel: '땅과 물은 점성술에서 서로를 키우는 짝으로 봅니다. 물이 땅을 적셔 무언가를 자라게 하듯, 물 쪽의 감정과 땅 쪽의 현실 감각이 서로를 보완하는 관계로 설명합니다.',
  },
  '공기-물': {
    rel: '공기와 물은 점성술에서 세상을 받아들이는 통로가 다른 짝으로 봅니다. 공기는 생각으로, 물은 감정으로 먼저 반응한다고 해석하며, 이 사이트의 궁합 점수에서도 이 조합에는 6점을 뺍니다.',
  },
  '땅-불': {
    rel: '땅과 불은 점성술에서 속도가 다른 짝으로 봅니다. 불은 지금 움직이려 하고 땅은 확인한 뒤 움직이려 한다고 해석하며, 이 사이트의 궁합 점수에서도 이 조합에는 6점을 뺍니다.',
  },
  '공기-땅': {
    rel: '공기와 땅은 점성술에서 관심의 방향이 다른 짝으로 봅니다. 공기는 가능성을, 땅은 검증된 현실을 먼저 본다고 해석하며, 이 사이트의 궁합 점수에서는 이 조합에 4점을 뺍니다.',
  },
  '물-불': {
    rel: '불과 물은 점성술에서 가장 대조적인 짝으로 봅니다. 불은 밖으로 드러내고 물은 안으로 품는다고 해석하며, 이 사이트의 궁합 점수에서도 가장 큰 8점을 빼는 원소 조합입니다.',
  },
};

// 모달리티 조합(활동·고정·변통 순 정렬 키)
export const MOD_TEXT = {
  '활동-활동': {
    rel: '두 별자리 모두 활동궁입니다. 활동궁은 계절이 시작되는 달에 놓인 별자리로, 일을 시작하고 방향을 정하는 성향과 연결됩니다.',
  },
  '고정-고정': {
    rel: '두 별자리 모두 고정궁입니다. 고정궁은 계절 한가운데 달에 놓인 별자리로, 한번 정한 것을 유지하고 지켜 내는 성향과 연결됩니다.',
  },
  '변통-변통': {
    rel: '두 별자리 모두 변통궁입니다. 변통궁은 계절이 끝나 가는 달에 놓인 별자리로, 상황에 맞춰 바꾸고 조정하는 성향과 연결됩니다.',
  },
  '활동-고정': {
    rel: '한쪽은 활동궁, 한쪽은 고정궁입니다. 계절로 치면 첫 달과 한가운데 달의 관계로, 시작하는 쪽과 지켜 내는 쪽의 조합입니다.',
  },
  '활동-변통': {
    rel: '한쪽은 활동궁, 한쪽은 변통궁입니다. 계절로 치면 첫 달과 마지막 달의 관계로, 방향을 정하는 쪽과 그 방향에 맞춰 조정하는 쪽의 조합입니다.',
  },
  '고정-변통': {
    rel: '한쪽은 고정궁, 한쪽은 변통궁입니다. 계절로 치면 한가운데 달과 마지막 달의 관계로, 지키는 쪽과 바꾸는 쪽의 조합입니다.',
  },
};

// 받침 유무로 조사 고르기
export const josa = (w, pair) => {
  const c = String(w).charCodeAt(String(w).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  const [a, b] = { 은는: ['은', '는'], 이가: ['이', '가'], 을를: ['을', '를'], 과와: ['과', '와'], 으로로: ['으로', '로'] }[pair];
  if (pair === '으로로' && has && (c - 0xac00) % 28 === 8) return w + b; // ㄹ 받침 + 로
  return w + (has ? a : b);
};
