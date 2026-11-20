"""临时探针 2：逐页缓存军械库表格（带断点续跑），并生成表头索引。"""
import io
import json
import os
import sys
import time

import pdfplumber

PDF = r'C:\Users\Administrator\Downloads\40K·行商浪人核心规则书·V0.3 (1).pdf'

CACHE = r'D:\AIsoft\rt-chargen\data\_tt_cache'
os.makedirs(CACHE, exist_ok=True)
a = int(sys.argv[1]) if len(sys.argv) > 1 else 172
b = int(sys.argv[2]) if len(sys.argv) > 2 else 236
t0 = time.time()

out = io.StringIO()
with pdfplumber.open(PDF) as pdf:
    for pno in range(a, b + 1):
        path = os.path.join(CACHE, f'p{pno}.json')
        if not os.path.exists(path):
            json.dump(pdf.pages[pno - 1].extract_tables(), open(path, 'w', encoding='utf-8'), ensure_ascii=False)
        tbls = json.load(open(path, encoding='utf-8'))
        if not tbls:
            print(f'{pno}: -', file=out)
            continue
        for tb in tbls:
            cols = len(tb[0]) if tb else 0
            head = ' | '.join(('' if c is None else c.replace('\n', '/')) for c in tb[0][:12]) if tb else ''
            print(f'{pno}: rows={len(tb)} cols={cols} HEAD[{head}]', file=out)

open(r'D:\AIsoft\rt-chargen\data\_tables_index.txt', 'w', encoding='utf-8').write(out.getvalue())
print('done')
