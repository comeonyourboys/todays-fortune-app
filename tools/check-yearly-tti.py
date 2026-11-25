"""data/yearly-YYYY-tti.json 검사 — 띠별 신년운세 문장 형식, 달·지지 짝, 태어난 해 목록이 규칙과 맞는지 본다.
사용: python3 tools/check-yearly-tti.py data/yearly-2027-tti.json
"""
import json, re, sys

ANIMALS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig']
BR = '자축인묘진사오미신유술해'
TEXT_FIELDS = ['headline', 'overview', 'love', 'work', 'money', 'health', 'advice']
MIN_SENT = {'headline': 1, 'overview': 3, 'love': 2, 'work': 2, 'money': 2, 'health': 2, 'advice': 1}
POLITE = re.compile(r'(니다|세요|어요|아요|해요|죠|까요|네요|군요|에요|예요)[.!?]?$')
YUKHAP = {0: 1, 1: 0, 2: 11, 3: 10, 4: 9, 5: 8, 6: 7, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2}
SAMHAP = [{8, 0, 4}, {11, 3, 7}, {2, 6, 10}, {5, 9, 1}]
WONJIN = {0: 7, 7: 0, 1: 6, 6: 1, 2: 9, 9: 2, 3: 8, 8: 3, 4: 11, 11: 4, 5: 10, 10: 5}
WRONG = [re.compile(p) for p in [r'2026년(?!부터)', r'임인|계묘|갑진|을사년(?!부터)']]


def month_of(b):  # 지지 → 양력 달(그달 초 절기부터). 인=2월 … 자=12월, 축=1월
    m = (b - 2) % 12 + 2
    return m - 12 if m > 12 else m


def sents(t):
    return [x.strip() for x in re.split(r'(?<=[.!?])\s+', str(t).strip()) if x.strip()]


def main(path):
    data = json.load(open(path, encoding='utf-8'))
    year = int(re.search(r'yearly-(\d{4})-tti', path).group(1))
    errs = []
    yb = (year - 4) % 12  # 그해 지지
    if BR[yb] != data['_year']['ganji'][1]:
        errs.append(f"_year.ganji {data['_year']['ganji']} 의 지지가 {year}년({BR[yb]})과 다름")
    for b, k in enumerate(ANIMALS):
        s = data.get(k)
        if not s:
            errs.append(f'{k}: 없음')
            continue
        for f in TEXT_FIELDS:
            ss = sents(s.get(f, ''))
            if len(ss) < MIN_SENT[f]:
                errs.append(f'{k}.{f}: 문장 {len(ss)}개 (최소 {MIN_SENT[f]})')
            for x in ss:
                if not POLITE.search(x):
                    errs.append(f'{k}.{f}: 존댓말 아님 — {x}')
        q = s.get('quarters', [])
        if len(q) != 4:
            errs.append(f'{k}.quarters: {len(q)}개 (4개여야 함)')
        good = sorted({month_of(YUKHAP[b])} | {month_of(x) for g in SAMHAP if b in g for x in g if x != b})
        care = sorted({month_of((b + 6) % 12), month_of(WONJIN[b])})
        if sorted(s.get('goodMonths', [])) != good:
            errs.append(f"{k}.goodMonths {s.get('goodMonths')} ≠ 규칙 {good}")
        if sorted(s.get('careMonths', [])) != care:
            errs.append(f"{k}.careMonths {s.get('careMonths')} ≠ 규칙 {care}")
        # 문장에 "N월 X월"(예: 8월 신월)이 나오면 지지와 달이 맞아야 한다
        alltext = ' '.join([s.get(f, '') for f in TEXT_FIELDS] + q)
        for m, br in re.findall(r'(\d{1,2})월 ([자축인묘진사오미신유술해])월', alltext):
            if month_of(BR.index(br)) != int(m):
                errs.append(f'{k}: "{m}월 {br}월" — {br}월은 {month_of(BR.index(br))}월')
        for m, br in re.findall(r'(\d{1,2})월은 ([자축인묘진사오미신유술해])월', alltext):
            if month_of(BR.index(br)) != int(m):
                errs.append(f'{k}: "{m}월은 {br}월" — {br}월은 {month_of(BR.index(br))}월')
        for x in sents(alltext):
            for w in WRONG:
                if w.search(x):
                    errs.append(f'{k}: 확인 필요 — {x}')
        want = [str(y) for y in range(1948, 2020) if (y - 4) % 12 == b]
        got = sorted(s.get('byYear', {}).keys())
        if got != want:
            errs.append(f'{k}.byYear 해 {got} ≠ {want}')
        for y, t in s.get('byYear', {}).items():
            for x in sents(t):
                if not POLITE.search(x):
                    errs.append(f'{k}.byYear.{y}: 존댓말 아님 — {x}')
    heads = [data[k]['headline'] for k in ANIMALS if k in data]
    if len(set(heads)) != len(heads):
        errs.append('headline 중복')
    if errs:
        print('\n'.join('✖ ' + e for e in errs))
        sys.exit(1)
    print(f'✔ {path}: 띠 12개, 문장·달·태어난 해 검사 통과')


if __name__ == '__main__':
    main(sys.argv[1])
