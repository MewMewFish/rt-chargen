/* 行商浪人角色卡 —— 音效（3.1）
 * 全部用 WebAudio 现场合成，不依赖任何音频文件：
 *   click 轻按 / page 翻页 / open 抽屉展开 / close 抽屉收起
 *   dice 掷骰 / buy 购买 / error 拒绝 / rank 等阶提升 / theme 换主题
 * 背景音乐由独立模块 js/music.js 负责（3.1 起取代原来的合成环境低鸣）。
 * 浏览器要求先有用户手势才能出声，故 AudioContext 延迟到首次点击/按键时创建。
 */
window.RTSfx = (function () {
  const PREF = 'rt-chargen-sfx';
  const AC = window.AudioContext || window.webkitAudioContext;

  let ctx = null, master = null, noiseBuf = null;
  let prefs = { on: true };

  try {
    const raw = localStorage.getItem(PREF);
    if (raw) {
      const p = JSON.parse(raw) || {};
      prefs.on = p.on !== false;
    }
  } catch (e) { /* 隐私模式 */ }

  function savePrefs() {
    try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch (e) { /* 忽略 */ }
  }

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { /* 忽略 */ } }
    return ctx;
  }

  function noise() {
    if (noiseBuf || !ctx) return noiseBuf;
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /* 一声正弦/三角/锯齿：可选扫频 + 可选低通 */
  function tone(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    const peak = Math.max(0.0001, o.gain == null ? 0.12 : o.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, o.dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    node.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  /* 噪声扫频（翻页、抽气、风声） */
  function whoosh(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = o.type || 'bandpass';
    bp.Q.value = o.q || 1.1;
    bp.frequency.setValueAtTime(o.f || 900, t0);
    bp.frequency.exponentialRampToValueAtTime(Math.max(60, o.f2 || 300), t0 + o.dur);
    const g = ctx.createGain();
    const peak = Math.max(0.0001, o.gain == null ? 0.09 : o.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + o.dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  const SOUNDS = {
    click() {
      tone({ f: 620, f2: 380, dur: 0.055, type: 'triangle', gain: 0.05, lp: 2400 });
      whoosh({ f: 2600, f2: 1400, dur: 0.05, gain: 0.025, q: 0.8 });
    },
    page() {
      whoosh({ f: 1500, f2: 260, dur: 0.34, gain: 0.075, q: 0.9 });
      tone({ f: 150, f2: 90, dur: 0.28, type: 'sine', gain: 0.045, delay: 0.02 });
    },
    open() {
      whoosh({ f: 300, f2: 1600, dur: 0.22, gain: 0.05, q: 1.4 });
      tone({ f: 330, f2: 660, dur: 0.18, type: 'triangle', gain: 0.05 });
    },
    close() {
      whoosh({ f: 1600, f2: 320, dur: 0.2, gain: 0.045, q: 1.4 });
      tone({ f: 640, f2: 300, dur: 0.16, type: 'triangle', gain: 0.045 });
    },
    dice() {
      for (let i = 0; i < 5; i++) {
        whoosh({ f: 3200 - i * 260, f2: 900, dur: 0.05, gain: 0.05, q: 2, delay: i * 0.055 + Math.random() * 0.02 });
      }
      tone({ f: 120, f2: 70, dur: 0.22, type: 'sine', gain: 0.07, delay: 0.3 });
    },
    buy() {
      tone({ f: 784, dur: 0.1, type: 'triangle', gain: 0.07 });
      tone({ f: 1175, dur: 0.16, type: 'triangle', gain: 0.055, delay: 0.08 });
      whoosh({ f: 2600, f2: 4200, dur: 0.14, gain: 0.03, q: 1.6, delay: 0.06 });
    },
    error() {
      tone({ f: 190, f2: 120, dur: 0.24, type: 'sawtooth', gain: 0.055, lp: 700 });
      tone({ f: 96, dur: 0.26, type: 'sine', gain: 0.05, delay: 0.02 });
    },
    rank() {
      [523, 659, 784, 1047].forEach(function (f, i) { tone({ f: f, dur: 0.28, type: 'triangle', gain: 0.06, delay: i * 0.09 }); });
      whoosh({ f: 400, f2: 3200, dur: 0.5, gain: 0.035, q: 0.9, delay: 0.05 });
    },
    theme() {
      tone({ f: 440, f2: 660, dur: 0.2, type: 'sine', gain: 0.045 });
    }
  };

  function play(name) {
    if (!prefs.on) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try { fn(); } catch (e) { /* 无声也不影响功能 */ }
  }

  /* 环境低鸣已移除：3.1 起由 js/music.js 播放真正的背景音乐 */

  return {
    play: play,
    unlock: function () { if (prefs.on) ensure(); },
    enabled: function () { return prefs.on; },
    setEnabled: function (v) {
      prefs.on = !!v;
      savePrefs();
      if (prefs.on) { ensure(); play('click'); }
    },
    toggle: function () { this.setEnabled(!prefs.on); return prefs.on; },
    sounds: Object.keys(SOUNDS),
    ready: function () { return !!ctx; }
  };
})();
