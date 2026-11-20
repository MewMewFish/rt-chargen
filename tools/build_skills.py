"""给 data/skills.json 补充详细描述（第三章技能说明）。

数据来源：data/_ch3_full.txt（第 112-171 页，含分页标记）
用法：python tools/build_skills.py
新增字段：desc（描述正文）、uses（技能使用）、groups（技能组）、special（特别用法列表）、page
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TXT = os.path.join(ROOT, 'data', '_ch3_full.txt')
SKILLS = os.path.join(ROOT, 'data', 'skills.json')

ATTRS = ('力量', '敏捷', '坚韧', '智力', '感知', '意志', '社交')
PAGE_RE = re.compile(r'=====\s*\[第\s*(\d+)\s*页')
HEAD_RE = re.compile(r'^(?P<name>.+?)[（(](?P<type>基础|基本|高级)(?:[，,、](?P<cat>[^）)]*))?[）)]\s*$')
GROUP_ITEM_RE = re.compile(r'^[^。]{1,20}（(Int|Ag|Fel|Per|Wil|S|T|WS|BS|Ag或Int)）[，。、]?$')


def load_lines():
    lines = open(TXT, encoding='utf-8').read().splitlines()
    pages, cur = [], 0
    for ln in lines:
        m = PAGE_RE.match(ln.strip())
        if m:
            cur = int(m.group(1))
            pages.append(-cur)          # 负数表示分页标记
            continue
        pages.append(cur)
    return lines, pages


def main():
    skills = json.load(open(SKILLS, encoding='utf-8'))
    names = {s['name'] for s in skills}
    lines, pages = load_lines()

    # 找出所有「技能名（基础/高级…）」标题行
    heads = []
    for i, ln in enumerate(lines):
        m = HEAD_RE.match(ln.strip())
        if m and m.group('name').strip() in names:
            heads.append((i, m.group('name').strip()))

    used = set()
    report = []
    for s in skills:
        name = s['name']
        hit = next((i for i, n in heads if n == name and i not in used), None)
        if hit is None:
            report.append('未找到技能段落: ' + name)
            continue
        used.add(hit)
        nxt = next((i for i, _ in heads if i > hit), len(lines))
        # 技能段落到「天赋」段落标志或下一章为止（避免最后一个技能吞掉后续内容）
        for j in range(hit + 1, nxt):
            tj = lines[j].strip()
            if tj.startswith('获取前提') or tj.startswith('天赋组') or re.match(r'^第[四五六]章', tj):
                nxt = j
                break
        block = list(range(hit + 1, nxt))

        desc_lines, uses, groups, specials = [], '', '', []
        cur_special = None
        collecting_groups = False
        for i in block:
            raw = lines[i]
            if pages[i] < 0:            # 分页标记
                continue
            t = raw.strip()
            if not t:
                continue
            if collecting_groups:
                groups += t
                collecting_groups = t.endswith(('，', '、'))
                continue
            if t.startswith(('技能使用', '技术使用')):
                uses = re.sub(r'^(技能|技术)使用\s*[:：]\s*', '', t)
                continue
            if t.startswith('技能组'):
                groups = re.sub(r'^技能组\s*[:：]\s*', '', t)
                collecting_groups = groups.endswith(('，', '、'))
                continue
            if t.startswith('特别用法'):
                if cur_special:
                    specials.append(cur_special)
                cur_special = {'name': re.sub(r'^特别用法\s*[:：]\s*', '', t), 'desc': ''}
                continue
            if t in ATTRS and not desc_lines and not uses and cur_special is None:
                continue
            if GROUP_ITEM_RE.match(t):          # 技能组续行/错位碎片
                continue
            if cur_special is not None:
                cur_special['desc'] += t
            else:
                desc_lines.append(t)
        if cur_special:
            specials.append(cur_special)
        # 丢掉排版错位产生的孤立短词（如「多样」）
        if desc_lines and len(desc_lines[0]) <= 3 and not desc_lines[0].endswith(('。', '，')):
            desc_lines.pop(0)

        s['desc'] = ''.join(desc_lines)
        s['uses'] = uses
        if groups:
            s['groups'] = groups
        if specials:
            s['special'] = specials
        s['page'] = pages[hit]

    # 特别用法归位：原书排版把「特别用法：安全系统」印在科技使用段末，
    # 其正文以「安保技能…」开头，按内容归回真正所属技能。
    name_list = [s['name'] for s in skills]
    by_name = {s['name']: s for s in skills}
    for s in skills:
        keep = []
        for sp in s.get('special', []):
            owner = next((n for n in name_list
                          if sp['desc'].startswith(n + '技能') and n != s['name']), None)
            if owner:
                by_name[owner].setdefault('special', []).append(sp)
            else:
                keep.append(sp)
        if keep:
            s['special'] = keep
        else:
            s.pop('special', None)

    json.dump(skills, open(SKILLS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    report.append('技能 %d 个，补全 %d 个' % (len(skills), sum(1 for s in skills if s.get('desc'))))
    open(os.path.join(ROOT, 'data', '_skills_report.txt'), 'w', encoding='utf-8').write('\n'.join(report))
    print(report[-1])


if __name__ == '__main__':
    main()
