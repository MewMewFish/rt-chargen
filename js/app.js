/* 行商浪人角色卡 —— 界面逻辑（3.0：音效 / 过场动画 / 角色卡折叠） */
(function () {
  const C = window.RTCalc, R = window.RTRules, D = window.RTData;
  const KEY = 'rt-chargen-v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const d10 = () => 1 + Math.floor(Math.random() * 10);
  const d5 = () => 1 + Math.floor(Math.random() * 5);
  const d100 = () => 1 + Math.floor(Math.random() * 100);

  /* 音效 / 过场是可插拔模块：缺失时全部降级为无操作（tools/smoke.html 同样适用） */
  const sfx = name => { try { if (window.RTSfx) window.RTSfx.play(name); } catch (e) { /* 忽略 */ } };
  const FX = () => (window.RTFX && window.RTFX.enabled && window.RTFX.enabled()) ? window.RTFX : null;

  let state = load() || C.newState();
  let step = 'attr';

  /* 主题：与角色数据分开存放（换角色不重置主题） */
  const THEME_KEY = 'rt-chargen-theme';
  const THEMES = ['gothic', 'steel', 'void'];
  function applyTheme(name) {
    const t = THEMES.indexOf(name) >= 0 ? name : 'gothic';
    document.body.setAttribute('data-theme', t);
    const sel = $('#themeSel');
    if (sel) sel.value = t;
    const seg = document.querySelectorAll('#themeSeg .seg-btn');
    for (let i = 0; i < seg.length; i++) {
      seg[i].classList.toggle('on', seg[i].getAttribute('data-theme') === t);
    }
  }
  function savedTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'gothic'; } catch (e) { return 'gothic'; }
  }

  /* 页眉上的音效 / 环境音 / 动效开关与主题按钮，始终与真实状态同步 */
  function syncChrome() {
    const sfxBtn = $('#sfxBtn');
    if (sfxBtn && window.RTSfx) {
      const on = RTSfx.enabled();
      sfxBtn.classList.toggle('on', on);
      sfxBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      sfxBtn.textContent = on ? '音效' : '静音';
    }
    const ambBtn = $('#ambBtn');
    if (ambBtn && window.RTSfx) {
      const on = RTSfx.ambientEnabled();
      ambBtn.classList.toggle('on', on);
      ambBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const fxBtn = $('#fxBtn');
    if (fxBtn && window.RTFX) {
      const on = RTFX.enabled();
      fxBtn.classList.toggle('on', on);
      fxBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      fxBtn.textContent = on ? '动效' : '静态';
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 忽略隐私模式 */ }
  }
  function load() {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function commit() { save(); render(); }

  /* ---------------- 运算快照 ---------------- */
  function snapshot() {
    const attrs = C.attributes(state, D);
    const ctx = { attrs, skills: C.ownedSkills(state, D), talents: C.ownedTalents(state, D) };
    return {
      attrs, ctx,
      eff: C.originEffects(state, D),
      wounds: C.wounds(state, D, attrs),
      fate: C.fate(state, D),
      fleet: C.profit(state, D, R),
      move: C.movement(attrs),
      spent: C.spentXP(state, D),
      total: C.totalXP(state, D, R),
      rank: C.rankForTotal(R, C.totalXP(state, D, R))
    };
  }

  /* ---------------- 主渲染 ---------------- */
  function render() {
    const snap = snapshot();
    const seen = state.seen || {};
    $('#steps').innerHTML = R.CREATION_STEPS.map((s, i) => {
      const done = !!seen[s.id] && s.id !== step;
      return `<button class="step ${s.id === step ? 'on' : ''} ${done ? 'done' : ''}" data-n="${i + 1}"
        onclick="App.go('${s.id}')"><b>${s.title}</b><span>${esc(s.desc)}</span></button>`;
    }).join('');

    const views = { attr: viewAttr, origin: viewOrigin, xp: viewXP, life: viewLife, fleet: viewFleet, gear: viewGear, sheet: viewSheet };
    $('#main').innerHTML = (views[step] || viewAttr)(snap);
    $('#hud').innerHTML = hud(snap);
    syncChrome();
    save();
    if (window.RTFX) {
      try { RTFX.countAll($('#hud')); RTFX.stagger($('#main')); } catch (e) { /* 忽略 */ }
    }
  }

  /* HUD 数字：记住上一次的值，重绘时从旧值滚到新值（首次直接显示，不闪） */
  const hudPrev = {};
  function hudNum(key, val, cls) {
    const from = hudPrev[key] == null ? val : hudPrev[key];
    hudPrev[key] = val;
    return `<b${cls ? ' class="' + cls + '"' : ''} data-count="${val}" data-from="${from}">${val}</b>`;
  }

  function hud(s) {
    const a = s.attrs;
    const left = 500 - s.spent;
    const pct = Math.max(0, Math.min(100, s.spent / 5));
    return `<div class="hud-line">
      <span class="hud-title">${esc(state.meta.name || '无名探索者')}</span>
      <span class="hud-stat"><i>职业</i><b>${esc(state.origin.career || '未选')}</b></span>
      <span class="hud-stat"><i>等阶</i>${hudNum('rank', s.rank, 'accent')}</span>
      <span class="hud-stat"><i>总经验</i>${hudNum('total', s.total)}</span>
      <span class="hud-stat"><i>剩余 XP</i>${hudNum('left', left, left < 0 ? 'bad' : '')}</span>
      <span class="hud-xpbar" role="presentation"><i style="width:${pct}%"></i></span>
      <span class="hud-stat"><i>承伤</i>${hudNum('wounds', s.wounds.total)}</span>
      <span class="hud-stat"><i>命运</i>${hudNum('fate', s.fate.total)}</span>
      <span class="hud-stat"><i>利润</i>${hudNum('pf', s.fleet.pf)}</span>
      ${R.ATTRS.map(x => `<span class="hud-attr">${x.short} ${hudNum('a' + x.k, a[x.k].total)}<i>(${a[x.k].bonus})</i></span>`).join('')}
    </div>`;
  }

  /* ---------------- ① 属性 ---------------- */
  function viewAttr(s) {
    if (!state.rolled) state.rolled = {};
    const used = R.ATTRS.reduce((t, x) => t + Math.max(0, (state.base[x.k] || 0) - 25), 0);
    const left = 100 - used;
    const rows = R.ATTRS.map(x => {
      const v = s.attrs[x.k];
      let cell = '';
      if (state.attrMode === 'roll') {
        cell = `<button class="btn" onclick="App.rollAttr('${x.k}')">掷 2d10+25</button>
                <span class="dice">${state.base[x.k] ? state.base[x.k] - 25 : '—'}</span>`;
      } else if (state.attrMode === 'buy') {
        const pts = Math.max(0, Math.min(20, (state.base[x.k] || 25) - 25));
        cell = `<button class="btn sm" onclick="App.alloc('${x.k}',-1)">−</button>
                <span class="dice">${pts}</span>
                <button class="btn sm" onclick="App.alloc('${x.k}',1)">+</button>`;
      } else {
        cell = `<input class="num" type="number" min="0" max="100" value="${state.base[x.k] || 0}"
                 oninput="App.setBase('${x.k}', this.value)">`;
      }
      return `<tr>
        <td class="attr-name">${x.name}<i>${x.short}</i></td>
        <td class="attr-base">${state.base[x.k] || 0}</td>
        <td>${cell}</td>
        <td class="mod">${v.origin ? (v.origin > 0 ? '+' : '') + v.origin : ''}</td>
        <td class="mod">${v.chosen ? '+' + v.chosen : ''}</td>
        <td class="mod">${v.bought ? '+' + v.bought : ''}</td>
        <td class="attr-total">${v.total}</td>
        <td class="attr-bonus">${v.bonus}</td>
      </tr>`;
    }).join('');

    return `<h2>第一步：生成属性</h2>
      <p class="hint">每个属性 2d10+25（每项可重投 1 次，重投后必须接受）；或用 100 点分配：每项基础 25，单项最多 +20。</p>
      <div class="modes">
        ${['roll:掷骰 2d10+25', 'buy:点数分配（100 点）', 'manual:手动输入'].map(m => {
          const p = m.split(':');
          return `<label class="mode ${state.attrMode === p[0] ? 'on' : ''}">
            <input type="radio" name="amode" ${state.attrMode === p[0] ? 'checked' : ''}
              onchange="App.setMode('${p[0]}')"> ${p[1]}</label>`;
        }).join('')}
        <span class="spacer"></span>
        ${state.attrMode === 'roll' ? `<button class="btn" onclick="App.rollAll()">全部掷骰</button>` : ''}
        ${state.attrMode === 'buy' ? `<span class="left ${left < 0 ? 'bad' : ''}">剩余点数：${left}</span>` : ''}
      </div>
      <table class="grid attr-grid">
        <thead><tr><th>属性</th><th>基础</th><th>${state.attrMode === 'roll' ? '投骰' : state.attrMode === 'buy' ? '加点' : '输入'}</th>
          <th>起源</th><th>选择</th><th>经验</th><th>总值</th><th>加值</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="panel">
        <h3>速查</h3>
        <p>加值 = 属性十位数；检定目标 = 属性 ± 难度修正，掷 1d100 ≤ 目标即成功。</p>
        <p>等阶：${R.RANKS.map(r => `${r.rank}阶 ${r.min}-${r.max}`).join(' ｜ ')}</p>
      </div>`;
  }
  /* ---------------- ② 起源之路 ---------------- */
  function allowedIndexes(rowIdx) {
    if (state.originFree || rowIdx === 0) return null;
    const rows = D.origin.rows;
    const prevId = state.origin[rows[rowIdx - 1].id];
    if (!prevId) return null;
    const prevList = rows[rowIdx - 1].options;
    const pi = prevList.indexOf(prevId);
    return prevList.map((_, i) => i).filter(i => Math.abs(i - pi) <= 1);
  }

  function viewOrigin() {
    const rows = D.origin.rows;
    const grid = rows.map((row, ri) => {
      const allow = allowedIndexes(ri);
      const cards = row.options.map((id, oi) => {
        const opt = D.origin.options[id];
        const on = state.origin[row.id] === id;
        const dis = allow && !allow.includes(oi);
        return `<button class="card ${on ? 'on' : ''} ${dis ? 'dis' : ''}" ${dis ? 'disabled' : ''}
          onclick="App.pickOrigin('${row.id}','${id}')">${esc(opt ? opt.name : id)}</button>`;
      }).join('');
      return `<div class="oprow"><div class="oprow-label">${esc(row.label)}</div><div class="oprow-items">${cards}</div></div>`;
    }).join('');

    const detail = rows.map(row => {
      const id = state.origin[row.id];
      if (!id) return '';
      if (row.id === 'career') {
        const c = D.careers[id] || {};
        return `<div class="opdetail">
          <h4>职业道途：${esc(id)}</h4>
          <p><b>起始技能</b>：${esc(c.startSkills || '—')}</p>
          <p><b>起始天赋</b>：${talentListHTML(c.startTalents)}</p>
          <p><b>起始装备</b>：${esc(c.startGear || '—')}</p>
          <p class="note">属性提升方案与等阶 1-8 进阶表见第三步。</p>
        </div>`;
      }
      const opt = D.origin.options[id];
      if (!opt) return '';
      return `<div class="opdetail">
        <h4>${esc(row.label)}：${esc(opt.name)}</h4>
        ${opt.mods ? `<p><b>属性修正</b>：${Object.keys(opt.mods).map(k => k + (opt.mods[k] > 0 ? '+' : '') + opt.mods[k]).join('，')}</p>` : ''}
        ${opt.trained && opt.trained.length ? `<p><b>受训技能</b>：${opt.trained.map(skillChip).join(' ')}</p>` : ''}
        ${opt.basic && opt.basic.length ? `<p><b>视为未训练基础技能</b>：${opt.basic.map(skillChip).join(' ')}</p>` : ''}
        ${opt.talents && opt.talents.length ? `<p><b>天赋</b>：${opt.talents.map(talentChip).join(' ')}</p>` : ''}
        ${opt.notes && opt.notes.length ? `<p class="note">${opt.notes.map(esc).join('；')}</p>` : ''}
        ${opt.wounds ? `<p><b>初始承伤</b>：坚韧加值×${opt.wounds.tbMul} + ${opt.wounds.dice}${opt.wounds.flat ? ' + ' + opt.wounds.flat : ''}</p>` : ''}
        ${opt.fate ? `<p><b>初始命运点</b>：${opt.fate.map(f => '1d10 ≤ ' + f[0] + ' → ' + f[1]).join('，')}</p>` : ''}
        ${choiceUI(id, opt)}
      </div>`;
    }).join('');

    return `<h2>第二步：起源之路</h2>
      <p class="hint">从任意一端开始，之后每一行只能选择上一行所选位置的正下方或紧邻项。勾选“自由选择”可解除相邻限制（GM 放宽时使用）。</p>
      <label class="chk"><input type="checkbox" ${state.originFree ? 'checked' : ''}
        onchange="App.setOriginFree(this.checked)"> 自由选择（不限制相邻）</label>
      <div class="opgrid">${grid}</div>
      <div class="details">${detail || '<p class="hint">尚未选择任何起源。</p>'}</div>`;
  }

  function choiceUI(optId, fx) {
    if (!fx.choices || !fx.choices.length) return '';
    const sel = state.choices[optId] || (state.choices[optId] = {});
    return fx.choices.map(ch => {
      const cur = sel[ch.key] || '';
      const opts = (ch.options || []).map(o => (typeof o === 'string' ? o : o.label));
      let html = `<div class="choice">
        <label>${esc(ch.label)}</label>
        <select onchange="App.setChoice('${optId}','${ch.key}', this.value)">
          <option value="">— 请选择 —</option>
          ${opts.map(o => `<option ${cur === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        </select>
        ${ch.kind === 'skill' ? `<input class="txt" placeholder="或手动填写技能名" value="${esc(opts.includes(cur) ? '' : cur)}"
            onchange="App.setChoice('${optId}','${ch.key}', this.value)">` : ''}
      </div>`;
      if (ch.kind === 'variant') {
        const pick = (ch.options || []).find(o => o.label === cur);
        ((pick && pick.subChoices) || []).forEach(sc => {
          const scv = sel[sc.key] || '';
          const so = (sc.options || []).map(o => (typeof o === 'string' ? o : o.label));
          html += `<div class="choice sub"><label>${esc(sc.label)}</label>
            <select onchange="App.setChoice('${optId}','${sc.key}', this.value)">
              <option value="">— 请选择 —</option>
              ${so.map(o => `<option ${scv === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select></div>`;
        });
      }
      return html;
    }).join('');
  }


  /* ---------------- ③ 职业与经验 ---------------- */
  function careerList() { return Object.keys(D.careers); }

  function viewXP(s) {
    const name = state.origin.career;
    const bar = `<div class="career-bar">${careerList().map(n =>
      `<button class="chip ${n === name ? 'on' : ''}" onclick="App.pickCareer('${n}')">${n}</button>`).join('')}</div>`;
    const head = `<h2>第三步：职业道途与经验</h2>
      <p class="hint">起始 4,500 XP 代表角色已有的能力，另有 <b>500 XP</b> 可自由花费；花费总额决定等阶（表2-2）。</p>${bar}`;
    if (!name || !D.careers[name]) return head + `<p class="hint">请先选择一条职业道途。</p>`;

    const career = D.careers[name];
    const left = 500 - s.spent;
    const sum = `<div class="panel xp-panel">
      <h3>${esc(name)}</h3>
      <p>已花 <b class="${left < 0 ? 'bad' : ''}">${s.spent}</b> / 500 XP　剩余 <b>${left}</b>　总经验 <b>${s.total}</b>　当前 <b>等阶 ${s.rank}</b></p>
      <p class="hint">起始技能：${esc(career.startSkills || '—')}</p>
      <p class="hint">起始天赋：${talentListHTML(career.startTalents)}</p>
      <p class="hint">起始装备：${esc(career.startGear || '—')}</p>
    </div>`;

    const attrRows = R.ATTRS.map(x => {
      const plan = career.attrPlan[x.k] || [];
      const bought = state.purchases.attrs[x.k] || 0;
      const cells = plan.map((cost, i) => {
        const done = i < bought;
        const can = i === bought && s.spent + cost <= 500;
        return `<td><button class="btn sm ${done ? 'done' : ''}" ${done || !can ? 'disabled' : ''}
          onclick="App.buyAttr('${x.k}',${i})">${R.XP.TIERS[i]}<i>${cost}</i></button></td>`;
      }).join('');
      return `<tr><td>${x.name}</td><td>${s.attrs[x.k].total}</td>${cells}
        <td><button class="btn sm" ${bought ? '' : 'disabled'} onclick="App.undoAttr('${x.k}')">撤销</button></td></tr>`;
    }).join('');

    const tabs = R.RANKS.map(r => {
      const unlocked = r.rank <= s.rank;
      const on = (state.xpTab || s.rank) === r.rank;
      return `<button class="chip ${on ? 'on' : ''} ${unlocked ? '' : 'dis'}" ${unlocked ? '' : 'disabled'}
        onclick="App.setXpTab(${r.rank})">等阶 ${r.rank}</button>`;
    }).join('');

    const tab = state.xpTab || s.rank;
    const rows = (career.ranks[String(tab)] || []);
    const rowHTML = rows.map((row, idx) => {
      const key = tab + '|' + idx;
      const n = state.purchases.rows[key] || 0;
      const mm = row.n.match(/[（(][xX×](\d)[)）]/);
      const mul = mm ? +mm[1] : 1;
      const pre = row.p ? C.checkPrereq(row.p, s.ctx) : { ok: true, items: [] };
      const can = n < mul && pre.ok && s.spent + row.c <= 500;
      const badges = pre.items.map(i => `<span class="badge ${i.ok ? 'ok' : 'no'}">${esc(i.text)}</span>`).join('');
      return `<tr class="${pre.ok ? '' : 'unmet'}">
        <td>${row.t === '技能' ? skillRef(row.n) : row.t === '天赋' ? talentChip(row.n) : esc(row.n)}${n ? ` <span class="got">已购×${n}</span>` : ''}</td>
        <td>${row.c}</td>
        <td>${row.t}</td>
        <td>${badges || '—'}</td>
        <td><button class="btn sm" ${can ? '' : 'disabled'} onclick="App.buyRow(${tab},${idx})">购买</button></td>
        <td><button class="btn sm" ${n ? '' : 'disabled'} onclick="App.undoRow(${tab},${idx})">撤销</button></td>
      </tr>`;
    }).join('');

    return `${head}${sum}
      <div class="panel">
        <h3>属性提升（每次 +5，须按 青涩→中级→受训→专家 依次购买）</h3>
        <table class="grid small">
          <thead><tr><th>属性</th><th>当前</th>${R.XP.TIERS.map(t => `<th>${t}</th>`).join('')}<th></th></tr></thead>
          <tbody>${attrRows}</tbody>
        </table>
      </div>
      <div class="panel">
        <h3>等阶进阶方案</h3>
        <div class="chips">${tabs}</div>
        <p class="hint">只能从当前或曾经达到过的等阶中购买。<span class="got">已购×n</span> 上限来自表内的 (X2) 标记。</p>
        <table class="grid small">
          <thead><tr><th>提升</th><th>花费</th><th>类型</th><th>前置条件</th><th></th><th></th></tr></thead>
          <tbody>${rowHTML || '<tr><td colspan="6">本等阶无数据</td></tr>'}</tbody>
        </table>
      </div>
      <div class="panel">
        <h3>天赋速查 <span class="hint">全书 ${talentList.length} 条 · 悬停看摘要，点击看全文</span></h3>
        <div class="addbar">
          <input id="talentSearch" placeholder="搜索天赋名称 / 效果 / 组别" value="${esc(state.talentQuery || '')}"
            oninput="App.filterTalents(this.value)">
          <button class="btn sm" onclick="App.filterTalents('')">清空</button>
        </div>
        <div id="talentList" class="chips">${talentChipsHTML(state.talentQuery)}</div>
      </div>`;
  }
  /* ---------------- ④ 赐角色以生命 ---------------- */
  function viewLife(s) {
    const m = state.meta;
    const f = (k, label, ph, tag) => `<label class="field"><span>${label}</span>
      ${tag === 'area'
        ? `<textarea oninput="App.setMeta('${k}', this.value)" placeholder="${esc(ph)}">${esc(m[k] || '')}</textarea>`
        : `<input value="${esc(m[k] || '')}" placeholder="${esc(ph)}" oninput="App.setMeta('${k}', this.value)">`}
      </label>`;
    return `<h2>第四步：赐角色以生命</h2>
      <p class="hint">第41个千年的名字没有统一规范：原始名、低哥特语名、高哥特语名、古体名、非正式名（绰号）都可以混搭（表1-3 / 1-4）。</p>
      <div class="fields">
        ${f('name', '姓名', '例如：杨·凡·雅斯托巴尔')}
        ${f('player', '玩家', '')}
        ${f('gender', '性别', '')}
        ${f('age', '年龄', '')}
        ${f('appearance', '外貌与气质', '伤疤、机械义体、虚空苍白…', 'area')}
        ${f('motivation', '动机与野心', '财富？复仇？地位？（第五行“动机”已定方向）', 'area')}
        ${f('enemies', '敌人与羁绊', '家族世仇、宿敌、欠下的人情…', 'area')}
      </div>
      <div class="panel">
        <h3>起源摘要</h3>
        <ul>${D.origin.rows.map(r => {
          const id = state.origin[r.id];
          const nm = r.id === 'career' ? id : (D.origin.options[id] ? D.origin.options[id].name : '');
          return `<li>${esc(r.label)}：<b>${esc(nm || '—')}</b></li>`;
        }).join('')}</ul>
        ${(s.eff.notes || []).length ? `<p class="note">${s.eff.notes.map(esc).join('<br>')}</p>` : ''}
      </div>`;
  }

  /* ---------------- ⑤ 利润因子与舰船点 ---------------- */
  function viewFleet(s) {
    const f = s.fleet;
    return `<h2>第五步：利润因子与舰船点</h2>
      <p class="hint">团队掷 1d10 查表 1-5；起源之路的部分选择会修正利润因子；未花掉的舰船点按 1:1 转为利润因子。</p>
      <div class="panel">
        <div class="rolls">
          <button class="btn" onclick="App.rollProfit()">掷 1d10</button>
          <span class="dice big">${state.rolls.profit}</span>
          <label class="field inline"><span>手动</span>
            <input type="number" min="1" max="10" value="${state.rolls.profit}" onchange="App.setProfit(this.value)"></label>
        </div>
        <table class="grid small">
          <thead><tr><th>骰子结果</th><th>利润因子</th><th>舰船点</th></tr></thead>
          <tbody>${R.PROFIT_TABLE.map(r => `<tr class="${(Array.isArray(r.roll) ? r.roll[0] <= f.roll && f.roll <= r.roll[1] : r.roll === f.roll) ? 'hl' : ''}">
            <td>${Array.isArray(r.roll) ? r.roll[0] + '-' + r.roll[1] : r.roll}</td><td>${r.pf}</td><td>${r.sp}</td></tr>`).join('')}</tbody>
        </table>
        <p>基础利润因子 <b>${f.basePF}</b>，起源修正 <b>${f.originProfit >= 0 ? '+' : ''}${f.originProfit}</b>，舰船点兑入 <b>+${f.spSpent}</b>
           → 最终利润因子 <b class="big-num">${f.pf}</b></p>
        <p>舰船点：基础 <b>${f.baseSP}</b>，已用 <b>${f.spSpent}</b>，剩余 <b>${f.sp}</b>
          <label class="field inline"><span>已花舰船点</span>
            <input type="number" min="0" max="${f.baseSP}" value="${f.spSpent}" onchange="App.setShipSpent(this.value)"></label></p>
        <p class="hint">星舰的船体与部件消耗舰船点，详见第八章：星舰（本工具暂不内置船体清单）。</p>
      </div>`;
  }


  /* ---------------- 装备 / 技能 通用组件 ---------------- */
  const GEAR_CATS = ['远程', '近战', '异种武器', '手雷/导弹', '护甲', '弹药', '武器升级', '装备', '药品', '工具', '植入物'];
  const gearIndex = (() => { const m = {}; (D.gear || []).forEach(g => { m[g.id] = g; }); return m; })();
  const skillIndex = (() => { const m = {}; (D.skills || []).forEach(s => { m[s.name] = s; }); return m; })();
  const traitIndex = D.traits || {};
  const talentList = D.talents || [];
  const talentIndex = (() => {
    const m = {};
    talentList.forEach(t => {
      m[t.name] = t;
      (t.alias || []).forEach(a => { if (!m[a]) m[a] = t; });   // 书中混写归位
    });
    return m;
  })();

  function chip(kind, name) {
    const has = kind === 'skill' ? skillIndex[name]
      : kind === 'talent' ? talentIndex[name] : traitIndex[name];
    return `<span class="chip xs${has ? ' has' : ''}" data-${kind}="${esc(name)}">${esc(name)}</span>`;
  }
  const skillChip = n => (skillIndex[n] ? chip('skill', n) : `<span class="chip xs">${esc(n)}</span>`);
  const traitChip = n => chip('trait', n);

  /* 天赋：职业表里的写法（†、计数、括注、前缀组别）归一到词典条目 */
  function talentChip(text) {
    const key = C.talentKey(text, talentIndex);
    if (!key) return `<span class="chip xs">${esc(text)}</span>`;
    const rec = talentIndex[key];
    const name = rec && rec.name ? rec.name : key;
    return `<span class="chip xs has" data-talent="${esc(name)}">${esc(text)}</span>`;
  }
  function talentListHTML(text) {
    const parts = String(text == null ? '' : text).split(/[、，,；;]/).map(x => x.trim()).filter(Boolean);
    return parts.length ? parts.map(talentChip).join(' ') : '—';
  }
  function talentChipsHTML(q) {
    const kw = String(q == null ? '' : q).trim();
    const list = kw
      ? talentList.filter(t => (t.name + (t.effect || '') + (t.desc || '') + (t.group || '')).indexOf(kw) >= 0)
      : talentList;
    if (!list.length) return '<span class="hint">没有匹配的天赋。</span>';
    return list.map(t => `<span class="chip xs has" data-talent="${esc(t.name)}">${esc(t.name)}</span>`).join('');
  }

  /* 形如「魅力+20」「口语（高哥特语）」的文本：仍指回基础技能 */
  function skillRef(text) {
    if (skillIndex[text]) return chip('skill', text);
    const base = C.skillLevel(text).base;
    if (skillIndex[base]) {
      return `<span class="chip xs has" data-skill="${esc(base)}">${esc(text)}</span>`;
    }
    return esc(text);
  }

  function rarityText(g) {
    if (g.rarity) return `${g.rarity.label}${g.rarity.mod >= 0 ? '+' : ''}${g.rarity.mod}`;
    return '—';
  }

  function gearStats(g) {
    const p = [];
    if (g.class) p.push(g.class);
    if (g.range && g.range !== '—') p.push('射程 ' + g.range);
    if (g.rof && g.rof !== '—') p.push('射速 ' + g.rof);
    if (g.dmg) p.push('伤害 ' + g.dmg);
    if (g.pen && g.pen !== '—') p.push('穿甲 ' + g.pen);
    if (g.clip && g.clip !== '—') p.push('弹容 ' + g.clip);
    if (g.reload) p.push('装填 ' + g.reload.n + g.reload.action);
    if (g.cover) p.push('覆盖 ' + g.cover);
    if (g.ap) p.push('AP ' + g.ap);
    return p.join(' · ');
  }

  function gearCard(g) {
    const wt = g.wt == null ? '—' : (typeof g.wt === 'number' ? g.wt + ' kg' : g.wt);
    return `<div class="gcard" data-gear="${g.id}">
      <div class="ghead"><span class="gname">${esc(g.label || g.name)}</span>
        <button class="btn sm add" onclick="event.stopPropagation();App.addGearItem('${g.id}')">加入</button></div>
      <div class="gstats">${esc(gearStats(g))}</div>
      <div class="gfoot"><span class="gw">${esc(wt)}</span><span class="grar">${esc(rarityText(g))}</span></div>
      ${(g.traits || []).length ? `<div class="gtraits">${g.traits.map(traitChip).join('')}</div>` : ''}
      ${g.note ? `<div class="gnote">${esc(g.note)}</div>` : ''}
    </div>`;
  }

  /* ---------------- 详情抽屉 / 悬浮说明 ---------------- */
  function skillHTML(name) {
    const s = skillIndex[name] || {};
    return `<h3>技能 · ${esc(name)}
        ${s.type ? `<span class="tag">${esc(s.type)}</span>` : ''}
        ${s.attr ? `<span class="tag">${esc(s.attr)}</span>` : ''}
        ${s.cat && s.cat !== '—' ? `<span class="tag">${esc(s.cat)}</span>` : ''}</h3>
      ${s.desc ? `<p>${esc(s.desc)}</p>` : '<p class="hint">本工具未收录该技能说明。</p>'}
      ${s.groups ? `<p><b>技能组</b>：${esc(s.groups)}</p>` : ''}
      ${s.uses ? `<p><b>技能使用</b>：${esc(s.uses)}</p>` : ''}
      ${(s.special || []).map(sp => `<p><b>特别用法 · ${esc(sp.name)}</b>：${esc(sp.desc)}</p>`).join('')}
      ${s.page ? `<p class="note">规则书 P${s.page}（第三章：技能）</p>` : ''}`;
  }

  function traitHTML(name) {
    const t = traitIndex[name];
    return `<h3>武器特性 · ${esc(name)}</h3>
      ${t ? `<p>${esc(t.desc)}</p><p class="note">规则书 P${t.page}（第五章：武器特性）</p>`
          : '<p class="hint">规则书未单列该特性的说明，效果见对应武器条目。</p>'}`;
  }

  function gearHTML(id) {
    const g = gearIndex[id];
    if (!g) return '<p class="hint">未找到该装备。</p>';
    const wt = g.wt == null ? '—' : (typeof g.wt === 'number' ? g.wt + ' kg' : g.wt);
    return `<h3>${esc(g.label || g.name)} <span class="tag">${esc(g.cat)}</span>
        ${g.group ? `<span class="tag">${esc(g.group)}</span>` : ''}</h3>
      <p>${esc(gearStats(g)) || '—'}</p>
      <p><b>重量</b>：${esc(wt)}　<b>稀有度</b>：${esc(rarityText(g))}</p>
      ${(g.traits || []).length ? `<p><b>特性</b>：${g.traits.map(traitChip).join('')}</p>` : ''}
      ${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}
      <p class="note">${esc(g.table || '')}　P${g.page}</p>
      <p><button class="btn sm" onclick="App.addGearItem('${g.id}')">加入清单</button>
         <button class="btn sm" onclick="App.acquireItem('${g.id}')">收购检定</button></p>`;
  }

  function talentHTML(name) {
    const t = talentIndex[name];
    if (!t) {
      return `<h3>天赋 · ${esc(name)}</h3>
        <p class="hint">本工具未收录该天赋的独立条目：它可能是天赋组的具体组别，或是角色自定天赋。</p>`;
    }
    return `<h3>天赋 · ${esc(t.name)}${t.isGroup ? '<span class="tag">天赋组</span>' : ''}</h3>
      <p>${esc(t.desc)}</p>
      ${t.effect ? `<p class="note">简表效果：${esc(t.effect)}</p>` : ''}
      ${t.group ? `<p><b>可选组别</b>：${esc(t.group)}</p>` : ''}
      ${t.prereq ? `<p><b>获取前提</b>：${esc(t.prereq)}</p>` : ''}
      ${(t.special || []).map(x => `<p><b>特殊</b>：${esc(x)}</p>`).join('')}
      ${t.page ? `<p class="note">规则书 P${t.page}（第四章：天赋）</p>` : ''}`;
  }

  function detailHTML(kind, key) {
    if (kind === 'skill') return skillHTML(key);
    if (kind === 'trait') return traitHTML(key);
    if (kind === 'talent') return talentHTML(key);
    return gearHTML(key);
  }

  function openDetail(kind, key) {
    const el = $('#drawer');
    if (!el || !key) return;
    el.innerHTML = `<button class="drawer-x" onclick="App.closeDrawer()" aria-label="关闭">×</button>
      <div class="drawer-body">${detailHTML(kind, key)}</div>`;
    el.classList.add('on');
    document.body.classList.add('drawer-open');
    sfx('open');
  }

  let tipTimer = null;

  function showTip(el) {
    const tip = $('#tip');
    if (!tip) return;
    const skill = el.getAttribute('data-skill');
    const trait = el.getAttribute('data-trait');
    const talent = el.getAttribute('data-talent');
    const gear = el.getAttribute('data-gear');
    let body = '';
    const title = skill || trait || talent ||
      (gearIndex[gear] ? (gearIndex[gear].label || gearIndex[gear].name) : '');
    if (skill && skillIndex[skill]) body = (skillIndex[skill].desc || '').slice(0, 120);
    if (trait && traitIndex[trait]) body = (traitIndex[trait].desc || '').slice(0, 120);
    if (talent && talentIndex[talent]) {
      body = (talentIndex[talent].desc || talentIndex[talent].effect || '').slice(0, 120);
    }
    if (gear && gearIndex[gear]) body = gearStats(gearIndex[gear]);
    if (!title) return;
    tip.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}${body ? '…' : ''}</span>
      <i>点击查看完整说明</i>`;
    const r = el.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - 320, Math.max(8, r.left)) + 'px';
    tip.style.top = (r.bottom + 8) + 'px';
    tip.classList.add('on');
  }

  function hideTip() {
    const tip = $('#tip');
    if (tip) tip.classList.remove('on');
  }


  function viewGear(s) {
    const career = D.careers[state.origin.career] || {};
    const f = state.gearFilter || (state.gearFilter = { cat: '远程', q: '' });

    /* 已选清单 */
    let totalWt = 0, totalQty = 0;
    const rows = state.gear.map((g, i) => {
      const ref = g.id ? gearIndex[g.id] : null;
      const unit = ref && typeof ref.wt === 'number' ? ref.wt : 0;
      const qty = g.qty || 1;
      totalWt += unit * qty;
      totalQty += qty;
      return `<div class="gsel-row">
        <div class="gsel-top">
          <span class="gsel-name">${ref ? `<span class="lnk" data-gear="${ref.id}">${esc(g.name)}</span>` : esc(g.name)}</span>
          <span class="gsel-meta">${unit ? (unit * qty).toFixed(1) + ' kg' : '—'}　${ref ? esc(rarityText(ref)) : '—'}</span>
        </div>
        ${ref ? `<div class="gsel-meta">${esc(gearStats(ref))}</div>` : ''}
        <div class="gsel-ctl">
          <button class="btn sm" onclick="App.gearQty(${i},-1)">−</button>
          <b>${qty}</b>
          <button class="btn sm" onclick="App.gearQty(${i},1)">+</button>
          <span class="spacer"></span>
          <button class="btn sm" ${ref ? `onclick="App.acquireItem('${ref.id}')"` : 'disabled'}>收购</button>
          <button class="btn sm danger" onclick="App.delGear(${i})">删除</button>
        </div>
        <input class="txt sm" value="${esc(g.note || '')}" placeholder="工艺 / 备注"
             onchange="App.setGearNote(${i}, this.value)">
      </div>`;
    }).join('');

    /* 库内筛选 */
    const q = (f.q || '').trim();
    const pool = (D.gear || []).filter(g => {
      if (f.cat && f.cat !== '全部' && g.cat !== f.cat) return false;
      if (!q) return true;
      const hay = [g.label, g.name, g.group, gearStats(g), (g.traits || []).join(' ')].join(' ');
      return hay.indexOf(q) >= 0;
    });
    const shown = pool.slice(0, 150);

    const cats = ['全部'].concat(GEAR_CATS).map(c =>
      `<button class="chip ${f.cat === c ? 'on' : ''}" onclick="App.setGearFilter({cat:'${c}'})">${c}</button>`).join('');
    const cards = shown.map(gearCard).join('') ||
      '<p class="hint">没有匹配的装备，换个关键词或分类试试。</p>';

    return `<h2>第六步：选择装备</h2>
      <p class="hint">军械库取自核心规则书第五章（P172-226）：远程武器 48 种、近战 26 种、异种武器 15 种、手榴弹与导弹 14 种、护甲 20 种、弹药 28 种、武器升级 15 种、装备 20 种、药品 15 种、工具 37 种、赛博植入物 26 种。点击卡片加入清单，点特性标签看规则说明。</p>
      <div class="panel">
        <h3>职业起始装备</h3>
        <p>${esc(career.startGear || '（未选职业）')}</p>
        <p class="hint">起始技能：${esc(career.startSkills || '—')}</p>
        <p class="hint">起始天赋：${talentListHTML(career.startTalents)}</p>
      </div>

      <div class="gear-layout">
        <div class="panel gear-browser">
          <h3>装备库 <span class="hint">（${pool.length} 件${pool.length > shown.length ? '，显示前 ' + shown.length + ' 件' : ''}）</span></h3>
          <div class="addbar">
            <input id="gearSearch" class="txt grow" value="${esc(f.q || '')}" placeholder="搜索名称 / 特性（如：爆弹、撕裂、甲壳）"
                   oninput="App.setGearFilter({q:this.value}, true)">
          </div>
          <div class="chips">${cats}</div>
          <div class="gear-grid">${cards}</div>
        </div>

        <div class="panel gear-selected">
          <h3>已选装备 <span class="hint">${totalQty} 件 · ${totalWt.toFixed(1)} kg</span></h3>
          <div class="addbar">
            <input id="gearName" placeholder="自定义物品名">
            <input id="gearNote" placeholder="备注">
            <button class="btn" onclick="App.addGear()">添加</button>
          </div>
          <div class="gsel">${rows || '<p class="hint">尚无装备，从左侧装备库点选。</p>'}</div>
          <p class="hint">负重合计仅供参考：核心规则书未给出统一负重上限，是否使用负重规则由 GM 决定。</p>
        </div>
      </div>

      <div class="panel">
        <h3>收购检定计算器</h3>
        <p>目标值 = 利润因子（${s.fleet.pf}）+ 稀有度修正 + 其他修正；掷 1d100 ≤ 目标即成功（P271 收购规则）。</p>
        <div class="addbar">
          <label class="field inline"><span>稀有度修正</span><input id="rarityMod" type="number" value="0"></label>
          <label class="field inline"><span>其他修正</span><input id="otherMod" type="number" value="0"></label>
          <button class="btn" onclick="App.acquire()">掷 1d100</button>
          <span id="acqName" class="hint"></span>
        </div>
        <p id="acqResult" class="big-num"></p>
      </div>`;
  }

  /* ---------------- ⑦ 角色卡 ---------------- */
  function viewSheet(s) {
    const a = s.attrs, w = s.wounds, fo = s.fate, mv = s.move;
    const attrCells = R.ATTRS.map(x => `<div class="sa">
        <div class="sa-name">${x.name}</div>
        <div class="sa-val">${a[x.k].total}<sup>${a[x.k].bonus}</sup></div></div>`).join('');
    const skills = Object.keys(s.ctx.skills).sort();
    const talents = Object.keys(s.ctx.talents).sort();
    const career = D.careers[state.origin.career] || {};

    /* 技能 / 天赋：默认只显示标签，可一键展开全书说明（打印时自动展开） */
    state.ui = state.ui || {};
    const skillOpen = !!state.ui.expandSkills;
    const talentOpen = !!state.ui.expandTalents;

    const skillItems = skills.map(n => {
      const rec = skillIndex[n] || {};
      const lv = s.ctx.skills[n];
      const lvTag = lv > 1 ? `<span class="fit-tag">${lv === 2 ? '+10' : '+20'}</span>` : '';
      const tags = [rec.type, rec.attr].filter(Boolean)
        .map(t => `<span class="fit-tag">${esc(t)}</span>`).join('');
      return `<div class="fit"><span class="fit-name">${esc(n)}</span>${lvTag}${tags}
        <p>${esc(rec.desc || '本工具未收录该技能说明。')}</p>
        ${rec.uses ? `<p class="fit-note">技能使用：${esc(rec.uses)}</p>` : ''}
        ${rec.page ? `<p class="fit-note">规则书 P${rec.page}（第三章：技能）</p>` : ''}</div>`;
    }).join('') || '<p class="fit-note">尚无受训技能。</p>';

    const talentItems = talents.map(n => {
      const rec = talentIndex[n] || {};
      return `<div class="fit"><span class="fit-name">${esc(rec.name || n)}</span>
        ${rec.isGroup ? '<span class="fit-tag">天赋组</span>' : ''}
        <p>${esc(rec.desc || '本工具未收录该天赋的独立条目：它可能是天赋组的具体组别，或角色自定天赋。')}</p>
        ${rec.effect ? `<p class="fit-note">简表效果：${esc(rec.effect)}</p>` : ''}
        ${rec.prereq ? `<p class="fit-note">获取前提：${esc(rec.prereq)}</p>` : ''}
        ${rec.page ? `<p class="fit-note">规则书 P${rec.page}（第四章：天赋）</p>` : ''}</div>`;
    }).join('') || '<p class="fit-note">尚无天赋。</p>';

    function foldHead(kind, label, count, open, hint) {
      return `<div class="fold-head">
        <h4>${label}<span class="fold-count">${count} 项</span>${hint ? `<span class="fit-tag">${hint}</span>` : ''}</h4>
        <div class="fold-tools">
          <button class="btn ${open ? 'on' : ''}" onclick="App.expandSheet('${kind}', true)">全部展开</button>
          <button class="btn ${open ? '' : 'on'}" onclick="App.expandSheet('${kind}', false)">仅标签</button>
        </div>
      </div>`;
    }
    return `<h2>角色卡</h2>
      <div class="sheet-tools">
        <button class="btn sm" onclick="App.expandSheet('all', true)">展开技能与天赋全文</button>
        <button class="btn sm" onclick="App.expandSheet('all', false)">收起为标签</button>
        <span class="hint">受训技能与天赋默认只显示标签；展开后可通读说明，打印时自动展开。</span>
      </div>
      <div class="sheet" id="sheet">
        <div class="sheet-head">
          <div><span class="lbl">姓名</span><b>${esc(state.meta.name || '—')}</b></div>
          <div><span class="lbl">职业</span><b>${esc(state.origin.career || '—')}</b></div>
          <div><span class="lbl">等阶</span><b>${s.rank}</b></div>
          <div><span class="lbl">总经验</span><b>${s.total}</b></div>
          <div><span class="lbl">玩家</span><b>${esc(state.meta.player || '—')}</b></div>
        </div>
        <div class="sheet-attrs">${attrCells}</div>
        <div class="sheet-row">
          <div class="box"><span class="lbl">承伤</span><b>${w.total}</b><i>${w.fromT}+${w.dice}+${w.flat}</i></div>
          <div class="box"><span class="lbl">命运点</span><b>${fo.total}</b><i>1d10=${fo.roll}→${fo.table}</i></div>
          <div class="box"><span class="lbl">移动</span><b>${mv.half}/${mv.full}/${mv.charge}/${mv.run}</b><i>半/全/冲锋/奔跑</i></div>
          <div class="box"><span class="lbl">利润因子</span><b>${s.fleet.pf}</b></div>
          <div class="box"><span class="lbl">舰船点</span><b>${s.fleet.sp}</b></div>
          <div class="box"><span class="lbl">腐化/错乱</span><b>${state.manuals.corruption}/${state.manuals.insanity}</b></div>
        </div>
        <div class="sheet-cols">
          <div>
            <h4>起源之路</h4>
            <ul>${D.origin.rows.map(r => {
              const id = state.origin[r.id];
              const nm = r.id === 'career' ? id : (D.origin.options[id] ? D.origin.options[id].name : '');
              return `<li>${esc(r.label)}：${esc(nm || '—')}</li>`;
            }).join('')}</ul>
            <h4>视为未训练的基础技能</h4>
            <p class="wrap">${(s.eff.basic || []).length ? s.eff.basic.map(esc).join('、') : '—'}</p>
          </div>
          <div>
            <h4>装备</h4>
            <p class="wrap">${state.gear.length ? state.gear.map(g => esc(g.name)).join('、') : esc(career.startGear || '—')}</p>
            <h4>起源特质与限制</h4>
            <p class="note">${(s.eff.notes || []).map(esc).join('<br>') || '—'}</p>
            <h4>备注</h4>
            <p class="wrap">${esc(state.manuals.notes || '—')}</p>
          </div>
        </div>
        <div class="fold ${skillOpen ? 'open' : ''}" id="foldSkills">
          ${foldHead('skills', '技能（受训）', skills.length, skillOpen, '点标签看单条说明')}
          <p class="wrap">${skills.length ? skills.map(n => skillChip(n) + (s.ctx.skills[n] > 1 ? '<b class="got">+' + (s.ctx.skills[n] === 2 ? 10 : 20) + '</b>' : '')).join(' ') : '—'}</p>
          <div class="fold-body">${skillItems}</div>
        </div>
        <div class="fold ${talentOpen ? 'open' : ''}" id="foldTalents">
          ${foldHead('talents', '天赋', talents.length, talentOpen, '点标签看单条说明')}
          <p class="wrap">${talents.length ? talents.map(talentChip).join(' ') : '—'}</p>
          <div class="fold-body">${talentItems}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick="window.print()">打印 / 存为 PDF</button>
        <button class="btn" onclick="App.exportJSON()">导出 JSON</button>
        <button class="btn" onclick="document.getElementById('importFile').click()">导入 JSON</button>
        <input id="importFile" type="file" accept=".json" style="display:none" onchange="App.importJSON(this)">
        <button class="btn danger" onclick="App.reset()">清空重来</button>
      </div>
      <div class="panel">
        <h3>手工补充</h3>
        <div class="addbar">
          <label class="field inline"><span>承伤修正</span><input type="number" value="${state.manuals.woundsBonus}" onchange="App.setManual('woundsBonus', this.value)"></label>
          <label class="field inline"><span>命运点修正</span><input type="number" value="${state.manuals.fateBonus}" onchange="App.setManual('fateBonus', this.value)"></label>
          <label class="field inline"><span>腐化</span><input type="number" value="${state.manuals.corruption}" onchange="App.setManual('corruption', this.value)"></label>
          <label class="field inline"><span>错乱</span><input type="number" value="${state.manuals.insanity}" onchange="App.setManual('insanity', this.value)"></label>
        </div>
        <textarea placeholder="备注、家臣、载具、特殊规则…" oninput="App.setManual('notes', this.value)">${esc(state.manuals.notes || '')}</textarea>
      </div>`;
  }


  /* ---------------- 交互 ---------------- */
  function rebuildOwned() {
    const career = D.careers[state.origin.career];
    state.purchases.skills = {};
    state.purchases.talents = {};
    if (!career) return;
    Object.keys(state.purchases.rows).forEach(key => {
      const p = key.split('|');
      const row = (career.ranks[p[0]] || [])[+p[1]];
      if (!row) return;
      const n = state.purchases.rows[key] || 0;
      for (let i = 0; i < n; i++) {
        if (row.t === '技能') {
          const lv = C.skillLevel(row.n);
          state.purchases.skills[lv.base] = Math.max(state.purchases.skills[lv.base] || 0, lv.level);
        } else {
          state.purchases.talents[row.n] = true;
        }
      }
    });
  }

  const App = {
    go(id) {
      if (id === step) { render(); return; }
      const meta = R.CREATION_STEPS.filter(s => s.id === id)[0] || { title: '角色卡', desc: '' };
      step = id;
      state.seen = state.seen || {};
      state.seen[id] = 1;
      sfx('page');
      render();
      if (FX()) FX().transition(meta);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    },

    /* 属性 */
    setMode(m) {
      state.attrMode = m;
      if (m === 'buy') R.ATTRS.forEach(x => { if (!state.base[x.k]) state.base[x.k] = 25; });
      commit();
    },
    rollAttr(k) {
      if ((state.rolled[k] || 0) >= 2 && !confirm('该属性已重投过一次，规则上不允许再重投。仍要重掷吗？')) return;
      sfx('dice');
      state.base[k] = 2 * d10() + 25;
      state.rolled[k] = (state.rolled[k] || 0) + 1;
      commit();
    },
    rollAll() { sfx('dice'); R.ATTRS.forEach(x => { state.base[x.k] = 2 * d10() + 25; state.rolled[x.k] = 1; }); commit(); },
    alloc(k, d) {
      const cur = state.base[k] || 25;
      const used = R.ATTRS.reduce((t, x) => t + Math.max(0, (state.base[x.k] || 25) - 25), 0);
      if (d > 0 && used + 1 > 100) { sfx('error'); alert('100 点已经分配完了'); return; }
      sfx('click');
      state.base[k] = Math.max(25, Math.min(45, cur + d));
      commit();
    },
    setBase(k, v) { state.base[k] = Math.max(0, Math.min(100, +v || 0)); commit(); },

    /* 起源 */
    pickOrigin(rowId, id) {
      state.origin[rowId] = (state.origin[rowId] === id) ? '' : id;
      if (rowId === 'career') { state.origin.career = state.origin[rowId] || ''; state.xpTab = 1; }
      sfx('click');
      commit();
    },
    setOriginFree(v) { sfx('click'); state.originFree = !!v; commit(); },
    setChoice(optId, key, val) {
      state.choices[optId] = state.choices[optId] || {};
      state.choices[optId][key] = val;
      sfx('click');
      commit();
    }
  };

  Object.assign(App, {
    /* 职业与经验 */
    pickCareer(name) {
      state.origin.career = name;
      state.origin['career'] = name;
      state.xpTab = 1;
      sfx('click');
      rebuildOwned();
      commit();
    },
    setXpTab(r) { sfx('click'); state.xpTab = r; commit(); },
    /* 天赋速查：只重绘列表，避免输入框失焦 */
    filterTalents(q) {
      state.talentQuery = q || '';
      save();
      if (step !== 'xp') return;
      const box = $('#talentList');
      if (box) box.innerHTML = talentChipsHTML(state.talentQuery);
      if (!q) {
        const inp = $('#talentSearch');
        if (inp) inp.value = '';
      }
    },
    buyRow(rank, idx) {
      const career = D.careers[state.origin.career];
      const row = ((career && career.ranks[String(rank)]) || [])[idx];
      if (!row) return;
      if (C.spentXP(state, D) + row.c > 500) { sfx('error'); alert('超出 500 XP 预算'); return; }
      const key = rank + '|' + idx;
      const mm = row.n.match(/[（(][xX×](\d)[)）]/);
      const mul = mm ? +mm[1] : 1;
      if ((state.purchases.rows[key] || 0) >= mul) { sfx('error'); alert('该进阶已达购买上限'); return; }
      sfx('buy');
      state.purchases.rows[key] = (state.purchases.rows[key] || 0) + 1;
      rebuildOwned(); commit();
    },
    undoRow(rank, idx) {
      const key = rank + '|' + idx;
      if (!state.purchases.rows[key]) return;
      sfx('click');
      state.purchases.rows[key] -= 1;
      if (!state.purchases.rows[key]) delete state.purchases.rows[key];
      rebuildOwned(); commit();
    },
    buyAttr(k, tier) {
      const career = D.careers[state.origin.career];
      const plan = (career && career.attrPlan[k]) || [];
      const bought = state.purchases.attrs[k] || 0;
      if (tier !== bought || !plan[tier]) return;
      if (C.spentXP(state, D) + plan[tier] > 500) { sfx('error'); alert('超出 500 XP 预算'); return; }
      sfx('buy');
      state.purchases.attrs[k] = bought + 1;
      commit();
    },
    undoAttr(k) {
      const n = state.purchases.attrs[k] || 0;
      if (!n) return;
      sfx('click');
      state.purchases.attrs[k] = n - 1;
      if (!state.purchases.attrs[k]) delete state.purchases.attrs[k];
      commit();
    },

    /* 其它 */
    setMeta(k, v) { state.meta[k] = v; save(); },
    rollProfit() { sfx('dice'); state.rolls.profit = d10(); commit(); },
    setProfit(v) { sfx('click'); state.rolls.profit = Math.max(1, Math.min(10, +v || 1)); commit(); },
    setShipSpent(v) { sfx('click'); state.rolls.shipSpent = Math.max(0, +v || 0); commit(); },
    setManual(k, v) {
      state.manuals[k] = (k === 'notes' || k === 'gearText') ? v : (+v || 0);
      save();
    },
    addGear() {
      const n = $('#gearName'), note = $('#gearNote');
      if (!n || !n.value.trim()) return;
      sfx('buy');
      state.gear.push({ id: null, name: n.value.trim(), qty: 1, note: note ? note.value.trim() : '' });
      n.value = ''; if (note) note.value = '';
      commit();
    },
    delGear(i) { sfx('click'); state.gear.splice(i, 1); commit(); },

    /* 装备库 */
    addGearItem(id) {
      const g = gearIndex[id];
      if (!g) return;
      sfx('buy');
      const hit = state.gear.find(x => x.id === id);
      if (hit) hit.qty = (hit.qty || 1) + 1;
      else state.gear.push({ id: id, name: g.label || g.name, qty: 1, note: '' });
      commit();
    },
    gearQty(i, d) {
      const g = state.gear[i];
      if (!g) return;
      sfx('click');
      g.qty = Math.max(1, (g.qty || 1) + d);
      commit();
    },
    setGearNote(i, v) { if (state.gear[i]) { state.gear[i].note = v; save(); } },
    setGearFilter(patch, keepFocus) {
      state.gearFilter = Object.assign({ cat: '远程', q: '' }, state.gearFilter, patch || {});
      render();
      if (keepFocus) {
        const el = $('#gearSearch');
        if (el) {
          el.focus();
          const n = el.value.length;
          try { el.setSelectionRange(n, n); } catch (e) { /* 忽略 */ }
        }
      }
    },
    acquireItem(id) {
      const g = gearIndex[id];
      if (!g) return;
      if (step !== 'gear') { step = 'gear'; render(); }
      const rar = $('#rarityMod');
      if (rar) rar.value = g.rarity ? g.rarity.mod : 0;
      const nm = $('#acqName');
      if (nm) nm.textContent = '当前目标：' + (g.label || g.name);
      const res = $('#acqResult');
      if (res) res.scrollIntoView({ block: 'center' });
    },

    /* 主题 */
    setTheme(name) {
      try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* 忽略 */ }
      applyTheme(name);
      sfx('theme');
    },

    /* 角色卡：技能 / 天赋全文展开 */
    expandSheet(which, open) {
      state.ui = state.ui || {};
      if (which === 'skills' || which === 'all') state.ui.expandSkills = !!open;
      if (which === 'talents' || which === 'all') state.ui.expandTalents = !!open;
      sfx('click');
      render();
      if (open) {
        const target = which === 'skills' ? $('#foldSkills') : which === 'talents' ? $('#foldTalents') : null;
        if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
      }
    },

    /* 音效 / 环境音 / 动效开关 */
    toggleSfx() {
      if (!window.RTSfx) return;
      RTSfx.toggle();
      syncChrome();
    },
    toggleAmbient() {
      if (!window.RTSfx) return;
      if (RTSfx.toggleAmbient()) sfx('open');
      syncChrome();
    },
    toggleFx() {
      if (!window.RTFX) return;
      RTFX.toggle();
      sfx('click');
      syncChrome();
      render();
    },

    /* 重看启动过场 */
    replayIntro() {
      const el = $('#splash');
      if (!el) return;
      sfx('open');
      el.style.display = '';
      el.classList.remove('done');
      const close = () => {
        el.classList.add('done');
        setTimeout(() => { el.style.display = 'none'; }, 900);
      };
      const t = setTimeout(close, 1600);
      el.addEventListener('click', () => { clearTimeout(t); close(); }, { once: true });
    },

    /* 详情抽屉 */
    openSkill(name) { openDetail('skill', name); },
    openTrait(name) { openDetail('trait', name); },
    openTalent(name) { openDetail('talent', name); },
    openGear(id) { openDetail('gear', id); },
    closeDrawer() {
      const el = $('#drawer');
      if (el && el.classList.contains('on')) sfx('close');
      if (el) el.classList.remove('on');
      document.body.classList.remove('drawer-open');
    },
    acquire() {
      const s = snapshot();
      const rEl = $('#rarityMod'), oEl = $('#otherMod');
      const r = rEl ? (+rEl.value || 0) : 0;
      const o = oEl ? (+oEl.value || 0) : 0;
      const target = s.fleet.pf + r + o;
      sfx('dice');
      const roll = d100();
      const ok = roll <= target;
      const el = $('#acqResult');
      if (el) el.innerHTML = `掷出 <b>${roll}</b> vs 目标 <b>${target}</b> → ` +
        `<b class="${ok ? 'ok-text' : 'bad'}">${ok ? '收购成功' : '收购失败'}</b>`;
      setTimeout(() => sfx(ok ? 'buy' : 'error'), 320);
    },
    exportJSON() {
      sfx('buy');
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (state.meta.name || 'rt-character') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    importJSON(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try { state = normalize(JSON.parse(fr.result)); save(); render(); }
        catch (e) { alert('导入失败：' + e.message); }
      };
      fr.readAsText(file, 'utf-8');
      input.value = '';
    },
    reset() {
      if (!confirm('清空当前角色？此操作不可撤销。')) { sfx('error'); return; }
      sfx('close');
      state = normalize(C.newState()); save(); render();
    }
  });
  window.App = App;

  function normalize(s) {
    const base = C.newState();
    const out = Object.assign({}, base, s || {});
    out.meta = Object.assign({}, base.meta, s && s.meta);
    out.origin = Object.assign({}, base.origin, s && s.origin);
    out.rolls = Object.assign({}, base.rolls, s && s.rolls);
    out.manuals = Object.assign({}, base.manuals, s && s.manuals);
    out.purchases = Object.assign({}, base.purchases, s && s.purchases);
    out.base = Object.assign({}, base.base, s && s.base);
    out.choices = (s && s.choices) || {};
    out.skills = (s && s.skills) || {};
    out.talents = (s && s.talents) || {};
    out.talentQuery = (s && s.talentQuery) || '';
    out.gear = ((s && s.gear) || []).map(g => {
      if (typeof g === 'string') return { id: null, name: g, qty: 1, note: '' };
      const rec = { id: g && g.id ? g.id : null, name: (g && g.name) || '', qty: (g && g.qty) || 1, note: (g && g.note) || '' };
      if (!rec.name && rec.id && gearIndex[rec.id]) rec.name = gearIndex[rec.id].label || gearIndex[rec.id].name;
      return rec;
    });
    out.gearFilter = Object.assign({ cat: '远程', q: '' }, s && s.gearFilter);
    out.ui = Object.assign({ expandSkills: false, expandTalents: false }, s && s.ui);
    out.seen = (s && s.seen) || {};
    if (!out.origin.career && out.origin['career']) out.origin.career = out.origin['career'];
    return out;
  }

  state = normalize(state);
  applyTheme(savedTheme());

  /* 首次交互解锁音频；若之前开着环境音，手势后自动续上 */
  function unlockAudio() {
    if (!window.RTSfx) return;
    RTSfx.unlock();
    if (RTSfx.ambientEnabled()) RTSfx.ambientOn();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, unlockAudio, { passive: true }));

  /* ---------------- 全局事件：悬浮卡 + 抽屉 ---------------- */
  const CHIP_SEL = '[data-skill],[data-trait],[data-talent]';
  const CHIP_KINDS = ['skill', 'trait', 'talent'];

  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest(CHIP_SEL);
    clearTimeout(tipTimer);
    if (!el) { hideTip(); return; }
    tipTimer = setTimeout(() => showTip(el), 350);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest && e.target.closest(CHIP_SEL)) {
      clearTimeout(tipTimer);
      hideTip();
    }
  });
  document.addEventListener('click', e => {
    const chipEl = e.target.closest && e.target.closest(CHIP_SEL);
    if (chipEl) {
      const kind = CHIP_KINDS.filter(k => chipEl.hasAttribute('data-' + k))[0];
      if (kind) openDetail(kind, chipEl.getAttribute('data-' + kind));
      return;
    }
    const card = e.target.closest && e.target.closest('[data-gear]');
    if (card && !(e.target.closest('.btn'))) openDetail('gear', card.getAttribute('data-gear'));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') App.closeDrawer();
  });

  render();
})();

