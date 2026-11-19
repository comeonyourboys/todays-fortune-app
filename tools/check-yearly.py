"""data/yearly-YYYY.json 검사 — 신년운세 문장 형식과 행성 날짜 언급이 맞는지 본다.
사용: python3 tools/check-yearly.py data/yearly-2027.json
"""
import json, re, sys

SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
TEXT_FIELDS = ['headline', 'overview', 'love', 'work', 'money', 'health', 'advice']
MIN_SENT = {'headline': 1, 'overview': 3, 'love': 2, 'work': 2, 'money': 2, 'health': 2, 'advice': 1}
POLITE = re.compile(r'(니다|세요|어요|아요|해요|죠|까요|네요|군요|에요|예요)[.!?]?$')
# 같은 문장 안에 행성 사건이 나오면 그 달도 함께 나와야 한다
FACTS = [
    (re.compile(r'목성.*처녀자리(로|에 들어)'), re.compile(r'7월'), '목성 처녀자리 이동은 7월 26일'),
    (re.compile(r'목성.*(순행|다시 앞으로)'), re.compile(r'4월'), '목성 순행 전환은 4월 13일'),
    (re.compile(r'토성.*역행|역행.*토성'), re.compile(r'8월|12월'), '토성 역행은 8월 9일~12월 24일'),
    (re.compile(r'천왕성.*역행|역행.*천왕성'), re.compile(r'9월'), '천왕성 역행 시작은 9월 15일'),
    (re.compile(r'금환일식'), re.compile(r'2월'), '금환일식은 2월 6일'),
    (re.compile(r'개기일식'), re.compile(r'8월'), '개기일식은 8월 2일'),
]
WRONG = [re.compile(p) for p in [r'2026년', r'토성.*(물고기자리|황소자리)로', r'목성.*(게자리|천칭자리)로', r'한국에서.*개기일식.*(보입니다|볼 수 있습니다)']]


def sents(t):
    return [x.strip() for x in re.split(r'(?<=[.!?])\s+', str(t).strip()) if x.strip()]


def main(path):
    data = json.load(open(path, encoding='utf-8'))
    errs = []
    seen = {}
    for k in SIGNS:
        s = data.get(k)
        if not s:
            if '--partial' not in sys.argv:
                errs.append(f'{k}: 없음')
            continue
        items = []
        for f in TEXT_FIELDS:
            v = s.get(f, '')
            ss = sents(v)
            if len(ss) < MIN_SENT[f]:
                errs.append(f'{k}.{f}: 문장 {len(ss)}개 (최소 {MIN_SENT[f]})')
            items += [(f, x) for x in ss]
        q = s.get('quarters', [])
        if len(q) != 4:
            errs.append(f'{k}.quarters: {len(q)}개 (4개 필요)')
        for i, t in enumerate(q):
            ss = sents(t)
            if len(ss) < 2:
                errs.append(f'{k}.quarters[{i}]: 문장 {len(ss)}개 (최소 2)')
            items += [(f'q{i + 1}', x) for x in ss]
        gm, cm = s.get('goodMonths', []), s.get('careMonths', [])
        if len(gm) != 3 or len(set(gm)) != 3 or not all(isinstance(m, int) and 1 <= m <= 12 for m in gm):
            errs.append(f'{k}.goodMonths: {gm}')
        if len(cm) != 2 or len(set(cm)) != 2 or not all(isinstance(m, int) and 1 <= m <= 12 for m in cm):
            errs.append(f'{k}.careMonths: {cm}')
        if set(gm) & set(cm):
            errs.append(f'{k}: 좋은 달과 조심할 달이 겹침 {set(gm) & set(cm)}')
        for f, x in items:
            if not POLITE.search(x):
                errs.append(f'{k}.{f}: 존댓말 끝맺음 아님 — {x}')
            for trig, need, why in FACTS:
                if trig.search(x) and not need.search(x):
                    errs.append(f'{k}.{f}: 날짜 빠짐({why}) — {x}')
            for w in WRONG:
                if w.search(x):
                    errs.append(f'{k}.{f}: 사실과 다른 표현 — {x}')
            if re.search(r'\d', re.sub(r'2027년|\d+~\d+월|\d+월|\d+일|\d+분기|\d+시|\d+분', '', x)):
                errs.append(f'{k}.{f}: 숫자 확인 — {x}')
            key = re.sub(r'\s+', '', x)
            if key in seen and seen[key] != k:
                errs.append(f'{k}.{f}: {seen[key]} 와 같은 문장 — {x}')
            seen.setdefault(key, k)
    n = sum(1 for k in SIGNS if k in data)
    if errs:
        print(f'✖ 오류 {len(errs)}건 (별자리 {n}개)')
        for e in errs:
            print('  ' + e)
        sys.exit(1)
    print(f'✔ 오류 없음 (별자리 {n}개, 문장 {len(seen)}개)')


if __name__ == '__main__':
    main(sys.argv[1])
