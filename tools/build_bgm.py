# -*- coding: utf-8 -*-
"""把网易云音乐的 .ncm 文件还原成浏览器能直接播放的音频（3.1 背景音乐）

.ncm 只是「外壳加密」：文件头、元数据用固定的 AES 密钥包着，音频流本身是
一层周期 256 字节的流密码。这里用标准算法还原，不需要联网、不需要 ffmpeg。

用法：
    python tools/build_bgm.py "D:\\CloudMusic\\VipSongsDownload\\xxx.ncm"
    python tools/build_bgm.py <源文件> --out assets/audio/bgm.mp3

产物：
    assets/audio/bgm.<ext>      音频（解码出的原始格式：mp3 / flac / m4a …）
    assets/img/bgm-cover.jpg    内嵌封面（有的话）
    assets/audio/bgm.json       曲名、歌手、专辑、时长，music.js 启动时读取
"""
import base64
import json
import os
import struct
import sys

from Crypto.Cipher import AES

# ncm 外壳用的两把固定密钥（社区公开）
CORE_KEY = bytes.fromhex('687A4852416D736F356B496E62617857')  # hzHRAmso5kInbaxW
META_KEY = bytes.fromhex('2331346C6A6B5F215C5D2630553C2728')  # #14ljk_!\]&0U<'(

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def unpad(s):
    return s[:-s[-1]] if s else s


def build_key_box(key):
    """RC4 风格的密钥编排（ncm 用的变体）"""
    box = bytearray(range(256))
    c = 0
    last = 0
    off = 0
    for i in range(256):
        swap = box[i]
        c = (swap + last + key[off]) & 0xFF
        off += 1
        if off >= len(key):
            off = 0
        box[i] = box[c]
        box[c] = swap
        last = c
    return box


def decrypt_audio(data, box):
    """周期 256 的流密码；返回 bytearray"""
    out = bytearray(len(data))
    for i in range(len(data)):
        j = (i + 1) & 0xFF
        k = box[(box[j] + box[(box[j] + j) & 0xFF]) & 0xFF]
        out[i] = data[i] ^ k
    return out


def sniff(head):
    if head[:3] == b'ID3' or (head[0] == 0xFF and (head[1] & 0xE0) == 0xE0):
        return 'mp3'
    if head[:4] == b'fLaC':
        return 'flac'
    if head[4:8] == b'ftyp':
        return 'm4a'
    if head[:4] == b'OggS':
        return 'ogg'
    if head[:4] == b'RIFF':
        return 'wav'
    return None


def parse_ncm(path):
    """返回 (meta dict, cover bytes|None, audio bytes, 扩展名)

    各家 ncm 变体的差异集中在这几处，这里全部自动探测：
      * 外壳异或字节：老版 0x64，新版 0x63（用已知明文前缀反推）
      * 密钥块里 "neteasecloudmusic" 前缀长度 / PKCS7 填充 / 6 字节前缀
      * 元数据后封面长度的写法（单个或重复两个 4 字节整数）
    解密结果先按音频文件头校验，校验不过就换下一组参数。
    """
    with open(path, 'rb') as f:
        blob = f.read()
    if blob[:8] != b'CTENFDAM':
        raise SystemExit('不是 ncm 文件（缺少 CTENFDAM 头）')

    key_len = struct.unpack('<I', blob[10:14])[0]
    key_blob = blob[14:14 + key_len]
    meta_off = 14 + key_len
    meta_len = struct.unpack('<I', blob[meta_off:meta_off + 4])[0]
    meta_blob = blob[meta_off + 4:meta_off + 4 + meta_len]
    pos = meta_off + 4 + meta_len

    # ---- 元数据：用 "163 key(Don't modify):" 反推外壳异或字节 ----
    prefix = b"163 key(Don't modify):"
    xor = meta_blob[0] ^ prefix[0] if meta_blob else 0x64
    if bytes(b ^ xor for b in meta_blob[:len(prefix)]) != prefix:
        xor = 0x64
    meta = {}
    if meta_len:
        raw = bytes(b ^ xor for b in meta_blob)
        for cut in (len(prefix), len(prefix) - 1):
            try:
                plain = unpad(AES.new(META_KEY, AES.MODE_ECB).decrypt(base64.b64decode(raw[cut:])))
                meta = json.loads(plain[6:].decode('utf-8'))   # 去掉 "music:" 前缀
                break
            except Exception:
                continue

    # ---- 封面与音频起点：找到 JPEG/PNG 魔数前的长度字段 ----
    cover = None
    audio_start = None
    for off in range(0, 16):
        if pos + off + 8 > len(blob):
            break
        length = struct.unpack('<I', blob[pos + off:pos + off + 4])[0]
        magic = blob[pos + off + 4:pos + off + 8]
        if 1000 < length < 8 * 1024 * 1024 and (magic[:3] == b'\xff\xd8\xff' or magic == b'\x89PNG'):
            cover = blob[pos + off + 4:pos + off + 4 + length]
            audio_start = pos + off + 4 + length
            break
    if audio_start is None:
        audio_start = pos + 13      # 兜底：标准布局
        cover = None

    enc = blob[audio_start:]

    # ---- 密钥块：候选参数逐个试，用解密后的文件头校验 ----
    box = None
    for kxor in (0x64, 0x63):
        kb = bytes(b ^ kxor for b in key_blob)
        for skip in (0, 16, 17, 32, 33):
            chunk = kb[skip:]
            if len(chunk) % 16 or len(chunk) < 32:
                continue
            try:
                plain = AES.new(CORE_KEY, AES.MODE_ECB).decrypt(chunk)
            except Exception:
                continue
            for pad in (True, False):
                body = unpad(plain) if (pad and 0 < plain[-1] <= 16) else plain
                for koff in (17, 6, 0):
                    key = body[koff:]
                    if not key:
                        continue
                    trial = build_key_box(key)
                    if sniff(decrypt_audio(enc[:64], trial)):
                        box = trial
                        break
                if box:
                    break
            if box:
                break
        if box:
            break
    if box is None:
        raise SystemExit('密钥推导失败：这个 ncm 变体暂不支持')

    audio = decrypt_audio(enc, box)
    ext = sniff(audio[:16])
    if not ext:
        raise SystemExit('解出的音频头无法识别（%r）' % audio[:8])
    return meta, cover, audio, ext


def main(argv):
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    src = argv[0]
    out = None
    for i, a in enumerate(argv):
        if a == '--out' and i + 1 < len(argv):
            out = argv[i + 1]

    print('读取 %s' % src)
    meta, cover, audio, ext = parse_ncm(src)
    if not out:
        out = os.path.join(ROOT, 'assets', 'audio', 'bgm.' + ext)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'wb') as f:
        f.write(audio)
    print('  音频  -> %s  (%.2f MB, %s)' % (os.path.relpath(out, ROOT), len(audio) / 1048576.0, ext))

    info = {
        'file': 'assets/audio/' + os.path.basename(out),
        'title': meta.get('musicName') or os.path.splitext(os.path.basename(src))[0],
        'artist': ' / '.join(a[0] for a in (meta.get('artist') or []) if a),
        'album': meta.get('album') or '',
        'durationMs': meta.get('duration') or 0,
        'bitrate': meta.get('bitrate') or 0,
    }

    if cover:
        cpath = os.path.join(ROOT, 'assets', 'img', 'bgm-cover.jpg')
        os.makedirs(os.path.dirname(cpath), exist_ok=True)
        made = False
        try:                                    # 缩到 400px，本地文件没必要塞 168 KB 原图
            from PIL import Image
            import io
            im = Image.open(io.BytesIO(cover)).convert('RGB')
            im.thumbnail((400, 400), Image.LANCZOS)
            im.save(cpath, 'JPEG', quality=82, optimize=True, progressive=True)
            made = True
        except Exception as e:
            print('  ! 封面压缩失败（%s），原样保存' % e)
        if not made:
            with open(cpath, 'wb') as f:
                f.write(cover)
        info['cover'] = 'assets/img/bgm-cover.jpg'
        print('  封面  -> assets/img/bgm-cover.jpg (%d KB)' % (os.path.getsize(cpath) // 1024))

    jpath = os.path.join(ROOT, 'assets', 'audio', 'bgm.json')
    with open(jpath, 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    # 直接双击 index.html（file:// 协议）时 fetch/XMLHttpRequest 会被拦，
    # 所以额外生成一份可以 <script> 引入的元数据；music.js 会优先读它。
    jspath = os.path.join(ROOT, 'assets', 'audio', 'bgm-meta.js')
    with open(jspath, 'w', encoding='utf-8') as f:
        f.write('/* 由 tools/build_bgm.py 生成，勿手改 */\n')
        f.write('window.RTBgmMeta = ' + json.dumps(info, ensure_ascii=False, indent=2) + ';\n')

    print('  信息  -> assets/audio/bgm.json + bgm-meta.js')
    print(json.dumps(info, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
