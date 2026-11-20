# -*- coding: utf-8 -*-
"""从规则书第四章（P133-160）抽取天赋详情 → data/talents.json

数据来源：
  data/_ch4_full.txt             正文（含分页标记），由 extract_text.py 133 161 生成
  data/_tt_cache/p134..p140.json 表4-1：天赋简表（pdfplumber 表格缓存）
用法：python tools/build_talents.py
输出：data/talents.json、data/_talents_report.txt

字段：name 名称 / group 天赋组选项 / prereq 获取前提 / effect 简表效果 /
      desc 完整描述 / special 特殊说明 / page 出处页 / title 书名写法（含 †）
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TXT = os.path.join(ROOT, 'data', '_ch4_full.txt')
CACHE = os.path.join(ROOT, 'data', '_tt_cache')
OUT = os.path.join(ROOT, 'data', 'talents.json')

PAGE_RE = re.compile(r'=====\s*\[第\s*(\d+)\s*页')
TABLE_PAGES = range(134, 141)
GROUP_SPLIT_RE = re.compile(r'[，,、]')

# 职业进阶表里的写法与第四章标题不一致（书中前后混用），按别名归位
ALIASES = {
    '基础武器训练': ['基本武器训练'],
    '快速装填': ['快速装弹'],
}


def cell(v):
    if v is None:
        return ''
    s = v.replace('\u3000', ' ').replace('\n', '')
    return re.sub(r'\s+', ' ', s).strip()


def load_table():
    """表4-1：天赋名称 / 获取前提 / 天赋效果。返回按书中顺序的字典列表。"""
    rows = []
    for p in TABLE_PAGES:
        path = os.path.join(CACHE, 'p%d.json' % p)
        if not os.path.exists(path):
            raise SystemExit('缺少表格缓存 %s（先运行 probe 抽取第 134-140 页）' % path)
        tables = json.load(io.open(path, encoding='utf-8'))
        if not tables:
            continue
        for raw in tables[0]:
            cells = [cell(c) for c in raw]
            while len(cells) < 3:
                cells.append('')
            title, prereq, effect = cells[0], cells[1], cells[2]
            if not title or title.startswith(('天赋名称', '†')):
                continue
            is_group = title.endswith('†')
            name = title.replace('†', '').strip()
            if not name:
                continue
            rows.append({
                'name': name, 'title': title.strip(),
                'prereqT': '' if prereq in ('—', '-', '–', '——', '') else prereq,
                'effect': effect, 'isGroup': is_group,
            })
    return rows


def load_lines():
    lines = io.open(TXT, encoding='utf-8').read().splitlines()
    pages, cur = [], 0
    for ln in lines:
        m = PAGE_RE.match(ln.strip())
        if m:
            cur = int(m.group(1))
            pages.append(-cur)              # 负数表示分页标记
            continue
        pages.append(cur)
    return lines, pages


def group_continuation(line, group):
    """判断一行是否是天「天赋组：…」列表的续行。"""
    t = line.strip()
    if not t or t.startswith(('获取前提', '天赋组', '特殊')) or '。' in t:
        return False
    toks = [x for x in GROUP_SPLIT_RE.split(t) if x]
    if not toks or len(t) > 80:
        return False
    return all(len(x) <= 8 for x in toks)


def main():
    rows = load_table()
    names = {r['name'] for r in rows}
    by_name = {r['name']: r for r in rows}
    lines, pages = load_lines()

    start = next((i for i, l in enumerate(lines) if l.strip() == '天赋描述'), None)
    if start is None:
        raise SystemExit('未找到「天赋描述」小节')
    end = next((i for i in range(start, len(lines))
                if re.match(r'^第[五六]章', lines[i].strip())), len(lines))

    # 标题行：整行恰好等于天赋名（书中正文标题不带 †）
    heads = []
    for i in range(start, end):
        t = lines[i].strip().replace('†', '')
        if t in names:
            heads.append((i, t))

    report, used = [], set()
    found = 0
    for idx, (i, name) in enumerate(heads):
        nxt = heads[idx + 1][0] if idx + 1 < len(heads) else end
        desc, prereq, group, specials = [], '', '', []
        pending_group = False
        for j in range(i + 1, nxt):
            if pages[j] < 0 or not lines[j].strip():
                continue
            t = lines[j].strip()
            if t.startswith('获取前提'):
                prereq = re.sub(r'^获取前提\s*[:：]\s*', '', t)
                continue
            if t.startswith('天赋组'):
                group = re.sub(r'^天赋组\s*[:：]\s*', '', t)
                pending_group = True
                continue
            if t.startswith('特殊'):
                specials.append(re.sub(r'^特殊\s*[:：]\s*', '', t))
                continue
            if pending_group and group_continuation(t, group):
                group += t
                continue
            pending_group = False
            desc.append(t)
        rec = by_name[name]
        rec['desc'] = ''.join(desc)
        rec['prereq'] = prereq or rec.pop('prereqT', '')
        rec['page'] = pages[i]
        if group:
            rec['group'] = group.strip('，,、 ')
        if specials:
            rec['special'] = specials
        used.add(name)
        found += 1

    missing = [r['name'] for r in rows if r['name'] not in used]
    no_desc = [r['name'] for r in rows if not r.get('desc')]

    out = []
    for r in rows:
        rec = {'name': r['name'], 'effect': r['effect'], 'prereq': r.get('prereq', ''),
               'desc': r.get('desc', ''), 'page': r.get('page')}
        if r['isGroup'] or r.get('group'):      # 简表漏标 † 的组别天赋（竞争对手 / 有口皆碑）
            rec['isGroup'] = True
        if r.get('group'):
            rec['group'] = r['group']
        if r.get('special'):
            rec['special'] = r['special']
        if ALIASES.get(r['name']):
            rec['alias'] = ALIASES[r['name']]
        out.append(rec)

    io.open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1))
    report.append('天赋 %d 条，命中正文 %d 条，含描述 %d，含天赋组 %d，含特殊说明 %d' % (
        len(out), found, len(out) - len(no_desc),
        sum(1 for r in out if r.get('group')), sum(1 for r in out if r.get('special'))))
    if missing:
        report.append('正文未找到小节标题: ' + '、'.join(missing))
    if no_desc:
        report.append('缺描述: ' + '、'.join(no_desc))
    io.open(os.path.join(ROOT, 'data', '_talents_report.txt'), 'w', encoding='utf-8').write('\n'.join(report))
    print(report[0])


if __name__ == '__main__':
    main()
