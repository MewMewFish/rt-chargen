"""行商浪人角色卡 —— 素材构建（3.0）
把 D:\\临时 里找到的插画/纹章/饰带做成前端可用的小图：
  · hero.jpg          超大幅舰船城市插画 → 页面背景（压到 1280 宽）
  · aquila.png        帝国双头鹰徽记（白底转透明，裁边）
  · aquila-mark.png   页眉 / 加载页小徽记
  · favicon.png       站点图标
  · banner-1/2/3.png  三条骷髅卷轴饰带（等分裁切，白底转透明）
  · skull-frame.png   骷髅花纹边框（角色卡装饰）
  · servitor.png      伺服颅骨卷轴（步骤/提示装饰）
  · paper.jpg         角色卡用的羊皮纸纹理（程序生成）

用法：python tools/build_assets.py
输出：assets/img/*，统计写到 data/_assets_report.txt
"""
import io
import os
import random

from PIL import Image, ImageFilter

SRC = r'D:\临时'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'img')

# 源文件 → 用途
FILES = {
    'hero': '171ff3f430528106015d85d10cd1fd6a.jpg',   # 舰船城市插画
    'servitor': '4846cdf8817362257871642eaabad298.jpg',  # 伺服颅骨卷轴
    'aquila': '6e6dba99e8660e10f2a86e3e61c9719c.jpg',    # 双头鹰徽记
    'banners': 'a2405de2aab5cf41114b22948cc3e7db.jpg',    # 三条骷髅饰带
    'frame': 'b51fee640c9d799e152f9e1b1e7e5729.jpg',     # 骷髅花纹边框
}

report = []


def note(msg):
    report.append(msg)
    print(msg)


def load(key):
    p = os.path.join(SRC, FILES[key])
    if not os.path.exists(p):
        raise SystemExit('缺少素材：' + p)
    return Image.open(p).convert('RGB')


def white_to_alpha(im, floor=246, dark=70, gamma=1.05, cut=18):
    """白底墨线 → 透明底。alpha 由亮度反推，并把极淡的纸纹噪点清零。"""
    g = im.convert('L')
    span = float(floor - dark)

    def a(v):
        if v >= floor:
            return 0
        x = ((floor - v) / span) ** gamma * 255
        x = min(255, int(x))
        return 0 if x < cut else x

    out = im.convert('RGBA')
    out.putalpha(g.point(a))
    return out


def ink_bands(im, count=3, gap=28):
    """按行墨量自动分带：返回 count 条内容最厚的连续行区间。"""
    alpha = im.split()[3]
    w, h = alpha.size
    px = alpha.load()
    step = 2
    prof = []
    for y in range(0, h, step):
        s = 0
        for x in range(0, w, 4):
            s += px[x, y]
        prof.append((y, s))

    runs, cur = [], None
    for y, s in prof:
        if s > w * 2:                      # 该行有墨
            if cur is None:
                cur = [y, y]
            else:
                cur[1] = y
        else:
            if cur is not None:
                runs.append(cur)
                cur = None
    if cur is not None:
        runs.append(cur)
    # 合并间距很小的碎行
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] <= gap:
            merged[-1][1] = r[1]
        else:
            merged.append(list(r))
    merged.sort(key=lambda r: (r[1] - r[0]), reverse=True)
    return sorted(merged[:count])


def trim(im, pad=4):
    box = im.split()[3].getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def fit_width(im, w):
    if im.width <= w:
        return im
    h = max(1, round(im.height * w / float(im.width)))
    return im.resize((w, h), Image.LANCZOS)


def save(im, name, **kw):
    p = os.path.join(OUT, name)
    im.save(p, **kw)
    note('  %-18s %5dx%-5d %6.1f KB' % (name, im.width, im.height, os.path.getsize(p) / 1024.0))


def save_png(im, name, colors=48):
    """带 alpha 的装饰图：量化成调色板 PNG，压缩率高很多，肉眼看不出差别。"""
    q = im.quantize(colors=colors, method=Image.FASTOCTREE)
    save(q, name, optimize=True)


def square(im, size):
    """居中放进正方形透明画布（favicon 用）。"""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    im = fit_width(im, size - 6)
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas


def paper_texture():
    """程序生成浅色羊皮纸：低频斑驳 + 细颗粒 + 几道纤维。"""
    base = Image.new('L', (256, 256), 238)
    px = base.load()
    random.seed(20240)
    for y in range(256):
        for x in range(256):
            px[x, y] = 232 + random.randint(0, 20)
    base = base.filter(ImageFilter.GaussianBlur(0.6))
    draw = Image.new('L', (256, 256), 0)
    d = draw.load()
    for _ in range(210):
        x0, y0 = random.randint(0, 255), random.randint(0, 255)
        for i in range(random.randint(6, 26)):
            x = (x0 + i) % 256
            y = (y0 + random.choice([0, 0, 1, -1])) % 256
            d[x, y] = random.randint(8, 26)
    draw = draw.filter(ImageFilter.GaussianBlur(1.4))
    from PIL import ImageChops
    base = ImageChops.subtract(base, draw)
    tint = Image.merge('RGB', (base.point(lambda v: min(255, int(v * 1.03))),
                               base.point(lambda v: min(255, int(v * 0.99))),
                               base.point(lambda v: min(255, int(v * 0.90)))))
    return tint


def main():
    os.makedirs(OUT, exist_ok=True)
    note('素材输出目录：%s' % OUT)

    # 1) 背景大图
    hero = load('hero')
    note('hero 源图 %dx%d' % hero.size)
    save(fit_width(hero, 1100), 'hero.jpg', quality=74, optimize=True, progressive=True)
    save(fit_width(hero, 420), 'hero-sm.jpg', quality=70, optimize=True)

    # 2) 徽记
    aq = trim(white_to_alpha(load('aquila')), pad=6)
    note('aquila 裁切后 %dx%d' % aq.size)
    save_png(fit_width(aq, 384), 'aquila.png', colors=40)
    save_png(fit_width(aq, 96), 'aquila-mark.png', colors=24)
    save_png(square(aq, 64), 'favicon.png', colors=24)

    # 3) 三条骷髅饰带：按墨迹行自动分带，各自裁边
    b = load('banners')
    note('banners 源图 %dx%d' % b.size)
    ink = white_to_alpha(b)
    bands = ink_bands(ink, count=3)
    note('  自动分带 %s' % bands)
    for i, (y0, y1) in enumerate(bands, 1):
        pad = 6
        band = ink.crop((0, max(0, y0 - pad), b.width, min(b.height, y1 + pad)))
        ornament = trim(band, pad=4)
        save_png(fit_width(ornament, 560), 'banner-%d.png' % i, colors=56)

    # 4) 骷髅边框（角色卡水印）
    fr = trim(white_to_alpha(load('frame')), pad=6)
    save_png(fit_width(fr, 460), 'skull-frame.png', colors=48)

    # 5) 伺服颅骨
    sv = trim(white_to_alpha(load('servitor')), pad=6)
    sv = sv.filter(ImageFilter.MedianFilter(3))      # 去掉扫描噪点
    save_png(fit_width(sv, 168), 'servitor.png', colors=24)

    # 6) 羊皮纸纹理
    save(paper_texture(), 'paper.jpg', quality=72, optimize=True)

    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    note('合计 %d 个文件，%.1f KB' % (len(os.listdir(OUT)), total / 1024.0))

    rp = os.path.join(ROOT, 'data', '_assets_report.txt')
    io.open(rp, 'w', encoding='utf-8').write('\n'.join(report))
    note('报告：%s' % rp)


if __name__ == '__main__':
    main()
