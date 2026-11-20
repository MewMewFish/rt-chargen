"""从规则书 PDF 军械库（第 172-226 页）按列抽取全部装备 → data/gear.json

依赖 tools\\probe_tables.py 生成的 data\\_tt_cache\\pN.json（每页 extract_tables 结果）。
用法：python tools\\build_gear.py
输出：data\\gear.json、data\\gear_review.csv、data\\_gear_report.txt
"""
import csv
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'data', '_tt_cache')

SCHEMAS = {
    'ranged11': ['name', 'class', 'range', 'rof', 'dmg', 'pen', 'clip', 'reload', 'traits', 'wt', 'rarity'],
    'melee8': ['name', 'class', 'range', 'dmg', 'pen', 'traits', 'wt', 'rarity'],
    'grenade9': ['name', 'class', 'range', 'rof', 'dmg', 'pen', 'traits', 'wt', 'rarity'],
    'armor5': ['name', 'cover', 'ap', 'wt', 'rarity'],
    'three': ['name', 'wt', 'rarity'],
    'two': ['name', 'rarity'],
}

# 页 → (装备分类, schema, 表名)
PAGES = {}
for p in (172, 173, 174, 175):
    PAGES[p] = ('远程', 'ranged11', '表5-4 远程武器')
for p in (183, 184):
    PAGES[p] = ('手雷/导弹', 'grenade9', '表5-6 手榴弹和导弹')
for p in (187, 188):
    PAGES[p] = ('异种武器', 'ranged11', '表5-7 异种武器')
for p in (190, 191, 192):
    PAGES[p] = ('近战', 'melee8', '表5-8 近战武器')
for p in (196, 197):
    PAGES[p] = ('武器升级', 'three', '表5-9 武器升级')
for p in (200, 201):
    PAGES[p] = ('弹药', 'two', '表5-10 弹药')
for p in (202, 203):
    PAGES[p] = ('弹药', 'two', '表5-11 不寻常的弹药')
for p in (204, 205):
    PAGES[p] = ('护甲', 'armor5', '表5-12 护甲')
for p in (208, 209):
    PAGES[p] = ('装备', 'three', '表5-13 装备')
for p in (212, 213):
    PAGES[p] = ('药品', 'three', '表5-14 药品和消耗品')
for p in (216, 217, 218):
    PAGES[p] = ('工具', 'three', '表5-15 工具')
for p in (225, 226):
    PAGES[p] = ('植入物', 'two', '表5-16 赛博植入物')

CJK = r'\u4e00-\u9fa5'
RARITY_RE = re.compile(r'^(.*?)\s*[（(]\s*([+-]?\d+)\s*[）)]?$')
RARITY_WORDS = ('普遍', '丰富', '充足', '普通', '平均', '稀缺', '稀有', '非常稀有', '极度稀有',
                '近乎唯一', '独一无二', '传说', '独特')


def cell(v):
    if v is None:
        return ''
    s = v.replace('　', ' ')
    s = re.sub(r'[ \t]*\n[ \t]*', '', s)
    s = re.sub(r'(?<=[%s])\s+(?=[%s])' % (CJK, CJK), '', s)
    return re.sub(r'\s+', ' ', s).strip()


def norm_rarity(s):
    s = cell(s).replace(' ', '').replace('†', '')
    m = RARITY_RE.match(s)
    if not m or m.group(1) not in RARITY_WORDS:
        return None
    return {'label': m.group(1), 'mod': int(m.group(2))}


def parse_reload(s):
    s = cell(s).replace(' ', '')
    if not s or s in ('—', '-'):
        return None
    m = re.match(r'^(\d+)?(完整|部分|半)$', s)
    if not m:
        return {'n': 1, 'action': s}
    return {'n': int(m.group(1) or 1), 'action': m.group(2)}


def parse_wt(s):
    s = cell(s).replace(' ', '')
    if not s or s in ('—', '-', '–'):
        return None
    m = re.fullmatch(r'([+-]?\d+(?:\.\d+)?)kg', s)
    if m:
        return float(m.group(1))
    try:
        return float(s)
    except ValueError:
        return s


def split_traits(s):
    s = cell(s).replace('†', '')
    s = re.sub(r'\s*[（(]\s*', '(', s)
    s = re.sub(r'\s*[)）]\s*', ')', s)
    if not s or s in ('—', '-', '–'):
        return []
    out = []
    for t in re.split(r'[,，]', s):
        t = t.strip()
        if t and t not in ('—', '-', '–'):
            out.append(t)
    return out


def fix_row(cells, schema):
    """处理跨页碎片行、稀有度被切开、脚注大文本混入等情况。"""
    cells = list(cells)
    if cells and len(cells[0]) > 60:          # 大段脚注被塞进第 0 列（手雷表 p184）
        cells = cells[1:]
    n = len(SCHEMAS[schema])
    # 稀有度被拆到两格：'非常稀' + '有(-20)'（手雷表）
    if len(cells) == n + 1 and re.fullmatch(r'[有†]{1,2}', cells[-1]):
        m = re.match(r'^(.*?)([（(].*)$', cells[-2])
        cand = (m.group(1) + cells[-1] + m.group(2)) if m else ''
        if cand and norm_rarity(cand):
            cells[-2] = cand
        cells.pop()
    while len(cells) > n and cells[-1] in ('有', ''):
        cells.pop()
    while len(cells) > n and re.match(r'^[)）\d]', cells[-1] or ''):
        cells = cells[:-2] + [(cells[-2] or '') + cells[-1]]
    while len(cells) > n and cells[0] == '':   # 手雷表数据整体右移一列
        cells = cells[1:]
    return cells


def clean_name(s):
    s = cell(s).replace('†', '')
    s = re.sub(r'\(\s+', '(', s)
    s = re.sub(r'\s+\)', ')', s)
    return s.strip()



def is_footnote(cells):
    t = (cells[0] or '').strip()
    return t.startswith('†') or t.startswith('*') or t.startswith('注')


DMG_RE = re.compile(r'^[\d d+\-–—†特殊×x]+[EIERX]?†?$')


def main():
    items, review = [], []
    seen = {}

    for pno in sorted(PAGES):
        cat, schema, table = PAGES[pno]
        cols = SCHEMAS[schema]
        path = os.path.join(CACHE, f'p{pno}.json')
        if not os.path.exists(path):
            review.append({'page': pno, 'table': table, 'cat': cat, 'cells': '', 'issues': '缺少缓存页'})
            continue
        tables = json.load(open(path, encoding='utf-8'))
        group = ''
        for tb in tables:
            for raw in tb:
                cells = [cell(c) for c in raw]
                if not any(cells):
                    continue
                first = cells[0]
                if re.match(r'^表\s*5', first) or first == '名称':
                    continue
                if len([c for c in cells if c]) == 1:      # 分类小标题
                    if not is_footnote(cells):
                        group = first
                    continue
                if is_footnote(cells):
                    continue

                cells = fix_row(cells, schema)
                # 跨页续行：除首尾外全空，且末格不是完整稀有度
                if not any(cells[1:-1]) and not norm_rarity(cells[-1] if len(cells) > 1 else ''):
                    if items and cells[0]:
                        items[-1]['name'] += cells[0]
                        tail = cells[-1] if len(cells) > 1 else ''
                        if tail:
                            base = items[-1].get('_rar', '')
                            fixed = norm_rarity(base + tail)
                            if fixed:
                                items[-1]['rarity'] = fixed
                                items[-1]['_rar'] = base + tail
                    continue

                rec = {'cat': cat, 'group': group, 'page': pno, 'table': table}
                for i, key in enumerate(cols):
                    rec[key] = cells[i] if i < len(cells) else ''
                rec['name'] = clean_name(rec['name'])
                if not rec['name']:
                    continue
                rar_raw = rec.get('rarity', '')
                rec['_rar'] = rar_raw
                rec['rarity'] = norm_rarity(rar_raw)
                if 'wt' in rec:
                    rec['wt'] = parse_wt(rec['wt'])
                if 'reload' in rec:
                    rec['reload'] = parse_reload(rec['reload'])
                if 'traits' in rec:
                    rec['traits'] = split_traits(rec['traits'])
                for k in ('class', 'range', 'rof', 'dmg', 'pen', 'clip', 'cover', 'ap'):
                    if k in rec:
                        rec[k] = cell(rec[k])

                bad = []
                if re.search(r'[†＊*]', rec['name']):
                    bad.append('名字含脚注符')
                if len(rec['name']) > 22:
                    bad.append('名字过长')
                if bad:
                    review.append({'page': pno, 'table': table, 'cat': cat,
                                   'cells': ' | '.join(cells), 'issues': '; '.join(bad)})

                rec['_rawc'] = ' | '.join(cells)
                rec['id'] = '%s-%d' % (cat, len(items))
                items.append(rec)
                seen.setdefault(rec['name'], []).append(pno)

    # 精确去重（原书表内重复行，如「俄歇阵列」）
    uniq, keys, dup_n = [], set(), 0
    for it in items:
        key = (it['cat'], it['name'], str(it.get('wt')), (it.get('rarity') or {}).get('label'))
        if key in keys:
            dup_n += 1
            continue
        keys.add(key)
        uniq.append(it)
    items = uniq

    for it in items:
        if it.pop('_rar', None) is not None:
            pass
        # 手榴弹表名称为「破片」「致盲」等，补上后缀便于界面显示
        if it['cat'] == '手雷/导弹' and not it['name'].endswith('导弹'):
            it['label'] = it['name'] + '榴弹'
        else:
            it['label'] = it['name']
        if not it.get('rarity') and it.get('wt') in (None, ''):
            it['note'] = '原书未标注重量/稀有度'

    # 校验：在所有跨页修补完成之后进行，避免误报
    for it in items:
        raw_r = it.get('_rar', '')
        bad = []
        if not it.get('rarity') and raw_r not in ('—', '-', ''):
            bad.append('稀有度无法解析: ' + raw_r)
        if 'dmg' in it and it['dmg'] and not DMG_RE.match(it['dmg'].replace(' ', '')):
            bad.append('伤害格式: ' + it['dmg'])
        if 'pen' in it and it['pen'] not in ('', '—', '-', '†') and not it['pen'].isdigit():
            bad.append('穿甲: ' + it['pen'])
        if bad:
            review.append({'page': it['page'], 'table': it['table'], 'cat': it['cat'],
                           'cells': it.pop('_rawc', ''), 'issues': '; '.join(bad)})

    for it in items:
        it.pop('_rawc', None)

    json.dump(items, open(os.path.join(ROOT, 'data', 'gear.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, 'data', 'gear_review.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['page', 'table', 'cat', 'cells', 'issues'])
        w.writeheader()
        w.writerows(review)

    by_cat = {}
    for it in items:
        by_cat[it['cat']] = by_cat.get(it['cat'], 0) + 1
    lines = ['总计 %d 件，待核 %d 行' % (len(items), len(review))]
    for k, v in by_cat.items():
        lines.append('  %s: %d' % (k, v))
    dups = {k: v for k, v in seen.items() if len(v) > 1}
    lines.append('重名 %d 组：%s' % (len(dups), '、'.join(list(dups)[:20])))
    lines.append('精确重复行已合并 %d 条' % dup_n)

    # 分页抽样（人工核对用）
    lines.append('\n--- 抽样 20 条 ---')
    for it in items[::max(1, len(items) // 20)][:20]:
        lines.append('%s | %s | %s | %s | %s | %s kg | %s' % (
            it.get('name'), it.get('cat'), it.get('dmg', it.get('ap', '')),
            it.get('pen', ''), ','.join(it.get('traits') or []),
            it.get('wt'), (it.get('rarity') or {}).get('label', '') + '%+d' % (it.get('rarity') or {}).get('mod', 0)))

    # 全量清单（人工核对用）
    dump = []
    for it in items:
        rar = it.get('rarity')
        dump.append('\t'.join([
            it['cat'], it.get('group', ''), it['name'],
            str(it.get('wt', '')), (rar['label'] + '%+d' % rar['mod']) if rar else '—',
            ','.join(it.get('traits') or []), str(it['page'])]))
    open(os.path.join(ROOT, 'data', '_gear_names.txt'), 'w', encoding='utf-8').write('\n'.join(dump))

    open(os.path.join(ROOT, 'data', '_gear_report.txt'), 'w', encoding='utf-8').write('\n'.join(lines))
    print(lines[0])


if __name__ == '__main__':
    main()

