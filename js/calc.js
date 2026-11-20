/* 行商浪人角色卡 —— 纯计算模块（可在 Node 中单测，无 DOM 依赖） */
(function (root) {
  const A = ['WS', 'BS', 'S', 'T', 'Ag', 'Int', 'Per', 'WP', 'Fel'];

  const bonus = v => Math.floor((v || 0) / 10);

  function rankForTotal(rt, total, RANKS) {
    let r = 1;
    (RANKS || rt.RANKS).forEach(x => { if (total >= x.min) r = Math.max(r, x.rank); });
    return r;
  }

  function newState() {
    const base = {};
    A.forEach(k => base[k] = 0);
    return {
      meta: { name: '', player: '', gender: '', age: '', homeworld: '', appearance: '', motivation: '', enemies: '' },
      attrMode: 'roll',
      base: base,
      rolls: { wounds: 3, fate: 8, profit: 5, shipSpent: 0 },
      origin: { homeworld: '', birthright: '', temptation: '', trial: '', motivation: '', career: '' },
      originFree: false,
      choices: {},
      purchases: { rows: {}, attrs: {}, skills: {}, talents: {} },
      manuals: { woundsBonus: 0, fateBonus: 0, corruption: 0, insanity: 0, gearText: '', notes: '' },
      skills: {},
      talents: {},
      gear: []
    };
  }

  /* ---------- 起源之路效果汇总 ---------- */
  function originEffects(state, data, ignorePrereq) {
    const res = {
      mods: {}, trained: [], basic: [], talents: [], notes: [],
      woundsFlat: 0, fateFlat: 0, profit: 0, attrsChosen: {}
    };
    data.origin.rows.forEach(row => {
      const id = state.origin[row.id];
      if (!id) return;
      const opt = data.origin.options[id];
      if (!opt) return;
      applyEffects(res, opt, state.choices[id] || {}, ignorePrereq, opt.name);
    });
    return res;
  }

  function applyEffects(res, fx, sel, ignore, tag) {
    if (fx.mods) for (const k in fx.mods) res.mods[k] = (res.mods[k] || 0) + fx.mods[k];
    (fx.trained || []).forEach(s => res.trained.push(s));
    (fx.basic || []).forEach(s => res.basic.push(s));
    (fx.talents || []).forEach(t => res.talents.push(t));
    (fx.notes || []).forEach(n => res.notes.push((tag ? tag + '：' : '') + n));
    res.woundsFlat += fx.woundsFlat || 0;
    res.fateFlat += fx.fateFlat || 0;
    res.profit += fx.profit || 0;

    (fx.choices || []).forEach(ch => {
      const v = sel[ch.key];
      if (v === undefined || v === null || v === '') return;
      if (ch.kind === 'attr') {
        res.attrsChosen[v] = (res.attrsChosen[v] || 0) + (ch.amount || 0);
      } else if (ch.kind === 'variant') {
        const pick = ch.options.find(o => o.label === v);
        if (pick) applyEffects(res, pick, sel, ignore, tag);
      } else {
        const name = String(v);
        if (ch.kind === 'skill') res.trained.push(name);
        else if (ch.kind === 'talent') res.talents.push(name);
        else {
          if (/（技能）/.test(name)) res.trained.push(name.replace('（技能）', ''));
          else if (/（天赋）/.test(name)) res.talents.push(name.replace('（天赋）', ''));
          else if (/（受训）/.test(name)) res.trained.push(name.replace('（受训）', ''));
          else res.talents.push(name);
        }
      }
    });
  }

  /* ---------- 属性总表 ---------- */
  function attributes(state, data, ignorePrereq) {
    const eff = originEffects(state, data, ignorePrereq);
    const out = {};
    A.forEach(k => {
      const base = state.base[k] || 0;
      const origin = eff.mods[k] || 0;
      const chosen = eff.attrsChosen[k] || 0;
      const bought = (state.purchases.attrs[k] || 0) * 5;
      const total = Math.max(0, base + origin + chosen + bought);
      out[k] = { base, origin, chosen, bought, total, bonus: bonus(total) };
    });
    return out;
  }

  /* ---------- 派生值 ---------- */
  function wounds(state, data, attrs) {
    const opt = data.origin.options[state.origin.homeworld];
    const w = (opt && opt.wounds) || { tbMul: 2, dice: '1d5', flat: 0 };
    const eff = originEffects(state, data);
    const tb = attrs.T.bonus;
    const flat = (w.flat || 0) + eff.woundsFlat + (state.manuals.woundsBonus || 0);
    return {
      tbMul: w.tbMul || 2, fromT: tb * (w.tbMul || 2), dice: state.rolls.wounds || 0, flat,
      total: tb * (w.tbMul || 2) + (state.rolls.wounds || 0) + flat
    };
  }

  function fate(state, data) {
    const opt = data.origin.options[state.origin.homeworld];
    const table = (opt && opt.fate) || [[10, 3]];
    const roll = state.rolls.fate || 1;
    let val = 0;
    table.forEach(([max, pts]) => { if (val === 0 && roll <= max) val = pts; });
    const eff = originEffects(state, data);
    const total = Math.max(0, val + eff.fateFlat + (state.manuals.fateBonus || 0));
    return { roll, table: val, originFlat: eff.fateFlat, manual: state.manuals.fateBonus || 0, total };
  }

  function profit(state, data, rules) {
    const table = rules.PROFIT_TABLE;
    const roll = state.rolls.profit || 1;
    let row = table.find(r => (Array.isArray(r.roll) ? r.roll[0] <= roll && roll <= r.roll[1] : r.roll === roll));
    if (!row) row = table[0];
    const eff = originEffects(state, data);
    const spent = state.rolls.shipSpent || 0;
    return { roll, basePF: row.pf, baseSP: row.sp, originProfit: eff.profit, spSpent: spent,
             pf: row.pf + eff.profit + spent, sp: row.sp - spent };
  }

  function movement(attrs) {
    const b = attrs.Ag.bonus;
    return { half: b, full: b * 2, charge: b * 3, run: b * 6 };
  }

  /* ---------- 技能解析 ---------- */
  function expandSkill(raw) {
    const s0 = String(raw).trim().replace(/[（(](WS|BS|S|T|Ag|Int|Per|WP|Fel)[)）]\s*$/i, '').trim();
    const m = s0.match(/^(.+?)[（(]([^（）()]+)[)）]$/);
    if (m && /[,，、]/.test(m[2]) && !/择一|任意/.test(m[2])) {
      return m[2].split(/[,，、]/).map(x => m[1] + '（' + x.trim() + '）');
    }
    return [s0];
  }

  function splitList(str) {
    return String(str || '').split(/[,，、；;]/).map(x => x.trim()).filter(Boolean);
  }

  function skillLevel(name) {
    const m = String(name).match(/^(.*?)\s*[+＋](\d0)$/);
    if (!m) return { base: String(name), level: 1 };
    return { base: m[1], level: m[2] === '10' ? 2 : 3 };
  }

  /* ---------- 前置条件 ---------- */
  function attrOfTotal(ctx, k) { return (ctx.attrs[k] || {}).total || 0; }

  function checkToken(tok, ctx) {
    const t = String(tok).trim();
    if (!t) return null;
    let m = t.match(/^(WS|BS|S|T|Ag|Int|Per|WP|Fel)\s*(\d+)$/);
    if (m) {
      const need = +m[2];
      return { text: t, ok: attrOfTotal(ctx, m[1]) >= need, kind: 'attr', need };
    }
    if (/^(特殊|—|-)$/.test(t)) return { text: t, ok: true, kind: 'special' };
    if (/[（(](任意|择一)[)）]/.test(t)) return { text: t, ok: true, kind: 'any' };
    const lv = t.match(/^(.*?)[+＋](\d0)$/);
    if (lv) {
      const have = ctx.skills[lv[1]] || 0;
      const need = lv[2] === '10' ? 2 : 3;
      return { text: t, ok: have >= need, kind: 'skill', need };
    }
    const owned = !!ctx.talents[t] || !!ctx.skills[t];
    return { text: t, ok: owned, kind: 'name' };
  }

  function checkPrereq(str, ctx) {
    const items = splitList(str).map(t => checkToken(t, ctx)).filter(Boolean);
    return { ok: items.every(i => i.ok), items };
  }

  /* ---------- 已拥有的技能/天赋 ---------- */
  function ownedSkills(state, data, ignorePrereq) {
    const eff = originEffects(state, data, ignorePrereq);
    const map = {};
    eff.trained.forEach(s => expandSkill(s).forEach(n => { map[n] = Math.max(map[n] || 0, 1); }));
    for (const k in state.purchases.skills) map[k] = Math.max(map[k] || 0, state.purchases.skills[k]);
    for (const k in state.skills) map[k] = Math.max(map[k] || 0, state.skills[k]);
    return map;
  }

  /* ---------- 天赋名归一（职业表写法 → 词典名） ---------- */
  // 进阶表里的天赋写法带有 †、计数（血肉苦弱3）、括注（宿敌（任一））、
  // 前缀组别（(帝国海军)赴汤蹈火），以及书中的混写（基本/基础武器训练）。
  function talentCandidates(text) {
    const seen = {}, out = [];
    const push = v => {
      const s = String(v == null ? '' : v).replace(/†/g, '').replace(/[。．.\s]+$/, '').trim();
      if (!s || seen[s]) return;
      seen[s] = 1;
      out.push(s);
      push(s.replace(/^[（(][^）)]*[)）]/, ''));     // (帝国海军)赴汤蹈火
      push(s.replace(/\d+$/, ''));                  // 血肉苦弱3
      push(s.replace(/[（(][^）)]*[)）]$/, ''));      // 重型武器训练(择一)(x2)
      push(s.replace(/^基本/, '基础'));              // 基本武器训练 → 基础武器训练
    };
    push(text);
    return out;
  }

  function talentKey(text, index) {
    const idx = index || {};
    return talentCandidates(text).filter(n => idx[n])[0] || '';
  }

  function ownedTalents(state, data, ignorePrereq) {
    const eff = originEffects(state, data, ignorePrereq);
    const map = {};
    eff.talents.forEach(t => { if (t) map[String(t).trim()] = true; });
    for (const k in state.purchases.talents) map[k] = true;
    for (const k in state.talents) map[k] = true;
    return map;
  }

  function spentXP(state, data) {
    const career = data.careers[state.origin.career];
    let xp = 0;
    if (career) {
      for (const key in state.purchases.rows) {
        const parts = key.split('|');
        const row = ((career.ranks[parts[0]] || [])[+parts[1]]);
        if (row) xp += row.c * (state.purchases.rows[key] || 0);
      }
      for (const k in state.purchases.attrs) {
        const plan = career.attrPlan[k] || [];
        for (let i = 0; i < (state.purchases.attrs[k] || 0); i++) xp += plan[i] || 0;
      }
    }
    return xp;
  }

  function totalXP(state, data, rules) {
    return rules.XP.START_SPENT + spentXP(state, data);
  }

  const API = {
    ATTR_KEYS: A, bonus, newState, originEffects, attributes, wounds, fate, profit, movement,
    expandSkill, splitList, skillLevel, checkPrereq, checkToken, ownedSkills, ownedTalents,
    talentCandidates, talentKey, spentXP, totalXP, rankForTotal
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.RTCalc = API;
})(typeof window !== 'undefined' ? window : globalThis);
