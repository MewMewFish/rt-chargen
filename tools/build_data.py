# -*- coding: utf-8 -*-
"""从规则书纯文本中抽取技能 / 职业(属性提升+等阶进阶) 数据，生成 data/*.json

用法: python build_data.py [规则书纯文本路径]
"""
import io, json, os, re, sys

_args = [a for a in sys.argv[1:] if not a.startswith('--')]
SRC = _args[0] if _args else \
    r'C:\Users\Administrator\.cline\data\workspaces\chat\40k-rt-text\行商浪人核心规则书_V0.3_全文.txt'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

CAREER_RE = r'(首席武装员|超然星语者|勘探者|传教士|导航者|行商浪人|管家|虚空伍长)'
ATTRS = ['武器技能', '弹道技能', '力量', '坚韧', '敏捷', '智力', '感知', '意志', '社交']
ATTR_CODE = {'武器技能': 'WS', '弹道技能': 'BS', '力量': 'S', '坚韧': 'T',
             '敏捷': 'Ag', '智力': 'Int', '感知': 'Per', '意志': 'WP', '社交': 'Fel'}
lines = io.open(SRC, encoding='utf-8').read().splitlines()


def clean(s):
    return re.sub(r'\s+', ' ', s).strip()


# ---------------- 技能表 3-1 ----------------
def parse_skills():
    skills, start = [], None
    for i, l in enumerate(lines):
        if re.match(r'^表3[–-]1[:：]技能', l.strip()):
            start = i
            break
    if start is None:
        raise SystemExit('未找到技能表')
    pat = re.compile(r'^(\S+?)\s*(基础|高级)\s*(力量|敏捷|意志|智力|感知|社交|坚韧)\s*(.*)$')
    for l in lines[start:start + 90]:
        m = pat.match(clean(l))
        if not m:
            continue
        name, kind, attr, cat = m.groups()
        skills.append({'name': name.replace('†', ''), 'type': kind, 'attr': attr,
                       'cat': cat.strip('，, '), 'group': name.endswith('†')})
    return skills


# ---------------- 职业 ----------------
ROW = re.compile(r'^(.*?)(\d{3,4})\s*(技能|天赋)(.*)$')
LEVEL = re.compile(r'([+＋]\d0?)$')


def strip_level(name):
    return LEVEL.sub('', name)


MULT = re.compile(r'[（(][xX×](\d)[)）]$')


def strip_mult(name):
    return MULT.sub('', name)


def balanced(s):
    return s.count('(') == s.count(')') and s.count('（') == s.count('）')


def parse_rows_raw(body):
    """第一遍：按行解析（含断行合并的粗略处理）"""
    rows, pending = [], ''
    for t in body:
        t = clean(t)
        if not t or t.startswith('=====') or t == '提升 花费 类型 前置条件':
            continue
        m = ROW.match(t)
        if not m:
            pending += t
            continue
        name = pending + m.group(1)
        pending = ''
        rest = m.group(4).strip()
        base = strip_level(name)
        if rest.startswith(base) and len(rest) > len(base):
            pending = rest[len(base):]
            rest = base
        rows.append({'n': name, 'c': int(m.group(2)), 't': m.group(3), 'p': rest})
    return rows


def build_vocab(all_rows, skills):
    vocab = set()
    for nm in skills:
        vocab.add(clean(nm))
        vocab.add(clean(nm) + '(择一)')
    for r in all_rows:
        base = clean(strip_level(strip_mult(r['n']))).replace('（择一）', '(择一)')
        if len(base) >= 2 and balanced(base) and not re.search(r'\d(?!0?$)', base):
            vocab.add(base)
    return sorted([v for v in vocab if len(v) >= 2], key=len, reverse=True)


def repair_rows(body, vocab):
    """第二遍：整块拼成一行，用词表从尾部回溯定位名字

    PDF 表格每行形如: 名字 花费 类型 前置条件
    但存在两种断行粘连: (a) 名字的 +10/+20 与花费连成 +10200
                      (b) 前置条件与下一行名字粘在一起
    """
    text = ''.join(clean(x) for x in body
                   if clean(x) and not clean(x).startswith('=====')
                   and clean(x) != '提升 花费 类型 前置条件')
    pat = re.compile(r'([+＋]\d{2})?(\d{3,4})\s*(技能|天赋)')
    rows, prev_end = [], 0
    for m in pat.finditer(text):
        s, e = m.start(), m.end()
        lvl_inline, cost, typ = m.group(1), int(m.group(2)), m.group(3)
        raw = text[prev_end:s].strip()
        prev_end = e

        if lvl_inline:                     # 名字的等级后缀被吞进本次匹配
            core, lvl = raw, lvl_inline
        else:
            m2 = LEVEL.search(raw)
            core = raw[:m2.start()] if m2 else raw
            lvl = m2.group(1) if m2 else ''

        mult = ''
        m3 = MULT.search(core)             # (x2) / (X3) 之类的购买上限标记
        if m3:
            mult = m3.group(0)
            core = core[:m3.start()]

        name, pre = None, ''
        for v in vocab:
            if core.endswith(v):
                name, pre = v, core[:-len(v)]
                break
        if name is None:
            # 词表未命中：先剥掉粘连的属性前置（如 Per40、Fel50,）
            m5 = re.match(r'^((?:WS|BS|S|T|Ag|Int|Per|WP|Fel)\s*\d{2})\s*[,，]?\s*', core)
            if m5:
                pre = m5.group(1)
                rest2 = core[m5.end():]
                for v in vocab:
                    if rest2.endswith(v):
                        name = v
                        pre = pre + ',' + rest2[:-len(v)] if rest2[:-len(v)] else pre
                        break
                if name is None:
                    name = rest2
        if name is None:
            name, pre = core, ''
        name = re.sub(r'^[（(]任意[）)]', '', clean(name))   # 清掉粘在名字前的“（任意）”
        # 该表格的“前置条件”列排在“类型”之后，实际属于**上一行**
        if pre and rows:
            rows[-1]['p'] = clean(rows[-1]['p'] + ' ' + pre)
        rows.append({'n': clean(name) + mult + lvl.strip(), 'c': cost, 't': typ, 'p': ''})
    tail = text[prev_end:].strip()
    if tail and rows:
        rows[-1]['p'] = clean(rows[-1]['p'] + ' ' + tail)
    return rows


def next_text(i):
    """取第 i 行之后第一个非页码行的文本（用于拼接断行表头）"""
    for k in range(i + 1, min(i + 4, len(lines))):
        t = clean(lines[k])
        if t and not t.startswith('====='):
            return t
    return ''


def parse_career_chapter(skills):
    # 第一遍：切块
    blocks, career, rank, body = [], None, None, []
    for i in range(1560, 3560):
        if i >= len(lines):
            break
        s = clean(lines[i])
        if s.startswith('====='):
            continue
        s2 = s + next_text(i)

        m = re.match(r'^' + CAREER_RE + r'属性提[升]?(?=属性 青涩|$)', s2)
        if m:
            if career and rank is not None:
                blocks.append((career, rank, body))
            career, rank, body = m.group(1), None, []
            continue

        m = re.match(r'^等阶(\d)' + CAREER_RE + r'提升(?=提升 花费|$)', s2)
        if m:
            if career and rank is not None:
                blocks.append((career, rank, body))
            career, rank, body = m.group(2), int(m.group(1)), []
            continue

        if rank is not None and s != '属性 青涩 中级 受训 专家':
            body.append(s)

    if career and rank is not None:
        blocks.append((career, rank, body))

    # 第一遍解析，收集词表
    first = [(c, r, parse_rows_raw(b)) for c, r, b in blocks]
    all_rows = [x for _, _, rows in first for x in rows]
    vocab = build_vocab(all_rows, [s['name'] for s in skills])

    out, attr_plan = {}, {}
    # 属性提升方案单独扫一遍
    for i, l in enumerate(lines):
        m = re.match(r'^' + CAREER_RE + r'属性提[升]?', clean(l) + clean(lines[i + 1] if i + 1 < len(lines) else ''))
        if m:
            plan = {}
            k = i + 1
            while k < len(lines) and len(plan) < 9:
                parts = clean(lines[k]).split(' ')
                if len(parts) >= 5 and parts[0] in ATTRS:
                    nums = [int(re.sub(r'[^\d]', '', p)) for p in parts[1:5] if re.search(r'\d', p)]
                    if len(nums) == 4:
                        plan[ATTR_CODE.get(parts[0], parts[0])] = nums
                k += 1
            if len(plan) == 9:
                attr_plan.setdefault(m.group(1), plan)

    for c, r, b in blocks:
        cobj = out.setdefault(c, {'name': c, 'attrPlan': {}, 'ranks': {}})
        cobj['ranks'][str(r)] = repair_rows(b, vocab)
    for c, plan in attr_plan.items():
        out.setdefault(c, {'name': c, 'attrPlan': {}, 'ranks': {}})['attrPlan'] = plan
    return out


def parse_career_extras():
    """抽取每个职业的 起始技能 / 起始天赋 / 起始装备"""
    starts = []
    for i in range(1560, 3560):
        if i >= len(lines):
            break
        s2 = clean(lines[i]) + next_text(i)
        m = re.match(r'^' + CAREER_RE + r'属性提[升]?(?=属性 青涩|$)', s2)
        if m:
            starts.append((i, m.group(1)))
    out = {}
    for idx, (i, name) in enumerate(starts):
        lo = starts[idx - 1][0] if idx > 0 else max(0, i - 160)
        joined = ''.join(clean(x) for x in lines[lo:i] if not clean(x).startswith('====='))
        def grab(pat, nxt):
            m = re.search(pat + r'[:：](.*?)(?:' + nxt + r'|$)', joined)
            return m.group(1) if m else ''
        out[name] = {
            'startSkills': grab('起始技能', '起始天赋|起始装备'),
            'startTalents': grab('起始天赋', '起始装备'),
            'startGear': grab('起始装备', '~~~')[:260],
        }
    return out


def write_bundle(paths):
    """把 JSON 数据包成可直接 <script> 引入的 JS（file:// 下 fetch 会被拦）"""
    blob = {}
    for key, fn in paths.items():
        p = os.path.join(OUT, fn)
        if os.path.exists(p):
            blob[key] = json.load(io.open(p, encoding='utf-8'))
    js = 'window.RTData = ' + json.dumps(blob, ensure_ascii=False) + ';\n'
    io.open(os.path.join(OUT, 'bundle.js'), 'w', encoding='utf-8').write(js)


BUNDLE_FILES = {'origin': 'origin.json', 'careers': 'careers.json', 'skills': 'skills.json',
                'talents': 'talents.json', 'gear': 'gear.json', 'traits': 'traits.json'}


def keep_enriched(skills):
    """重新解析技能表时保留 build_skills.py 补全的描述字段。"""
    p = os.path.join(OUT, 'skills.json')
    if not os.path.exists(p):
        return
    old = {s['name']: s for s in json.load(io.open(p, encoding='utf-8'))}
    for s in skills:
        for k in ('desc', 'uses', 'groups', 'special', 'page'):
            if k in old.get(s['name'], {}):
                s[k] = old[s['name']][k]


def main():
    if '--bundle-only' in sys.argv:
        write_bundle(BUNDLE_FILES)
        print('bundle 已重建（仅打包现有 data/*.json）')
        return
    skills = parse_skills()
    keep_enriched(skills)
    careers = parse_career_chapter(skills)
    for name, extra in parse_career_extras().items():
        if name in careers:
            careers[name].update(extra)
    os.makedirs(OUT, exist_ok=True)
    io.open(os.path.join(OUT, 'skills.json'), 'w', encoding='utf-8').write(
        json.dumps(skills, ensure_ascii=False, indent=1))
    io.open(os.path.join(OUT, 'careers.json'), 'w', encoding='utf-8').write(
        json.dumps(careers, ensure_ascii=False, indent=1))
    write_bundle(BUNDLE_FILES)

    rep = ['技能数: %d' % len(skills)]
    for name, c in careers.items():
        tot = sum(len(v) for v in c['ranks'].values())
        rep.append('%s: 等阶=%s 总行=%d 属性方案=%d' % (
            name, ','.join(sorted(c['ranks'], key=int)), tot, len(c['attrPlan'])))
        rep.append('    起始技能: %s' % c.get('startSkills', '')[:110])
        rep.append('    起始天赋: %s' % c.get('startTalents', '')[:80])
        rep.append('    起始装备: %s' % c.get('startGear', '')[:90])
    for who, rk in (('行商浪人', '5'), ('管家', '6')):
        rep.append('\n%s 等阶%s 全部行:' % (who, rk))
        for r in careers.get(who, {}).get('ranks', {}).get(rk, []):
            rep.append('  %-26s %4d %s |前置: %s' % (r['n'], r['c'], r['t'], r['p']))
    io.open(os.path.join(OUT, '_build_report.txt'), 'w', encoding='utf-8').write('\n'.join(rep))


if __name__ == '__main__':
    main()
