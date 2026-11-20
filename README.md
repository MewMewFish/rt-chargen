# 行商浪人 · 角色卡创建器 3.1（Rogue Trader 核心规则书 V0.3）

一个**离线可用、双击即开**的单页工具：按《行商浪人核心规则书 V0.3》的七步创建流程，从属性掷骰一路做到可打印的角色卡。

- **2.0**：完整军械库（264 件）、48 项技能全文、20 条武器特性词典、三套主题
- **2.1**：147 条天赋全文（第四章），天赋与技能同一套「悬停摘要 + 抽屉全文」
- **3.0**：**音效**（实时合成，无音频文件）、**过场动画**（启动页 / 步骤切换 / 数字滚动）、**角色卡技能与天赋可一键全展开**、界面整体重制（页眉徽记、步骤导航、HUD、羊皮纸角色卡）并接入外部插画素材
- **3.1**：**六套配色**（纯色环按钮，无文字）、**背景音乐**（`assets/audio/bgm.mp3`，内置 `.ncm` 解码工具，页眉按钮 + 右下角迷你播放器，淡入淡出）、**九维属性雷达图**（角色卡内联 SVG）

> 打开方式：双击 `index.html`（Chrome / Edge / Firefox 均可，无需服务器、无需安装）。
> 数据自动存到浏览器 localStorage；可在「角色卡」页导出 / 导入 JSON。
> 若页面白屏：用的是 IE 内核（含 360 / QQ / 搜狗等双核浏览器的“兼容模式”）。页面脚本需要 ES6 语法与 CSS 变量，请换新版 Chrome / Edge / Firefox，或把双核浏览器切到“极速 / Blink”内核——`index.html` 里已加内核声明与兜底提示。

---

## 一、目录结构

```
rt-chargen/
├─ index.html            入口（启动过场 + 七步向导 + 六枚主题色环 + 音效/音乐/动效开关 + 迷你播放器 + 抽屉容器）
├─ css/style.css         样式（6 套主题变量 + 材质背景 + 过场动画 + 角色卡折叠 + 九维雷达 + 迷你播放器 + A4 打印）
├─ js/rules.js           规则常量：属性、等阶表、利润因子表、XP 规则
├─ js/calc.js            纯计算：加值/承伤/命运/利润因子/前置条件/XP（可在 Node 单测）
├─ js/app.js             界面与交互（七步渲染、装备浏览器、折叠、音效挂点、九维雷达、主题切换）
├─ js/audio.js           音效：WebAudio 实时合成（点击/翻页/抽屉/掷骰/购买/错误/主题）
├─ js/music.js           3.1 背景音乐：`<audio loop>` + GainNode 淡入淡出（单例 `RTMusic`）
├─ js/fx.js              3.0 动效：启动页、步骤过场、HUD 数字滚动、面板浮现、脉冲
├─ assets/audio/          3.1 背景音乐
│   ├─ bgm.mp3           320 kbps / 2:11（由 tools/build_bgm.py 从 .ncm 解出）
│   ├─ bgm.json          曲目元数据（曲名/艺术家/专辑/时长/封面）
│   └─ bgm-meta.js       ↑ 打包成 window.RTBgmMeta（file:// 下不能 fetch，只能 <script> 引入）
├─ assets/img/           3.0 素材（由 tools/build_assets.py 从插画生成，共约 480 KB）
│   ├─ hero.jpg          舰船城市插画 → 页面极暗背景层（另存 hero-sm.jpg 备用）
│   ├─ aquila.png        双头鹰徽记（启动页）/ aquila-mark.png（页眉、页脚）/ favicon.png
│   ├─ banner-1~3.png    三条骷髅卷轴饰带（页眉分隔线、过场、卡片装饰）
│   ├─ skull-frame.png   骷髅花纹边框 → 角色卡水印
│   ├─ servitor.png      伺服颅骨卷轴（备用装饰）
│   ├─ bgm-cover.jpg     3.1 迷你播放器封面缩略图（32×32）
│   └─ paper.jpg         程序生成的羊皮纸纹理
├─ data/
│   ├─ origin.json       起源之路 30 个选项（手写校对过，含属性修正/技能/天赋/承伤/命运）
│   ├─ careers.json      8 条职业道途：属性提升方案 + 等阶 1-8 进阶表（共 1238 行）+ 起始技能/天赋/装备
│   ├─ skills.json       48 项技能（类型/属性/分类 + desc/uses/groups/special/page）
│   ├─ talents.json      147 条天赋（effect/prereq/desc/group/special/page，含天赋组 18 条）
│   ├─ gear.json         军械库 264 件（11 类，含伤害/穿甲/弹容/装填/特性/重量/稀有度/出处页）
│   ├─ traits.json       20 条武器特性说明（正文 + 出处页）
│   ├─ gear_review.csv   抽取时未通过的原始行（当前 0 行；留作回归核对）
│   ├─ bundle.js         ↑ 各 JSON 打包成的可 <script> 引入版本（file:// 下 fetch 会被 CORS 拦）
│   ├─ _ch3_full.txt     第三章原文（P112-171，build_skills.py 的输入；构建中间产物，可重新导出）
│   ├─ _ch4_full.txt     第四章原文（P133-161，build_talents.py 的输入；同上）
│   ├─ _tt_cache/        逐页表格缓存（probe_tables.py 生成，无需重跑 PDF）
│   ├─ _txt_cache/       逐页文本缓存（extract_text.py 生成）
│   ├─ _gear_names.txt   264 件装备的抽样清单（可选，人工核对时生成）
│   └─ _*_report.txt     各构建脚本的统计与缺口报告（含 _assets_report.txt）
└─ tools/
    ├─ build_data.py     从规则书纯文本重建 careers/skills/bundle（--bundle-only 只打包）
    ├─ build_gear.py     PDF 表格按列抽取军械库 → gear.json
    ├─ build_traits.py   抽取武器特性说明 → traits.json
    ├─ build_skills.py   给 skills.json 补技能正文/用法/技能组/特别用法
    ├─ build_talents.py  表 4-1 + 第四章正文 → talents.json（147 条）
    ├─ build_assets.py   3.0 素材：抠图（白底转 alpha）、自动分带、量化压缩 → assets/img
    ├─ build_bgm.py      3.1 背景音乐：.ncm 解码（RC4 + AES-128-ECB）/ .mp3 / .flac → assets/audio/*
    ├─ extract_text.py   按页导出 PDF 文本（带缓存，可断点续跑）
    ├─ probe_tables.py   按页缓存 PDF 表格结构（build_gear.py 的前置）
    ├─ quality.py        数据质量检查
    ├─ test_calc.js      Node 逻辑/数据单测（76 项）
    └─ smoke.html        浏览器冒烟测试页（79 项，用无头模式 --dump-dom 跑）
```

## 二、七步流程与实现要点

| 步骤 | 页面 | 实现 |
|---|---|---|
| ① 属性 | 掷骰 / 点数分配 / 手动 | 2d10+25，每项记录重投次数（>1 次会提示）；点数分配模式基础 25、总计 100、单项 ≤20 |
| ② 起源之路 | 6 行图表点选 | 家园世界 → 生而有权 → 虚空的诱惑 → 考验与苦痛 → 动机 → 职业；**强制相邻**（上一行位置的正下方或紧邻），可勾选“自由选择”解除；选项内的二选一/三选一会即时结算 |
| ③ 职业与经验 | 8 条道途 + XP 商店 | 起始 4,500 XP 已计入，另有 500 XP；属性提升按 青涩/中级/受训/专家 逐级购买；等阶由总经验自动判定（表 2-2），只能从当前及以前等阶购买；(X2) 类进阶有购买上限；前置条件实时校验并显示徽章；技能与天赋行均可点开全文；页尾附「天赋速查」可搜索全书 147 条 |
| ④ 赐角色以生命 | 自由填写 | 名字、玩家、外貌、动机、敌人；下方汇总起源与特质限制 |
| ⑤ 利润因子与舰船点 | 1d10 查表 | 表 1-5；起源修正（贵族 +1、灾祸 -1…）自动叠加；未花舰船点 1:1 计入利润因子 |
| ⑥ 选择装备 | **装备库 + 已选清单 + 收购计算器** | 11 个分类标签 + 名称/特性搜索；点卡片看详情、点“加入”入清单；清单支持数量增减、备注、单品收购检定（自动带入稀有度修正）；仍可手工添加自定义物品 |
| ⑦ 角色卡 | 汇总 / 打印 / 导出 | **九维属性雷达图**（3.1，内联 SVG）、属性（含加值）、承伤、命运点、移动、利润因子、舰船点；**受训技能与天赋可一键展开全文**（默认只显示标签）；A4 打印时自动展开并隐藏界面 |

## 三、3.1 新增：六套主题 / 背景音乐 / 九维雷达

### 1. 六套无文字主题按钮

页眉原来的下拉框 + 三选段改成**六个纯色环按钮**（`.seg.theme-icons > .thm > i.sw`）：按钮上没有任何文字，只显示该套配色的三个色块；鼠标悬停出 `title`，读屏走 `aria-label` + `aria-pressed`，选中项有一圈高亮环（`.thm.on`）。

| 主题 | 键名 | 主色 `--gold` | 背景气质 |
|---|---|---|---|
| 帝国哥特 | `gothic` | `#c8a558` | 暗金 + 石灰黑（默认） |
| 机仆冷钢 | `steel` | `#86bdd2` | 青钢蓝 |
| 虚空赤褐 | `void` | `#cc8f6b` | 锈红褐 |
| 血契绯红 | `crimson` | `#d97b6c` | 血红 |
| 苔原深绿 | `verdant` | `#8fcda6` | 苔藓绿 |
| 紫晶圣咏 | `amethyst` | `#a992e6` | 紫罗兰 |

- 面板、按钮、表格、卡片、HUD、步骤条、抽屉、迷你播放器、聚焦环全部改用主题变量（`--bg --bg2 --panel --line --gold --gold-dim --text --muted --red --ok --hud --halo`），换主题不会有某个角落漏色。
- 主题存 `localStorage: rt-chargen-theme`，**与角色数据分开**：换角色不会重置配色。
- 脚本接口：`App.setTheme('crimson')`；页面若没有 `#themeSeg`，只改 `body[data-theme]`、不报错。

### 2. 背景音乐（`js/music.js` + `assets/audio/`）

| 文件 | 作用 |
|---|---|
| `assets/audio/bgm.mp3` | 320 kbps / 2:11 / 约 5 MB，循环播放 |
| `assets/audio/bgm.json` | 曲目元数据（曲名 / 艺术家 / 专辑 / 时长 / 封面） |
| `assets/audio/bgm-meta.js` | 同上的 `<script>` 版：`window.RTBgmMeta`（`file://` 下 fetch 会被拦） |
| `assets/img/bgm-cover.jpg` | 迷你播放器封面缩略图（32×32） |
| `tools/build_bgm.py` | 源文件（`.ncm` / `.mp3` / `.flac`）→ 上面 4 个文件 |

- **NCM 解码**：网易云 `.ncm` 不是普通音频容器。`build_bgm.py` 先校验 `CTENFDAM` 魔数，用 RC4 解出密钥盒、AES-128-ECB 解元数据，再跳过 `163 key(Don't modify):` 注释头取出后面的音频流（新旧两种元数据变体都兼容）。用法：

  ```powershell
  & 'C:\Program Files\python\python.exe' tools\build_bgm.py "D:\临时\Clash of Convictions.ncm"
  ```

  依赖 `pycryptodome`（RC4 / AES）。已经解出 `bgm.mp3` 的话不必再跑；换曲才需要。
- **播放器**：页眉「音乐」按钮 + 右下角迷你播放器（封面 / 曲名 / 艺术家 / 进度条 / 音量 / 关闭）。`js/music.js` 是独立单例 `RTMusic`：隐藏的 `<audio loop>` 经 `createMediaElementSource` 接 `GainNode`，播放用 1.5 s 线性淡入、停止用 0.6 s 淡出（不硬切爆音）；`el.play()` 被浏览器拒绝时**自动回滚**状态，按钮不会假亮。
- **自动播放**：浏览器的策略要求先有手势，所以只在首次点击 / 按键时 `unlock()`；上次离开时音乐开着，手势后自动续播。
- 文件缺失或解码失败 → 按钮禁用、迷你播放器标红（`.bgmbar.fail`），不弹错误框。
- **无头 / 无音频设备**：`new AudioContext()` 这类调用在部分环境会长时间阻塞渲染线程，所以 `tools/smoke.html` 与截图脚本都会先把 `AudioContext`、`HTMLMediaElement.play/pause` 换成桩，只测逻辑与状态。

### 3. 九维属性雷达（角色卡）

- `js/app.js` 的 `radarBlock(a)` 直接生成**内联 SVG**（没有引入图表库）：9 条轴 + 4 圈网格 + 数据多边形 + 9 个数据点 + 轴标签（缩写 + 数值）+ 右侧九项图例（缩写 / 全名 / 总值 / 加值）。
- 满环 = `max(60, 最高属性向上取整到 5)`，每圈 = 满环 / 4，半径按 `值 / 满环` 归一；低属性不会缩成一点，高属性也不会顶出画面。
- 配色沿用羊皮纸墨色（`#ddd2b6` 网格、`#8a5b1f` 数据、`#fffdf6` 点描边），据此**任何主题下、打印出来都一致**；`prefers-reduced-motion` 下取消入场动画。
- 位置：角色卡抬头下方、承伤 / 命运等数值框之上（`.sheet-radar`）。

### 4. 音效模块瘦身（`js/audio.js`）

3.0 的环境低鸣（两个失谐低频 + 滤波器 + 页眉「环境音」开关 + `prefs.amb`）整段删除，只保留 7 种合成音：点击 / 翻页 / 抽屉开合 / 掷骰 / 购买 / 错误 / 主题切换；页眉原来的「音效 + 环境音」双开关合并为一个「音效」开关。

## 四、3.0 新增

### 1. 音效（`js/audio.js`）

浏览器 **WebAudio 现场合成**，不含任何音频文件，因此离线、单文件、无版权素材负担：

| 音效 | 触发点 |
|---|---|
| `click` | 加点、选起源、切换等阶页、增删装备、撤销 |
| `page` | 切换创建步骤（配合过场） |
| `open` / `close` | 详情抽屉展开 / 关闭 |
| `dice` | 掷属性、掷利润因子、收购检定 |
| `buy` | 购买进阶与属性提升、加入装备、导出 JSON |
| `error` | 超预算、达上限、清空取消 |
| `theme` | 切换配色主题 |
| ~~环境低鸣~~ | 3.0 的页眉「环境音」开关（两个失谐低频 + 过滤噪声，默认关闭）**已在 3.1 删除**，改由 `assets/audio/bgm.mp3` 提供背景音乐 |

- 首次点击 / 按键才创建 AudioContext（浏览器自动播放策略要求），之后自动解锁。
- 页眉「音效」开关，状态存 `localStorage: rt-chargen-sfx`。
- 所有调用都包在 `try/catch` 里：没有 WebAudio 的环境（或冒烟测试页）只是静音，不影响功能。

### 2. 过场动画与动效（`js/fx.js`）

| 动效 | 说明 |
|---|---|
| 启动页 | 双头鹰徽记 + 「行商浪人」标题 + 进度条；`load` 后 520 ms 淡出，点击任意处跳过，2.2 s 兜底；`?nofx=1` 可直接跳过 |
| 步骤过场 | 切换步骤时全屏暗场 + 骷髅饰带 + 步骤名，0.66 s 自动收起（新内容在遮罩下已渲染好，不会闪白） |
| HUD 数字滚动 | 等阶/经验/剩余 XP/承伤/命运/利润/九项属性，0.52 s 从旧值缓动到新值（`data-from` 记录旧值，首次直接显示） |
| 面板浮现 | 每次重绘给 `.panel/.opdetail/.gcard/.addbar` 加 `--i` 序号，按 26 ms 间隔依次淡入 |
| 脉冲 | 购买成功 / 等阶提升时的高亮光环 |

- 页眉「动效」开关，状态存 `localStorage: rt-chargen-fx`；关闭后所有过场立即降级为瞬时切换。
- 尊重系统「减少动态效果」：`@media (prefers-reduced-motion: reduce)` 下动画全部关闭。
- 「重看过场」按钮可重播启动页。

### 3. 角色卡：技能 / 天赋可选全展开

- 角色卡里「技能（受训）」与「天赋」各是一个折叠区块（`.sheet .fold`），**默认只显示标签**（保持牌面紧凑）。
- 每个区块右上角有「全部展开 / 仅标签」；角色卡上方另有全局「展开技能与天赋全文 / 收起为标签」。
- 展开后逐条显示：名称、技能类型与关键属性（或天赋组标记）、正文、技能使用 / 简表效果 / 获取前提、规则书页码；标签本身仍可点开右侧抽屉。
- 展开状态存进角色数据（`state.ui.expandSkills / expandTalents`），换页、刷新、导出导入都会保留。
- 打印时强制展开（`@media print`），并隐藏切换按钮。
- 接口：`App.expandSheet('skills' | 'talents' | 'all', true|false)`。

### 4. 界面重制（3.1 起为六套主题）

| 区域 | 改动 |
|---|---|
| 背景 | 舰船城市插画压到 8.5% 透明度做底纹，叠加暗角与渐变；各套主题另调底色与纹理，不影响正文可读性 |
| 页眉 | 双头鹰徽记 + 三层信息；主题由下拉框改为**六枚色环按钮**（3.1）；新增音效 / 音乐 / 动效开关与「重看过场」；底部一枚卷轴饰带分隔 |
| HUD | 每个数值改成「小标题 + 数字」胶囊，加经验预算进度条，等阶与属性用金色强调 |
| 步骤导航 | 序号圆徽 + 左侧竖向引导线；当前步骤金色实心徽，已访问步骤打勾 |
| 面板 / 表格 / 按钮 / 卡片 | 面板加渐变与四角括饰；表头渐变、斑马纹、行悬停；按钮渐变 + 悬浮抬升 + 按压回弹；起源卡片与装备卡片悬浮描金 |
| 角色卡 | 羊皮纸纹理 + 骷髅花纹边框水印 + 铜色标题；属性格与数值框统一为米色卡片 |
| 响应式 | 1180 / 900 / 600 px 三档：页眉换行、步骤条转横向滚动、角色卡单列、九宫格属性转三列 |
| 打印 | 隐藏过场、页眉图标、装饰层与折叠按钮，角色卡铺满 A4 |

### 5. 素材管线（`tools/build_assets.py`）

用户提供的插画放在 `D:\临时`，脚本一次性生成前端素材（Pillow）：

- **白底转透明**：按亮度反推 alpha 并清零淡噪点，用于徽记、饰带、边框、伺服颅骨。
- **行墨自动分带**：三条卷轴饰带原本在一张竖图上，脚本按每行墨量找到 3 段连通区间再各自裁边（`ink_bands()`），避免手工等分切到半个骷髅。
- **调色板量化**：RGBA 渐隐边缘直接存 PNG 会有几百 KB，量化到 24–56 色后整包从 3.7 MB 降到约 480 KB。
- **程序化纹理**：羊皮纸由噪点 + 纤维 + 高阶模糊生成，4 KB。
- 页眉/启动页的墨线徽记在深色底上不可见，统一用主题变量 `--mark-filter`（反相 + 调色）着色，三套主题各有自己的色调。

## 五、2.1 新增：天赋全文（147 条）

| 项目 | 内容 |
|---|---|
| 条目 | 147 条（表 4-1 全部行） |
| 字段 | `effect` 简表效果 / `prereq` 获取前提 / `desc` 第四章正文 / `group` 天赋组可选组别 / `special` 特殊说明 / `page` 出处页 / `isGroup` 是否天赋组 |
| 天赋组 | 18 条（简表标 † 的 16 条 + 简表漏标的「竞争对手」「有口皆碑」，二者正文都列了组别） |
| 别名 | `talents.json` 的 `alias` 记录书中前后不一致的写法：基本武器训练→基础武器训练、快速装弹→快速装填 |
| 写法归一 | 进阶表里的 `血肉苦弱3`、`宿敌（任一）`、`(帝国海军)赴汤蹈火`、`重型武器训练(择一)(x2)` 由 `calc.talentCandidates()` 逐层剥离 †、计数、括注、前缀组别后落回词典：职业/起源共 210 种写法命中 202，剩 8 条是第二章表格断行粘连的残句（如 `灵能等级3灵能能力(x2)`），界面按普通文字显示 |
| 交互 | 与技能同一套：悬停 350ms 出摘要 → 点击开抽屉（正文 / 简表效果 / 可选组别 / 获取前提 / 特殊 / 页码），Esc 关闭；天赋标签用虚线边框与技能（实线）区分 |
| 接入点 | 起源选项天赋、职业「起始天赋」、第三步进阶表的天赋行、角色卡天赋折叠区；第三步末尾附**天赋速查**面板（147 条，可按名称 / 效果 / 组别搜索） |

## 六、2.0 新增：装备库 / 技能 / 特性

1. **完整军械库（264 件，第五章 P172-226）**

   | 分类 | 数量 | 分类 | 数量 |
   |---|---|---|---|
   | 远程武器 | 48 | 护甲 | 20 |
   | 近战武器 | 26 | 装备 | 20 |
   | 异种武器 | 15 | 药品 | 15 |
   | 手榴弹与导弹 | 14 | 工具 | 37 |
   | 弹药 | 28 | 赛博植入物 | 26 |
   | 武器升级 | 15 | | |

   每件记录 `类别 / 射程 / 射速 / 伤害 / 穿甲 / 弹容 / 装填(回合+动作) / 特性 / 重量 / 稀有度(文字+修正) / 覆盖位置 / AP / 出处页`。
   抽取方式：`pdfplumber` 按 x 坐标还原表格列（纯文本会把 `E270完整` 这类相邻单元格粘死），跨页被切断的行名与稀有度自动拼回（如「重弹机枪 (乌塞德)」）。

2. **技能全文（48/48）**：`desc`（正文）、`uses`（技能使用）、`groups`（技能组）、`special`（特别用法，共 11 项技能 21 条）、`page`（出处页）。第三章按「技能名（基础/高级，分类）」锚点分段抽取；原书把「特别用法：安全系统」错印在「科技使用」段末，已按正文归位到「安保」。

3. **武器特性词典（20 条）**：`traits.json` 收录充能/可靠/精准/平衡/防御/火焰/柔韧/不精准/过热/能量力场/原始/撕裂/毒素/散射/自动/爆炸/烟雾/致盲/眩晕/猛攻 等说明，界面里所有特性小标签可点开。

4. **交互**：技能/特性/装备统一为「悬停 350ms 出摘要 → 点击开右侧抽屉看全文并附页码」，抽屉支持 Esc 关闭。

## 七、规则出处

- 属性生成、起源之路、经验与利润因子：第一章 P6–36（起源之路 P10–29，表 1-5 P34–35）
- 职业道途、属性提升方案、等阶进阶表：第二章 P37–111（表 2-2 等阶 P40）
- 技能表 3-1 与技能全文：第三章 P112–132（训练/专精 P112–113）
- 天赋：第四章 P133–160（表 4-1 天赋简表 P134–140、天赋正文 P140–160）
- 武器特性说明：第五章 P166–171；军械库表 5-4 ~ 5-16：P172–226
  （远程 5-4 P172、手榴弹/导弹 5-6 P183、异种武器 5-7 P187、近战 5-8 P190、武器升级 5-9 P196、弹药 5-10/5-11 P200/202、护甲 5-12 P204、装备 5-13 P208、药品 5-14 P212、工具 5-15 P216、赛博植入物 5-16 P225）
- 承伤 = 坚韧加值 ×2 + 1d5（各家园世界另有 ±flat）；命运点按家园世界查表（P12–20）

## 八、数据质量与已知限制

1. **职业进阶表**：1238 行，53.3% 带前置条件。由 `tools/build_data.py` 从 PDF 纯文本自动解析（PDF 表格存在“名字 +10 与花费粘连成 +10200”“前置条件与下一行名字粘连”等问题，已用词表回溯修正）。名字结构异常行约 **1.1%**（多为“灵能等级2”这类正常带数字名称）。如发现某行前置条件不符，可在原书对应页核对后直接改 `data/careers.json`。
2. **首席武装员 / 超然星语者只有等阶 1–7**：这是原文（V0.3 译本）中这两条道途缺失等阶 8 表格所致，并非解析遗漏。
3. **军械库已内置，但有 3 处原书自身的问题**：
   - 「动力锤(低出力)」原表未印重量与稀有度 → 该行 `wt`/`rarity` 为 `null` 并在界面标注“原书未标注重量/稀有度”，不臆造数值。
   - 表 5-16 中「俄歇阵列」重复印了两行，完全相同 → 抽取时按 (分类, 名称, 重量, 稀有度) 精确去重，合并 1 行。
   - 「克鲁特步枪(近战)」「临时武器」原表稀有度为「—」，按“无市价”处理（`no_price`）。
   - 特性「不平衡」在书中只在「平衡」条目正文里顺带解释，未单列标题，因此 `traits.json` 缺这一条（界面会提示“未单列说明”）；表 5-5「致幻的影响」属于效果表而非装备，未录入。
4. **负重 / 疲劳等表未内置**：装备库只统计总重量，是否启用负重上限由 GM 决定（核心规则书未给统一上限）。
5. **天赋写法残留（2.1 起）**：仍有 8 种职业表写法无法归位——第二章表格断行把两个天赋粘成一行（`灵能等级3灵能能力(x2)`、`平等待遇（星语者）敏锐感官(味觉)`…），界面按普通文字显示，不影响购买与 XP 计算；如要修正，改 `data/careers.json` 对应行的 `n` 后重打包即可。
6. **浏览器兼容**：脚本是 ES6（箭头函数、模板字符串、`const/let`），样式依赖 CSS 变量、Grid、`gap`、`clamp()`、`backdrop-filter`，因此需要 Chrome/Edge 79+、Firefox 75+、Safari 13.1+。IE 内核（含双核浏览器的“兼容模式”）会白屏：`index.html` 已加 `renderer=webkit` 内核声明，并用一段 ES5 脚本在检测不到 `window.App` 时显示可读提示。
7. **音效 / 音乐 / 动效都是增强项**：没有 WebAudio、或浏览器拦截自动播放时，静音但不报错；`prefers-reduced-motion` 或页眉「动效」开关关闭时，所有过场瞬时完成。`App.setTheme()` 仍是公开接口，若外部页面没有 `#themeSeg`，只切换 `body[data-theme]`。
8. **背景音乐只是一首**（`assets/audio/bgm.mp3`，约 5 MB，循环播放）：没有播放列表、没有记忆播放位置；点了「音乐」才下载（`preload="none"`），所以不开音乐不占流量。换曲跑 `tools/build_bgm.py` 即可，其余界面不用改。
9. **无头自动化要桩掉音频与弹窗**：部分环境（无音频设备的服务器 / RDP 会话）里 `new AudioContext()` 会长时间阻塞渲染线程；而 `alert()` 在无头模式下没人点「确定」，会把渲染进程永久卡住。`tools/smoke.html` 已在开头把 `AudioContext`、`HTMLMediaElement.play/pause`、`alert/confirm/prompt` 全部换成桩，自己写脚本时也要照做。
10. **素材版权**：`assets/img` 的插画、徽记、饰带改自使用者提供的《行商浪人》官方美术（GW / Owlcat），`assets/audio/bgm.mp3` 同样来自使用者提供的音源，仅供本地个人游玩使用，不随代码授权分发；羊皮纸纹理由脚本生成，无第三方素材。
11. 若重新运行 `tools/build_data.py`（不带 `--bundle-only`），会重解析技能表，但脚本会**保留** `build_skills.py` 写入的 desc/uses/groups/special/page 字段。

## 九、维护命令

```powershell
# 只重新打包 bundle（改了 JSON 后执行，最常用）
& 'C:\Program Files\python\python.exe' tools\build_data.py --bundle-only

# 从规则书纯文本重建 careers/skills（默认读取 40k-rt-text\行商浪人核心规则书_V0.3_全文.txt）
& 'C:\Program Files\python\python.exe' tools\build_data.py

# 军械库：先缓存表格结构（可分页段跑，断点续跑），再抽取
& 'C:\Program Files\python\python.exe' tools\probe_tables.py 172 236
& 'C:\Program Files\python\python.exe' tools\build_gear.py

# 武器特性 / 技能全文（第三章原文按页导出后抽取）
& 'C:\Program Files\python\python.exe' tools\extract_text.py 112 171 data\_ch3_full.txt
& 'C:\Program Files\python\python.exe' tools\build_traits.py
& 'C:\Program Files\python\python.exe' tools\build_skills.py

# 天赋全文（第四章原文 P133-161 + 表 4-1 表格缓存 P134-140）
& 'C:\Program Files\python\python.exe' tools\extract_text.py 133 161 data\_ch4_full.txt
& 'C:\Program Files\python\python.exe' tools\build_talents.py
& 'C:\Program Files\python\python.exe' tools\build_data.py --bundle-only

# 3.0 素材：从 D:\临时 的插画重新生成 assets/img（改图后执行）
& 'C:\Program Files\python\python.exe' tools\build_assets.py

# 3.1 背景音乐：.ncm / .mp3 / .flac → assets/audio/{bgm.mp3,bgm.json,bgm-meta.js} + assets/img/bgm-cover.jpg
#    （.ncm 解码需要 pycryptodome；换曲才需要跑，平时直接双击 index.html 即可）
& 'C:\Program Files\python\python.exe' tools\build_bgm.py "D:\临时\Clash of Convictions.ncm"

# 数据质量统计
& 'C:\Program Files\python\python.exe' tools\quality.py

# 逻辑 + 数据单测（76 项）
node tools\test_calc.js

# 浏览器冒烟测试（79 项）：标题为 SMOKE PASS、body[data-smoke] 为 79/79 即通过
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new --disable-gpu `
  --user-data-dir="$env:TEMP\rt-smoke" --virtual-time-budget=8000 `
  --dump-dom 'file:///D:/AIsoft/rt-chargen/tools/smoke.html' | Select-String 'data-smoke'
# Edge 同理：把 chrome.exe 换成 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
# 注意 1：--dump-dom 会连页面内联脚本一起输出，脚本里的 'FAIL' 字样不算失败，以 data-smoke / 标题为准
# 注意 2：Windows 下若用 Python 调用，必须把 stdout 指向真实文件（stdout=open(...)），
#         接管道（capture_output=True）会拿不到 DOM。
# 注意 3：页面里的 alert() 在无头模式下没人点「确定」，会卡住渲染进程让 --dump-dom 永远不返回；
#         smoke.html 已把 alert/confirm/prompt 与 AudioContext、media.play/pause 换成桩。
```

> 依赖：`pdfplumber`（抽取 PDF 表格/文本，需 Pillow、pdfminer.six）；`tools/build_assets.py` 只需 Pillow。纯前端运行不需要 Python。

## 十、后续可加（未做）

- 第六章灵能学派与灵能检定、第七章导航者（第三眼/亚空间航行）面板
- 第八章星舰：船体与部件用舰船点购买
- 装备升级（表 5-9）与具体武器的关联校验（当前作为独立条目记录）
- 多角色管理 + 团队视图（共享利润因子与星舰）
- 天赋「进阶」层级（书中部分天赋可多次获取）在界面上按次数标注
- 多首曲目 / 播放列表与「只在某一步骤播某首」（当前只有一首循环）
- 九维雷达叠加「起源前 / 当前 / 满环」三条数据线对比
