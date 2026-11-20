/* 行商浪人角色卡 —— 过场动画与界面动效（3.0）
 *  · 启动页（splash）：徽记 + 进度条，加载完自动淡出，点击可跳过
 *  · 步骤切换：全屏暗场 + 饰带 + 步骤名，约 0.62 秒后自动收起
 *  · HUD 数字滚动、面板依次浮现
 * 尊重系统「减少动态效果」设置，也提供界面上的一键开关（localStorage 记忆）。
 */
window.RTFX = (function () {
  const PREF = 'rt-chargen-fx';
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let pref = true;
  let stepTimer = null;

  try {
    const raw = localStorage.getItem(PREF);
    if (raw !== null) pref = raw !== '0';
  } catch (e) { /* 隐私模式 */ }

  function reduced() { return !!(mq && mq.matches); }
  function on() { return pref && !reduced(); }
  function setOn(v) {
    pref = !!v;
    try { localStorage.setItem(PREF, pref ? '1' : '0'); } catch (e) { /* 忽略 */ }
    if (pref) document.body.classList.add('fx-on'); else document.body.classList.remove('fx-on');
    if (!pref) {
      const el = document.getElementById('stepFx');
      if (el) el.classList.remove('on');
    }
    return pref;
  }

  /* ---------- 启动页 ---------- */
  function boot() {
    const el = document.getElementById('splash');
    if (!el) return;
    const noFx = /[?&]nofx=1/.test(location.search);
    let closed = false;
    function finish() {
      if (closed) return;
      closed = true;
      el.classList.add('done');
      document.body.classList.add('booted');
      setTimeout(function () { if (el.parentNode) el.style.display = 'none'; }, 1000);
    }
    document.body.classList.add('booted');
    if (!on() || noFx) { finish(); return; }
    el.addEventListener('click', finish);
    el.addEventListener('keydown', finish);
    const fallback = setTimeout(finish, 2200);           // 图片再慢也不卡住
    window.addEventListener('load', function () {
      setTimeout(function () { clearTimeout(fallback); finish(); }, 520);
    });
  }

  /* ---------- 步骤切换过场 ---------- */
  function transition(meta) {
    const el = document.getElementById('stepFx');
    if (!el || !on()) return;
    const title = el.querySelector('.stepfx-t');
    const sub = el.querySelector('.stepfx-s');
    if (title) title.textContent = (meta && meta.title) || '';
    if (sub) sub.textContent = (meta && meta.desc) || '';
    el.classList.remove('on');
    void el.offsetWidth;                                  // 强制重排，动画可重播
    el.classList.add('on');
    el.setAttribute('aria-hidden', 'false');
    clearTimeout(stepTimer);
    stepTimer = setTimeout(function () {
      el.classList.remove('on');
      el.setAttribute('aria-hidden', 'true');
    }, 660);
  }

  /* ---------- 数字滚动 ---------- */
  function countIn(el) {
    const target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    const from = parseInt(el.getAttribute('data-from') || '0', 10) || 0;
    if (!on() || from === target) { el.textContent = String(target); return; }
    const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    const dur = 520;
    function tick(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (target - from) * e));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function countAll(root) {
    const box = root || document;
    const list = box.querySelectorAll ? box.querySelectorAll('[data-count]') : [];
    for (let i = 0; i < list.length; i++) countIn(list[i]);
  }

  /* ---------- 面板依次浮现 ---------- */
  function stagger(root) {
    if (!on()) return;
    const box = root || document.getElementById('main');
    if (!box || !box.querySelectorAll) return;
    const list = box.querySelectorAll('.panel, .opdetail, .gcard, .sheet .fold, .addbar');
    for (let i = 0; i < list.length && i < 40; i++) {
      const el = list[i];
      el.style.setProperty('--i', String(i));
      el.classList.remove('fx-in');
      el.classList.add('fx-in');
    }
  }

  /* ---------- 小脉冲（购买成功、等阶提升） ---------- */
  function pulse(el, cls) {
    if (!el || !on()) return;
    const c = cls || 'fx-pulse';
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
    setTimeout(function () { el.classList.remove(c); }, 700);
  }

  return {
    boot: boot,
    transition: transition,
    countAll: countAll,
    countIn: countIn,
    stagger: stagger,
    pulse: pulse,
    enabled: function () { return pref; },
    setEnabled: setOn,
    toggle: function () { return setOn(!pref); },
    reduced: reduced,
    supported: !!(window.requestAnimationFrame)
  };
})();
