/* 角色卡逻辑自测：node tools/test_calc.js */
global.window = global;
require('../data/bundle.js');
require('../js/rules.js');
require('../js/calc.js');

const C = global.RTCalc, R = global.RTRules, D = global.RTData;
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
}
function truthy(name, v) { console.log((v ? '  ok  ' : '  FAIL') + ' ' + name); v ? pass++ : fail++; }

// 1. 数据完整性
eq('职业数量', Object.keys(D.careers).length, 8);
eq('起源行数', D.origin.rows.length, 6);
eq('起源选项数', Object.keys(D.origin.options).length, 30);
eq('技能数', D.skills.length, 48);
truthy('行商浪人有 8 个等阶块', Object.keys(D.careers['行商浪人'].ranks).length === 8);
truthy('行商浪人属性方案 9 项', Object.keys(D.careers['行商浪人'].attrPlan).length === 9);
eq('行商浪人 意志提升阶梯', D.careers['行商浪人'].attrPlan.WP, [250, 500, 750, 1000]);

// 2. 基础计算
eq('加值 41→4', C.bonus(41), 4);
eq('加值 39→3', C.bonus(39), 3);
eq('等阶@5000', C.rankForTotal(R, 5000), 1);
eq('等阶@7000', C.rankForTotal(R, 7000), 2);
eq('等阶@30500', C.rankForTotal(R, 30500), 8);

// 3. 技能解析
eq('口语分组展开', C.expandSkill('口语（高哥特语,低哥特语）（Int）'), ['口语（高哥特语）', '口语（低哥特语）']);
eq('技能等级 魅力+20', C.skillLevel('魅力+20'), { base: '魅力', level: 3 });
eq('技能等级 魅力', C.skillLevel('魅力'), { base: '魅力', level: 1 });

// 4. 造一个死亡世界 / 佣兵 / 行商浪人
const st = C.newState();
st.base = { WS: 41, BS: 33, S: 41, T: 35, Ag: 34, Int: 37, Per: 40, WP: 39, Fel: 33 };
st.origin = Object.assign(st.origin, {
  homeworld: 'death', birthright: 'mercenary', temptation: 'stain',
  trial: 'endurance', motivation: 'wealth', career: '行商浪人'
});
st.choices = { death: { 'death-hardened': '见怪不怪' }, 'stain': { 'stain-path': '叛逆哲学' } };
st.rolls = { wounds: 3, fate: 6, profit: 5, shipSpent: 0 };

const attrs = C.attributes(st, D);
eq('死亡世界 力量 41+5', attrs.S.total, 46);
eq('死亡世界 -5 社交 + 佣兵 -5 社交', attrs.Fel.total, 23);
eq('死亡世界 -5 意志 + 叛逆哲学 +3', attrs.WP.total, 37);
eq('坚韧 35+5', attrs.T.total, 40);
eq('坚韧加值', attrs.T.bonus, 4);

const w = C.wounds(st, D, attrs);
eq('承伤 = 4×2 + 3 + 2(死亡世界) + 1(忍耐)', w.total, 14);
const fa = C.fate(st, D);
eq('命运点 = 6→3 + 1(财富)', fa.total, 4);
const pf = C.profit(st, D, R);
eq('利润因子 = 40(掷5)', pf.pf, 40);
st.rolls.shipSpent = 10;
eq('舰船点兑入后 40+10', C.profit(st, D, R).pf, 50);

// 5. 前置条件
const ctx = { attrs, skills: C.ownedSkills(st, D), talents: C.ownedTalents(st, D) };
truthy('Ag30 满足', C.checkPrereq('Ag30', ctx).ok);
truthy('WP45 不满足', !C.checkPrereq('WP45', ctx).ok);
truthy('恐吓为受训技能（佣兵）', !!ctx.skills['恐吓']);
truthy('快手拔枪为天赋（佣兵）', !!ctx.talents['快手拔枪']);
truthy('见怪不怪来自死亡世界选择', !!ctx.talents['见怪不怪']);

// 6. XP 与购买
const rows1 = D.careers['行商浪人'].ranks['1'];
truthy('等阶1 有进阶行', rows1 && rows1.length > 10);
const before = C.spentXP(st, D);
st.purchases.rows['1|0'] = 1;
eq('购买一行后 XP 增加该行花费', C.spentXP(st, D), before + rows1[0].c);
st.purchases.attrs.WP = 1;
eq('属性提升 250 计入 XP', C.spentXP(st, D), before + rows1[0].c + 250);
eq('总经验 = 4500 + 已花', C.totalXP(st, D, R), 4500 + C.spentXP(st, D));

// 7. 移动
const mv = C.movement(attrs);
eq('移动 敏捷加值 3', [mv.half, mv.full, mv.charge, mv.run], [3, 6, 9, 18]);

// 8. 军械库 / 武器特性 / 技能描述（2.0）
const gearBy = n => D.gear.find(x => x.name === n);
const catCount = c => D.gear.filter(x => x.cat === c).length;
eq('装备总数', D.gear.length, 264);
eq('远程武器 48', catCount('远程'), 48);
eq('近战武器 26', catCount('近战'), 26);
eq('护甲 20', catCount('护甲'), 20);
eq('植入物 26', catCount('植入物'), 26);
truthy('每件装备都有 id/名称/分类/出处页',
  D.gear.every(x => x.id && x.name && x.cat && x.page > 0));
truthy('分类齐全（11 类）', new Set(D.gear.map(x => x.cat)).size === 11);
eq('激光步枪 伤害/穿甲/弹容', [gearBy('激光步枪').dmg, gearBy('激光步枪').pen, gearBy('激光步枪').clip],
  ['1d10+3 E', '0', '60']);
eq('激光步枪 重量 4 / 普通+20', [gearBy('激光步枪').wt, gearBy('激光步枪').rarity],
  [4, { label: '普通', mod: 20 }]);
eq('上古科技激光手枪 穿甲 2 / 弹容 70',
  [gearBy('上古科技激光手枪').pen, gearBy('上古科技激光手枪').clip], ['2', '70']);
eq('封建世界板甲 AP 5 / 覆盖全身', [gearBy('封建世界板甲').ap, gearBy('封建世界板甲').cover], ['5', '全身']);
truthy('跨页裂名已合并：重弹机枪 (乌塞德)', !!gearBy('重弹机枪 (乌塞德)'));
eq('手榴弹显示名补后缀', gearBy('破片').label, '破片榴弹');
truthy('装填解析为回合+动作', JSON.stringify(gearBy('激光步枪').reload) === JSON.stringify({ n: 1, action: '完整' }));
truthy('武器特性均已拆分', gearBy('动力剑(莫迪安)').traits.length === 2);
eq('特性词典条目数', Object.keys(D.traits).length, 20);
truthy('撕裂 有说明文字', ((D.traits['撕裂'] || {}).desc || '').length > 20);
eq('技能描述已补全', D.skills.filter(s => s.desc).length, 48);
truthy('导航 有技能组与技能使用',
  !!D.skills.find(s => s.name === '导航').groups && !!D.skills.find(s => s.name === '导航').uses);
truthy('爆破 有 3 条特别用法', (D.skills.find(s => s.name === '爆破').special || []).length === 3);
eq('表演的技能组', D.skills.find(s => s.name === '表演').groups, '舞者、音乐家、歌手、说书人');

// 9. 天赋词典（2.1）
const tBy = n => D.talents.find(t => t.name === n);
eq('天赋总数', D.talents.length, 147);
eq('天赋组条目数（简表 † 16 + 漏标 2）', D.talents.filter(t => t.isGroup).length, 18);
eq('带可选组别列表的天赋', D.talents.filter(t => t.group).length, 17);
truthy('每条天赋都有描述与出处页', D.talents.every(t => t.desc && t.page > 0));
truthy('天赋名不重复', new Set(D.talents.map(t => t.name)).size === D.talents.length);
eq('双持客 获取前提', tBy('双持客').prereq, '弹道技能35或近战技巧35，敏捷35');
eq('双持客 可选组别', tBy('双持客').group, '远程，近战');
eq('才华横溢 组别「任一技能」', tBy('才华横溢').group, '任一技能');
truthy('平等待遇 组别含机械修会', (tBy('平等待遇').group || '').indexOf('机械修会') >= 0);
truthy('血肉苦弱 正文含机械特质', tBy('血肉苦弱').desc.indexOf('机械特质') >= 0);
truthy('双巧手 有特殊说明', (tBy('双巧手').special || []).length > 0);
truthy('自动血浆 无获取前提（书中为 ——）', !tBy('自动血浆').prereq);

const tIdx = {};
D.talents.forEach(t => { tIdx[t.name] = t; (t.alias || []).forEach(a => { tIdx[a] = t; }); });
eq('归一：† 与计数后缀', C.talentKey('血肉苦弱3†', tIdx), '血肉苦弱');
eq('归一：括注后缀', C.talentKey('宿敌（任一）', tIdx), '宿敌');
eq('归一：前缀组别', C.talentKey('(帝国海军)赴汤蹈火', tIdx), '赴汤蹈火');
eq('归一：择一(x2)', C.talentKey('重型武器训练(择一)(x2)', tIdx), '重型武器训练');
eq('归一：基本武器训练 → 别名', (tIdx[C.talentKey('基本武器训练（通用）', tIdx)] || {}).name, '基础武器训练');
eq('归一：快速装弹 → 别名', (tIdx[C.talentKey('快速装弹', tIdx)] || {}).name, '快速装填');
eq('归一：灵能等级2。', C.talentKey('灵能等级2。', tIdx), '灵能等级');
eq('归一：未知名字返回空', C.talentKey('并不存在的天赋', tIdx), '');

const tRefs = new Set();
Object.keys(D.careers).forEach(cn => {
  const c = D.careers[cn];
  Object.keys(c.ranks).forEach(rk => c.ranks[rk].forEach(r => { if (r.t === '天赋') tRefs.add(r.n); }));
  String(c.startTalents || '').split(/[、，,]/).forEach(x => { if (x.trim()) tRefs.add(x.trim()); });
});
Object.keys(D.origin.options).forEach(k => (D.origin.options[k].talents || []).forEach(x => tRefs.add(x)));
const tMiss = [...tRefs].filter(x => !C.talentKey(x, tIdx));
truthy('天赋引用命中 ' + (tRefs.size - tMiss.length) + '/' + tRefs.size, tMiss.length <= 8);
if (tMiss.length) console.log('       未命中（第二章表格断行残留）: ' + tMiss.join('、'));

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
process.exitCode = fail ? 1 : 0;
