# 宝可梦冠军 · 伤害计算器（Regulation M-C）

纯前端 Web 应用：只做两件事 —— **伤害计算** 与 **当前赛季规则（Regulation M-C，2026-09-09 ~ 2026-12-02）合法性校验**。

- 框架：**Vue 3 + TypeScript + Vite**
- UI：**Element Plus**（zh-cn 语言包，全站简体中文，仿 PokeCamp 浅色卡片风格）
- 计算引擎：**@smogon/calc**（直接使用其内置的「冠军世代」`Generations.get(0)`）
- 数据源：**PokeAPI**（图片 / 种族值）、本地 **`src/data/pokemon-zh.json`**（中英映射）、本地 **`src/data/regulations/m-c.json`**（规则白名单）

---

## 一、快速开始

```bash
# 1. 安装依赖（Node.js ≥ 18）
npm install

# 2.（可选）补全白名单与中文名：从 @smogon/calc 冠军图鉴 + PokeAPI 自动生成
npm run build:data

# 3. 启动开发服务器
npm run dev

# 4. 生产构建 / 预览
npm run build
npm run preview
```

> `npm run build:data -- --no-zh` 只补全白名单，不请求 PokeAPI。

### 从零搭建同等项目的步骤

```bash
npm create vite@latest my-calc -- --template vue-ts
cd my-calc
npm i element-plus @element-plus/icons-vue @smogon/calc
npm i -D vue-tsc typescript @types/node
```

然后：

1. `vite.config.ts` 配置 `@` → `./src` 别名，并把 `@smogon/calc` 加入 `optimizeDeps.include`（它是 CommonJS 包，交给 Vite 预构建可避免 dev 下 named export 报错）。
2. `tsconfig.json` 打开 `resolveJsonModule`（要直接 `import` 本地 JSON）、`paths: {"@/*": ["src/*"]}`。
3. `src/main.ts` 中 `createApp(App).use(ElementPlus, { locale: zhCn })`，并引入 `element-plus/dist/index.css`。

---

## 二、目录结构

```
e:/pokemon
├── index.html
├── vite.config.ts
├── tsconfig.json
├── scripts/
│   └── build-data.mjs                 # 一键补全白名单 + 中文名
├── public/
│   └── pokeball.svg                   # 图片加载失败时的本地占位图
└── src/
    ├── main.ts
    ├── App.vue                        # 页面装配（规则区 / 双方面板 / 环境 / 结果）
    ├── types/index.ts                 # SP、面板、规则、结果等类型定义
    ├── core/
    │   ├── champion-stats.ts          # ★ 冠军属性公式（方案 A 的数学基础）
    │   ├── calc-adapter.ts            # ★ @smogon/calc 适配器 + KO 概率 + 进度条颜色
    │   ├── regulation.ts              # ★ M-C 白名单校验函数
    │   └── type-info.ts               # 属性中英映射与配色
    ├── services/
    │   └── pokeapi.ts                 # ★ PokeAPI 请求封装 + 图片候选链（含 @error 容错）
    ├── composables/
    │   └── usePokemonRepo.ts          # ★ 冠军图鉴枚举 + 本地中英映射合并
    ├── components/
    │   ├── SpriteImage.vue            # 图片容错组件（@error → 下一张 → 精灵球）
    │   ├── PokemonSelect.vue          # 带官方图片的宝可梦搜索下拉
    │   ├── SearchSelect.vue           # 通用长列表可搜索下拉（招式 / 道具）
    │   ├── NatureSelect.vue           # 性格下拉
    │   ├── StatPointEditor.vue        # SP 0~32 输入 + 总量 66 校验 + 实时面板
    │   ├── AttackerPanel.vue          # 攻击方面板
    │   ├── DefenderPanel.vue          # 防守方面板
    │   ├── FieldPanel.vue             # 天气 / 场地 / 墙
    │   ├── DamageResult.vue           # 伤害范围、百分比、击杀概率、彩色进度条
    │   └── RegulationBar.vue          # 顶部规则区（M-C 下拉 + 白名单提示）
    └── data/
        ├── natures-zh.json            # 25 种性格中英映射
        ├── pokemon-zh.json            # {id, name_en, name_zh} 本地中英映射
        └── regulations/m-c.json       # ★ M-C 规则白名单
```

---

## 三、⚠️ 冠军属性系统与 SP：为什么不能把 SP 换算成 EV

《宝可梦冠军》**移除了 IV 与 EV**，改用 **SP（Stat Points，能力点数）**：单项上限 **32**，单只总计 **66**。

冠军属性公式（来源：Wikidex / Pokexperto 的 Pokémon Champions 词条，并与 `@smogon/calc` 的 `Stats.calcStatChampions()` 实现完全一致）：

```
HP   = 种族值 + SP + 75                      （脱壳忍者 base=1 时固定为 1）
其它 = ⌊ (种族值 + SP + 20) × 性格补正 ⌋       （性格补正 ∈ {1.1, 1.0, 0.9}）
```

**关键洞察**：当 SP 全为 0 时，该公式退化为 `HP = 种族值 + 75`、`其它 = ⌊(种族值 + 20) × 性格⌋`，这正好等于主系列 **Lv.50 / IV 31 / EV 0** 的面板值。也就是说，SP 的真正语义是「在 Lv.50-IV31-EV0 的基础上，每 1 点直接 +1 能力值」。

因此：

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| ❌ 被禁止的写法 | `evs = Math.min(sp * 8, 252)` | SP=32 时被截断成 EV=252（应为 256），在部分种族值/性格组合下会比真实面板**低 1 点**；且 EV 还要先 /4、再乘等级、再取整，误差无法用线性映射消除 |
| ⚠️ 方案 B | SP → 最接近的 EV 近似 | 只是「凑近似值」，仍有 1 点级误差，本项目未采用 |
| ✅ **方案 A（本项目采用）** | **不做任何 EV 换算，直接使用冠军公式算出的面板数值** | 零误差 |

### 方案 A 的两条实现路径（见 [calc-adapter.ts](file:///e:/pokemon/src/core/calc-adapter.ts)）

**路径 1（首选，零转换）**：`@smogon/calc` 0.12 已内置冠军世代。`Generations.get(0)` 的
`Stats.calcStatChampions(gen, stat, base, sp, nature)` 的第 4 个形参 **就是 SP**，
所以只要把 SP 直接塞进 `Pokemon` 构造器的 `evs` 字段即可：

```ts
const gen = Generations.get(0);              // 冠军世代，等级强制 Lv.50
const attacker = new Pokemon(gen, 'Garchomp', {
  nature: 'Jolly',
  evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, // ← 这里就是 SP，不是 EV
  ability: 'Rough Skin',
  item: 'Life Orb',
  moves: ['Earthquake'],
});
```

**路径 2（兜底，用于没有 gen 0 的旧版本）**：用 gen 9 + Lv.50 + IV31 + EV0（此时面板退化为
`HP = base + 75`、`其它 = ⌊(base + 20) × 性格⌋`），再把 SP **折叠进 `overrides.baseStats`**，
即令 `baseStats[k] = 原始种族值[k] + SP[k]`。这同样绕开了 calc 内置的 EV 计算，且面板结果与冠军公式**逐点相等**：

```ts
new Pokemon(gen, name, {
  level: 50,
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },   // 全部为 0，不参与计算
  overrides: { baseStats: { ...原始种族值, [k]: 原始种族值[k] + SP[k] } },
});
```

> 两条路径的面板数值完全一致，都会在 [DamageResult.vue](file:///e:/pokemon/src/components/DamageResult.vue) 的「攻击方/防守方面板」中展示，方便与游戏内面板逐项对照。

---

## 四、Regulation M-C 规则与校验

`src/data/regulations/m-c.json` 结构：

```json
{
  "regulation": "M-C",
  "startDate": "2026-09-09",
  "endDate": "2026-12-02",
  "game": "Pokémon Champions",
  "level": 50,
  "statPointTotal": 66,
  "statPointMaxPerStat": 32,
  "megaEvolutionsPerBattle": 1,
  "terastallization": false,
  "whitelistComplete": false,
  "legalPokemonIds": [3, 6, 9, 65, 68, 94],
  "legalSpecies": ["Venusaur", "Charizard", "Blastoise"],
  "legalMegas": ["Venusaur-Mega", "Charizard-Mega-X", "Absol-Mega-Z", "Salamence-Mega", "Garchomp-Mega-Z", "Lucario-Mega-Z"]
}
```

校验函数（[regulation.ts](file:///e:/pokemon/src/core/regulation.ts)）采用 **名称优先、图鉴编号兜底**：

1. 名字含 `-Mega`（含冠军新增的 `-Mega-Z` 写法）→ **必须命中 `legalMegas`**；
2. 普通形态 → 优先命中 `legalSpecies`；
3. 名称未命中 → 用全国图鉴编号命中 `legalPokemonIds` 兜底；
4. 都不命中 → 返回 `{ legal: false, message: '⚠️ 当前 M-C 规则下不可用' }`。

**校验失败不会阻止计算**：界面只做红色提示，计算结果照常输出。

> 名单补全：运行 `npm run build:data`，脚本会从 `@smogon/calc` 的冠军世代（gen 0）图鉴自动导出完整
> `legalPokemonIds / legalSpecies / legalMegas` 并把 `whitelistComplete` 置为 `true`。
> 也可以参考 Serebii / Bulbapedia 的 M-C 页面手动补充。

### Mega 进化限制

- `megaEvolutionsPerBattle = 1`：每场战斗**只能 Mega 进化一次**；前端通过下拉框直接选择 Mega 形态来体现。
- 冠军新增的 Mega（Absol-Mega-Z / Salamence-Mega / Garchomp-Mega-Z / Lucario-Mega-Z 等）已在 `legalMegas` 中列出，必须命中才可通过校验。

---

## 五、PokeAPI 请求封装与图片容错

[services/pokeapi.ts](file:///e:/pokemon/src/services/pokeapi.ts) 提供：

- `fetchPokemon(nameOrId)`：`/pokemon/{name_or_id}` 请求封装，带 **8s 超时（AbortController）+ 内存缓存**，解析出官方绘图、属性、种族值；
- `buildSpriteCandidates(id, name)`：**同步**生成候选图片地址链，选中即刻有图可渲染；
- `resolveSpriteCandidates(id, name)`：选中某只宝可梦后异步请求一次 PokeAPI，成功则把官方绘图提到最前，失败则静默保持静态候选链；
- `PLACEHOLDER_SPRITE = '/pokeball.svg'`：本地精灵球占位图。

候选链规则（冠军独占 Mega 在 PokeAPI 中不存在，会自动逐级回退）：

```
普通形态：PokeAPI 官方绘图 → Showdown 图鉴立绘 → /pokeball.svg
Mega 形态：Showdown 图鉴立绘 → 基础种 PokeAPI 官方绘图 → /pokeball.svg
```

**图片容错**在 [SpriteImage.vue](file:///e:/pokemon/src/components/SpriteImage.vue) 中统一实现：

```vue
<img :src="src" @error="handleError" />

<script setup lang="ts">
function handleError() {
  // 还有下一张候选就继续尝试，否则停在最后一张（本地精灵球占位图）
  if (index.value < list.value.length - 1) index.value += 1;
}
</script>
```

所有 `<img>` 都经该组件渲染，列表最后一项固定是本地精灵球，因此**永远不会出现裂图**。

---

## 六、本地中英映射

不实时请求 PokeAPI 的中文接口，改用离线表 `src/data/pokemon-zh.json`：

```json
[{ "id": 445, "name_en": "Garchomp", "name_zh": "烈咬陆鲨" }]
```

[usePokemonRepo.ts](file:///e:/pokemon/src/composables/usePokemonRepo.ts) 会把
`@smogon/calc` 冠军图鉴的 `species`（含各形态与 Mega）与这份映射合并，得到：

- 中文名（Mega 形态自动拼成「烈咬陆鲨·Mega」这类中文展示名）
- 全国图鉴编号、种族值、属性、特性列表
- 候选图片地址链
- M-C 合法性标记

搜索支持 **中文名 / 英文名 / 基础种名 / 图鉴编号** 四种方式（见 [PokemonSelect.vue](file:///e:/pokemon/src/components/PokemonSelect.vue)）。

---

## 七、界面说明

| 区域 | 内容 |
| --- | --- |
| 顶部规则区 | M-C 规则下拉、有效期、Mega 上限、SP 规则、白名单完整度提示、规则详情弹窗 |
| 攻击方面板 | 带图搜索宝可梦、性格、**SP 0~32 输入（含总量校验与实时面板）**、道具、特性、招式 |
| 防守方面板 | 带图搜索宝可梦、性格、**SP 0~32 输入**、道具、特性 |
| 环境参数 | 天气、场地、反射壁 / 光墙 / 极光幕 |
| 结果展示 | 伤害范围、百分比、击杀概率、按伤害占比与击杀率变色的进度条、击杀所需次数、双方面板 |

不在白名单内的宝可梦会在面板与顶部规则区显示
**「⚠️ 当前 M-C 规则下不可用」**，但**不会阻止计算**。

---

## 八、已知限制

- `legalSpecies / legalPokemonIds` 出厂为**种子数据**（`whitelistComplete: false`），请运行一次
  `npm run build:data` 补全；未补全前，未命中的宝可梦会被标记为不可用。
- 击杀概率按 `@smogon/calc` 返回的 16 档随机伤害统计（`rolls ≥ 防守方 HP` 的档位数 ÷ 16）；
  多段攻击等特殊招式的档位结构可能略有差异，脚本会做近似处理。
- 招式 / 道具 / 特性以英文（Showdown）名称展示，便于与社区配置直接对应。
