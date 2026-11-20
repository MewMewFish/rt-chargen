import io, json, re

p = r'D:\AIsoft\rt-chargen\data\careers.json'
d = json.load(io.open(p, encoding='utf-8'))
tot = bad = pre = 0
samples = []
for cname, c in d.items():
    for rk, rows in c['ranks'].items():
        for r in rows:
            tot += 1
            n = r['n']
            core = re.sub(r'[（(][xX×]\d[)）]$', '', n)
            core = re.sub(r'[+＋]\d0$', '', core)
            ok = bool(re.match(r'^[\u4e00-\u9fa5A-Za-z()（）,，/\s+＋\-]+$', core)) \
                and core.count('(') == core.count(')') and core.count('（') == core.count('）') \
                and not re.search(r'\d', core)
            if not ok:
                bad += 1
                if len(samples) < 12:
                    samples.append('%s 等阶%s: %s' % (cname, rk, n))
            if r['p']:
                pre += 1

out = ['总进阶行: %d' % tot, '有前置条件: %d (%.1f%%)' % (pre, 100.0 * pre / tot),
       '名字可疑行: %d (%.1f%%)' % (bad, 100.0 * bad / tot)] + ['  ' + s for s in samples]

# ---- 2.0：技能 / 军械库 / 特性 ----
BASE = 'D:\\AIsoft\\rt-chargen\\data\\'
skills = json.load(io.open(BASE + 'skills.json', encoding='utf-8'))
talents = json.load(io.open(BASE + 'talents.json', encoding='utf-8'))
gear = json.load(io.open(BASE + 'gear.json', encoding='utf-8'))
traits = json.load(io.open(BASE + 'traits.json', encoding='utf-8'))

out.append('')
out.append('技能: %d 个，含描述 %d，含技能组 %d，含特别用法 %d，缺描述: %s' % (
    len(skills), sum(1 for s in skills if s.get('desc')),
    sum(1 for s in skills if s.get('groups')),
    sum(1 for s in skills if s.get('special')),
    '、'.join(s['name'] for s in skills if not s.get('desc')) or '（无）'))

out.append('')
out.append('天赋: %d 条，含描述 %d，含天赋组 %d，含获取前提 %d，缺描述: %s' % (
    len(talents), sum(1 for t in talents if t.get('desc')),
    sum(1 for t in talents if t.get('group')),
    sum(1 for t in talents if t.get('prereq')),
    '、'.join(t['name'] for t in talents if not t.get('desc')) or '（无）'))


def _cands(text):
    """与 js/calc.js talentCandidates 同规则：逐层剥离 †、计数、括注、前缀组别、基本/基础。"""
    seen, out = set(), []

    def push(v):
        s = re.sub(r'[\u3002.\s]+$', '', str(v).replace('†', '')).strip()
        if not s or s in seen:
            return
        seen.add(s)
        out.append(s)
        push(re.sub(r'^[（(][^）)]*[)）]', '', s))
        push(re.sub(r'\d+$', '', s))
        push(re.sub(r'[（(][^）)]*[)）]$', '', s))
        push(re.sub(r'^基本', '基础', s))

    push(text)
    return out


_tnames = {t['name'] for t in talents}
for t in talents:
    for a in t.get('alias', []):
        _tnames.add(a)
_refs = set()
for c in d.values():
    for rows in c['ranks'].values():
        for r in rows:
            if r['t'] == '天赋':
                _refs.add(r['n'])
    for x in re.split(r'[、，,]', c.get('startTalents') or ''):
        if x.strip():
            _refs.add(x.strip())
for opt in json.load(io.open(BASE + 'origin.json', encoding='utf-8')).get('options', {}).values():
    for x in (opt.get('talents') or []):
        _refs.add(str(x))
_miss = sorted(r for r in _refs if not any(c in _tnames for c in _cands(r)))
out.append('天赋引用: %d 个写法，未命中词典 %d 个%s' % (
    len(_refs), len(_miss), '' if not _miss else '：' + '、'.join(_miss)))

by_cat = {}
for g in gear:
    by_cat[g['cat']] = by_cat.get(g['cat'], 0) + 1
out.append('装备: %d 件 → %s' % (len(gear), '，'.join('%s %d' % (k, v) for k, v in by_cat.items())))
out.append('  缺稀有度(无市价) %d 件；缺重量 %d 件；缺出处页 %d 件' % (
    sum(1 for g in gear if not g.get('rarity')),
    sum(1 for g in gear if g.get('wt') in (None, '')),
    sum(1 for g in gear if not g.get('page'))))
refs = sorted({t.split('(')[0] for g in gear for t in (g.get('traits') or [])})
out.append('武器特性: %d 条；装备引用 %d 种%s' % (
    len(traits), len(refs), '' if len(refs) <= len(traits) else
    '；未收录: ' + '、'.join(r for r in refs if r not in traits)))

io.open(r'D:\AIsoft\rt-chargen\data\_quality.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('\n'.join(out[3:]))

