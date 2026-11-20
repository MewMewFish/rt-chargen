"""抽取武器特性说明：data/traits.json

数据来源：data/_ch5.txt（第五章全文，含「===== [第 N 页 / 共 582 页] =====」分页标记）
特性词表来自 data/gear.json 的 traits 字段。
用法：python tools/build_traits.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TXT = os.path.join(ROOT, 'data', '_ch5.txt')

PUNCT = '。，、；：（）“”《》'
PAGE_RE = re.compile(r'=====\s*\[第\s*(\d+)\s*页')


def base_trait(t):
    return re.sub(r'\(.*?\)', '', t).strip()


def build_vocab():
    gear = json.load(open(os.path.join(ROOT, 'data', 'gear.json'), encoding='utf-8'))
    vocab = {}
    for it in gear:
        for t in it.get('traits') or []:
            name = base_trait(t)
            if name:
                vocab[name] = vocab.get(name, 0) + 1
    return vocab


def is_heading(line):
    s = line.strip()
    if not s or s.startswith('=====') or len(s) > 12:
        return False
    if any(p in s for p in PUNCT):
        return False
    if re.match(r'^[\d\.\s]+$', s):
        return False
    return True


def main():
    vocab = build_vocab()
    lines = open(TXT, encoding='utf-8').read().splitlines()

    start = 0
    for i, ln in enumerate(lines):
        if ln.strip() == '武器特性':
            start = i
            break
    end = len(lines)
    for i in range(start, len(lines)):
        if re.match(r'^表\s*5-4', lines[i].strip()):
            end = i
            break

    traits, page, cur, buf = {}, 0, None, []

    def flush():
        if cur and buf:
            text = ''.join(x.strip() for x in buf)
            text = re.sub(r'\s+', '', text)
            if text:
                traits[cur] = {'desc': text, 'page': page_of[cur]}

    page_of = {}
    for i in range(start, end):
        raw = lines[i]
        m = PAGE_RE.match(raw.strip())
        if m:
            page = int(m.group(1))
            continue
        s = raw.strip()
        if not s:
            continue
        if is_heading(s):
            flush()
            buf = []
            key = re.sub(r'[（(].*?[)）]', '', s.replace(' ', ''))
            if key in vocab:
                cur = key
                page_of[key] = page
            else:
                cur = None
            continue
        if cur:
            buf.append(s)
    flush()

    # 第二遍：章节外补充（如「爆炸」「不平衡」在军械库后半段才给出说明）
    for word in sorted(set(vocab) - set(traits)):
        for i in range(0, len(lines)):
            if lines[i].strip() != word:
                continue
            page = 0
            for j in range(i, -1, -1):
                m = PAGE_RE.match(lines[j].strip())
                if m:
                    page = int(m.group(1))
                    break
            buf = []
            for j in range(i + 1, min(i + 40, len(lines))):
                s = lines[j].strip()
                if not s or PAGE_RE.match(s):
                    continue
                if is_heading(s):
                    break
                buf.append(s)
            text = re.sub(r'\s+', '', ''.join(buf))
            if text:
                traits[word] = {'desc': text, 'page': page}
                break

    missing = sorted(set(vocab) - set(traits))
    json.dump(traits, open(os.path.join(ROOT, 'data', 'traits.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    lines_out = ['特性词表 %d 个，抽到说明 %d 个' % (len(vocab), len(traits)),
                 '缺说明：' + ('、'.join(missing) if missing else '（无）')]
    open(os.path.join(ROOT, 'data', '_traits_report.txt'), 'w', encoding='utf-8').write('\n'.join(lines_out))
    print(lines_out[0])


if __name__ == '__main__':
    main()
