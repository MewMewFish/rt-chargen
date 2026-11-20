/* 行商浪人角色卡 —— 背景音乐（3.1）
 * 与音效模块（RTSfx）互相独立：SFX 现场合成，音乐播 assets/audio/bgm.mp3。
 * 浏览器的自动播放限制要求先有手势，所以只在点击时 play()；
 * 音量与淡入淡出走 WebAudio 的 GainNode（拿不到 AudioContext 时退回 el.volume）。
 * 曲目信息由 tools/build_bgm.py 生成到 assets/audio/bgm-meta.js（file:// 也能读）。
 */
window.RTMusic = (function () {
  const KEY = 'rt-chargen-bgm';
  const META = window.RTBgmMeta || {
    file: 'assets/audio/bgm.mp3',
    title: 'Clash of Convictions',
    artist: 'Nikolay Filipovich',
    album: '',
    durationMs: 0,
    cover: 'assets/img/bgm-cover.jpg'
  };
  const AC = window.AudioContext || window.webkitAudioContext;

  let prefs = { on: false, vol: 0.45 };
  let el = null, ctx = null, gain = null, node = null;
  let failed = false;
  const listeners = [];

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) || {};
      prefs.on = !!p.on;
      if (typeof p.vol === 'number' && p.vol >= 0 && p.vol <= 1) prefs.vol = p.vol;
    }
  } catch (e) { /* 隐私模式 */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* 忽略 */ }
  }

  function state() {
    const dur = el && isFinite(el.duration) && el.duration > 0 ? el.duration : (META.durationMs || 0) / 1000;
    return {
      on: !!prefs.on,
      playing: !!(el && !el.paused && !el.ended),
      vol: prefs.vol,
      time: el ? el.currentTime || 0 : 0,
      duration: dur,
      title: META.title,
      artist: META.artist,
      album: META.album || '',
      cover: META.cover || '',
      failed: failed
    };
  }

  function emit() {
    const st = state();
    for (let i = 0; i < listeners.length; i++) {
      try { listeners[i](st); } catch (e) { /* 忽略 */ }
    }
  }

  function ensureEl() {
    if (el || failed) return el;
    try {
      el = document.createElement('audio');
      el.id = 'rtBgm';
      el.preload = 'none';
      el.loop = true;
      el.setAttribute('aria-hidden', 'true');
      el.src = META.file;
      el.style.display = 'none';
      el.addEventListener('error', function () {
        failed = true;
        prefs.on = false;
        save();
        emit();
      });
      el.addEventListener('timeupdate', emit);
      el.addEventListener('play', emit);
      el.addEventListener('pause', emit);
      document.body.appendChild(el);
    } catch (e) {
      failed = true;
    }
    return el;
  }

  function ensureCtx() {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        gain = ctx.createGain();
        gain.gain.value = 0.0001;
        gain.connect(ctx.destination);
      } catch (e) { ctx = null; gain = null; return null; }
    }
    if (ctx.state === 'suspended' && ctx.resume) {
      try { ctx.resume(); } catch (e) { /* 忽略 */ }
    }
    return ctx;
  }

  /* 元素只能被 createMediaElementSource 包装一次，故先判断 node */
  function wire() {
    if (node || !ensureEl()) return;
    if (!ensureCtx()) return;
    try {
      node = ctx.createMediaElementSource(el);
      node.connect(gain);
    } catch (e) { node = null; }
  }

  function play() {
    if (failed || !ensureEl()) return false;
    wire();
    prefs.on = true;
    save();
    if (ctx && gain) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, prefs.vol), t + 1.5);
    } else {
      try { el.volume = prefs.vol; } catch (e) { /* 忽略 */ }
    }
    const p = el.play();
    if (p && p.catch) {
      p.catch(function () {           // 被浏览器拦下（需手势）→ 回滚状态
        prefs.on = false;
        save();
        emit();
      });
    }
    emit();
    return true;
  }

  function stop() {
    prefs.on = false;
    save();
    if (!el) { emit(); return; }
    if (ctx && gain) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      setTimeout(function () { try { el.pause(); } catch (e) { /* 忽略 */ } }, 680);
    } else {
      try { el.pause(); } catch (e) { /* 忽略 */ }
    }
    emit();
  }

  return {
    meta: META,
    available: function () { return !failed; },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    state: state,
    enabled: function () { return !!prefs.on; },
    playing: function () { return state().playing; },
    toggle: function () {
      if (prefs.on) { stop(); return false; }
      play();
      return true;
    },
    play: play,
    stop: stop,
    volume: function () { return prefs.vol; },
    setVolume: function (v) {
      v = Math.max(0, Math.min(1, +v || 0));
      prefs.vol = v;
      save();
      if (ctx && gain) {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(Math.max(0.0001, v), t + 0.02);
      } else if (el) {
        try { el.volume = v; } catch (e) { /* 忽略 */ }
      }
      emit();
    },
    /* 首次手势时若上次是开着的，续播 */
    unlock: function () {
      if (prefs.on && !failed) play();
    },
    seek: function (sec) {
      if (!el) return;
      try { el.currentTime = Math.max(0, +sec || 0); } catch (e) { /* 忽略 */ }
    }
  };
})();
