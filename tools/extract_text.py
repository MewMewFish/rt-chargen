"""按页范围导出 PDF 文本，供数据构建脚本使用（逐页缓存，可断点续跑）。

用法：python tools/extract_text.py <起始页> <结束页> <输出文件>
示例：python tools/extract_text.py 112 171 data/_ch3_full.txt
"""
import os
import sys

import pdfplumber

PDF = r'C:\Users\Administrator\Downloads\40K·行商浪人核心规则书·V0.3 (1).pdf'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'data', '_txt_cache')


def main():
    a, b, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    os.makedirs(CACHE, exist_ok=True)
    chunks, total = [], 0
    with pdfplumber.open(PDF) as pdf:
        total = len(pdf.pages)
        for p in range(a, b + 1):
            path = os.path.join(CACHE, f'p{p}.txt')
            if not os.path.exists(path):
                open(path, 'w', encoding='utf-8').write(pdf.pages[p - 1].extract_text() or '')
    for p in range(a, b + 1):
        path = os.path.join(CACHE, f'p{p}.txt')
        chunks.append(f'===== [第 {p} 页 / 共 {total} 页] =====')
        chunks.append(open(path, encoding='utf-8').read() if os.path.exists(path) else '')
    path = os.path.join(ROOT, out)
    open(path, 'w', encoding='utf-8').write('\n'.join(chunks))
    print('wrote', out, 'pages', a, '-', b)


if __name__ == '__main__':
    main()
