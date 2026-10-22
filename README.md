# 🔮 오늘의 운세 — Daily Fortune

매일 업데이트되는 12별자리 맞춤 운세 서비스.

👉 **[사이트 바로가기](https://todays-fortune-app.vercel.app/)**

## 특징

- 🎯 **별자리별 맞춤 운세** — 12별자리 성격(원소/수호성) 기반, 총운·연애·직장·재물
- 😈 **독설 유머** — 신랄하지만 공감되는 톤
- 📊 **점수 시스템** — 연애/재물/직장/건강 점수 + 어제 대비 변화
- 🔮 **오늘의 키워드** — 행운의 색, 음식, 궁합 별자리
- 💬 **카카오톡 공유**
- 📅 **매일 자동 변경**

## 기술 스택

- HTML + CSS + Vanilla JS
- Pretendard + Outfit 폰트
- Vercel 배포 (무료)
- 운세 데이터: 월별 JSON (별자리별 직접 작성)

## 수익화

- Google AdSense
- 쿠팡 파트너스

## 파일 구조

```
├── index.html, about.html, compatibility.html, contact.html   # 빌드 산출물
├── zodiac/<별자리>/index.html              # 별자리 페이지 (매일 재생성)
├── zodiac/<별자리>/<YYYY-MM>/index.html    # 월별 운세 (이번 달·다음 달만, noindex)
├── compatibility/<a>/index.html            # 별자리별 궁합 12장 (상대 별자리 섹션 id=<b>)
├── zodiac-calculator/, guide/...           # 별자리 계산기·기초 설명
├── zodiac-calculator/boundaries/          # 연도별 별자리 경계 시각표 (1950~2030)
├── tools/sun-ingress/                      # 경계 시각 생성기 (astronomy-engine 2.1.19 고정) → data/sun-ingress-calc.json
├── data/
│   ├── fortune-YYYY-MM.json   # 월별 운세 (별자리 × 날짜 × 총운·연애·일·돈)
│   ├── monthly-overview-YYYY-MM.json # 월별 페이지 상단 흐름 요약 (그달 문장 근거)
│   ├── calendar-YYYY-MM.json  # 그달 운세에 반영한 일정 + 출처 (있는 달만)
│   ├── compat-pairs.json      # 궁합 78쌍 고유 설명
│   ├── constellations.json    # 별자리 페이지 "실제 하늘의" 단락 자료 (필드마다 출처 키, 출처 없으면 빌드가 출력 안 함)
│   ├── sun-passage-iau.json   # 태양의 IAU 별자리 통과 기간 (tools/sun-ingress/passage.mjs 생성)
│   ├── sun-ingress-kasi.json  # 한국천문연구원 12중기 시각 2021~2028 (계산기 경계일 판정)
│   ├── sun-ingress-hko.json   # 홍콩천문대 12중기 날짜 1950~2030 (시각 없음, 홍콩 시각)
│   └── signs.json, profiles-*.json
├── scripts/build.mjs, content.mjs, guides.mjs
└── sitemap.xml
```

## 빌드

`node scripts/build.mjs [YYYY-MM-DD]` — GitHub Action 이 매일 00:10 KST 에 실행합니다.

- 운세 데이터 파일은 `data/fortune-YYYY-MM.json` 입니다. 빌드는 기준일(KST)의 연·월 파일을 반드시 찾고, 이번 달·다음 달 파일로만 월별 페이지를 만듭니다. 지난달 파일은 남겨 두되 페이지는 지우고, 그 주소는 vercel.json redirects(빌드가 매번 다시 씀)로 별자리 페이지에 301 합니다.
- 달마다 데이터 품질(빈 항목, 실제 요일과 다른 요일 문장, 반말 문장)을 검사해 기준을 넘으면 경고를 남깁니다. 월별 페이지는 품질과 관계없이 noindex + sitemap 제외.
- 깨진 값(undefined 등) 누출, 깨진 내부 링크, 인라인 스크립트 문법, 본문 분량이 기준에 못 미치면 빌드가 실패합니다.
- 그달 `fortune-YYYY-MM.json` 이 없으면 빌드가 실패하므로 다음 달 데이터는 월말 전에 추가해야 합니다. `monthly-overview-YYYY-MM.json` 이 없으면 경고만 내고 요약 없이 만듭니다.

## 배포

Vercel에 GitHub 레포 연결 → 자동 배포.

## 라이선스

MIT

## 별자리 경계 시각 다시 만들기

`cd tools/sun-ingress && npm ci && node gen.mjs` — 결과 `data/sun-ingress-calc.json` 을 커밋합니다. 사이트 빌드는 이 JSON 만 읽으므로 매일 빌드에는 npm 설치가 필요 없습니다. 빌드는 한국천문연구원 값(data/sun-ingress-kasi.json)과 2분 넘게 어긋나면 멈춥니다.
