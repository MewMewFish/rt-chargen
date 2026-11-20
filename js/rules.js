/* 行商浪人角色卡 —— 规则常量
 * 数据出处：《行商浪人核心规则书 V0.3》
 *   属性生成 P8-9 / 起源之路 P10-29 / 经验与等阶 P30、P40 / 利润因子与舰船点 P34-35
 */
window.RTRules = (function () {
  const ATTRS = [
    { k: 'WS', name: '武器技能', short: 'WS' },
    { k: 'BS', name: '弹道技能', short: 'BS' },
    { k: 'S', name: '力量', short: 'S' },
    { k: 'T', name: '坚韧', short: 'T' },
    { k: 'Ag', name: '敏捷', short: 'Ag' },
    { k: 'Int', name: '智力', short: 'Int' },
    { k: 'Per', name: '感知', short: 'Per' },
    { k: 'WP', name: '意志', short: 'WP' },
    { k: 'Fel', name: '社交', short: 'Fel' }
  ];

  // 表2-2：等阶与总消耗经验（所有职业相同）
  const RANKS = [
    { rank: 1, min: 5000, max: 6999 },
    { rank: 2, min: 7000, max: 9999 },
    { rank: 3, min: 10000, max: 12999 },
    { rank: 4, min: 13000, max: 16999 },
    { rank: 5, min: 17000, max: 20999 },
    { rank: 6, min: 21000, max: 24999 },
    { rank: 7, min: 25000, max: 29999 },
    { rank: 8, min: 30000, max: 34999 }
  ];

  // 表1-5：起始利润因子与舰船点
  const PROFIT_TABLE = [
    { roll: 1, pf: 60, sp: 30 },
    { roll: [2, 3], pf: 50, sp: 40 },
    { roll: [4, 7], pf: 40, sp: 50 },
    { roll: [8, 9], pf: 30, sp: 60 },
    { roll: 10, pf: 20, sp: 70 }
  ];

  const XP = {
    START_SPENT: 4500,   // 角色创建时已被“预支”的经验
    START_POOL: 500,     // 可自由花费
    ATTR_STEP: 5,        // 每次属性提升 +5
    TIERS: ['青涩', '中级', '受训', '专家']
  };

  const CREATION_STEPS = [
    { id: 'attr', title: '① 属性', desc: '2d10+25 掷骰，或 100 点分配（单项≤20）' },
    { id: 'origin', title: '② 起源之路', desc: '6 行图表，选相邻项，自动结算属性与技能' },
    { id: 'xp', title: '③ 职业与经验', desc: '8 条道途、等阶 1-8 进阶表（500 XP 可花）' },
    { id: 'life', title: '④ 赐角色以生命', desc: '名字、外貌、动机、敌友' },
    { id: 'fleet', title: '⑤ 利润因子与舰船点', desc: '1d10 查表，剩余舰船点 1:1 转利润因子' },
    { id: 'gear', title: '⑥ 选择装备', desc: '用利润因子做一次单件收购（修正 +0）' },
    { id: 'sheet', title: '⑦ 角色卡', desc: '汇总、打印、导出' }
  ];

  // 负重（表9-33 的简化提示，精确值请查原书）
  return { ATTRS, RANKS, PROFIT_TABLE, XP, CREATION_STEPS };
})();
