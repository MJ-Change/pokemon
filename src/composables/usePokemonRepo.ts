import { reactive } from 'vue';
import { ABILITIES } from '@smogon/calc';
import { getGeneration, getGenDicts, toCalcKey } from '@/core/calc-adapter';
import { M_C, baseSpeciesOf, checkLegality, isMegaName, megaSuffixOf } from '@/core/regulation';
import { buildSpriteCandidates, resolveSpriteCandidates } from '@/services/pokeapi';
import type { PokemonEntry, Stats } from '@/types';
import zhRaw from '@/data/pokemon-zh.json';
import zhNamesRaw from '@/data/zh-names.json';

/** 下拉选项：label 展示（中文），value 绑定（英文，传给 calc） */
export interface SelectOpt {
  label: string;
  value: string;
}

/**
 * 能力名 → 中文 label 的工具函数
 * @param abilities 物种实际可用的能力名（来自 Species.abilities）
 */
export function abilitiesToOptions(abilities: string[]): SelectOpt[] {
  const opts = abilities.map((en) => ({
    label: zhAbMap.has(en) ? `${zhAbMap.get(en)}（${en}）` : en,
    value: en,
  }));
  // 按中文名排序（无中文名的英文排在对应位置，英文兜底）
  return opts.sort(
    (a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN') || a.value.localeCompare(b.value),
  );
}

/** 招式 / 道具 / 特性的中文名映射表 */
interface ZhNames {
  moves: Array<{ en: string; zh: string }>;
  items: Array<{ en: string; zh: string }>;
  abilities: Array<{ en: string; zh: string }>;
}
const zhNames = zhNamesRaw as ZhNames;

/** 英文 → 中文名的 Map */
const zhMoveMap = new Map(zhNames.moves.map((r) => [r.en, r.zh]));
const zhItemMap = new Map(zhNames.items.map((r) => [r.en, r.zh]));
const zhAbMap = new Map(zhNames.abilities.map((r) => [r.en, r.zh]));

/** 本地中英映射表结构：id / name_en / name_zh */
interface ZhRow {
  id: number;
  name_en: string;
  name_zh: string;
}

/** 本地中英映射（不做实时 PokeAPI 中文请求，只用这份离线数据） */
const zhByEn = new Map<string, ZhRow>();
for (const row of zhRaw as ZhRow[]) {
  zhByEn.set(row.name_en, row);
}

/**
 * 从 calc Dex（Species/Moves/Items）读取条目。
 * calc 0.12 的 Dex.get() 需要「全小写 + 去分隔符」的 key，
 * 但 SPECIES/MOVES 顶层字典的 key 是 Showdown 格式，两种方式都要支持。
 */
function dexGet(dex: any, showdownName: string): any {
  if (!dex) return undefined;
  const calcKey = toCalcKey(showdownName);
  try {
    // 优先用 calc-key 调 .get()（返回完整数据，含 baseStats/name 等标准字段）
    if (typeof dex.get === 'function') {
      const hit = dex.get(calcKey);
      if (hit) return hit;
    }
    // 兜底：直接用 Showdown key 下标访问（返回精简数据）
    if (dex[showdownName]) return dex[showdownName];
  } catch {
    /* 忽略 */
  }
  return undefined;
}

/** Mega 形态的中文名：基础中文名 + ·Mega（+ 后缀） */
function megaZhName(baseZh: string, speciesName: string): string {
  const suffix = megaSuffixOf(speciesName);
  return `${baseZh}·Mega${suffix ? ` ${suffix}` : ''}`;
}

/**
 * 生成图鉴条目
 * @param gen calc 世代对象
 * @param speciesName Showdown 格式物种名（如 "Garchomp-Mega-Z"）
 */
function makeEntry(gen: any, speciesName: string): PokemonEntry | null {
  const sp = dexGet(gen.species, speciesName);
  if (!sp) return null;

  // 兼容两种返回结构：
  //   .get(calcKey) → 标准字段 baseStats {hp,atk,def,spa,spd,spe}
  //   SPECIES[idx][name] → 精简字段 bs {hp,at,df,sa,sd,sp}
  const baseStats: Stats | null = sp.baseStats
    ? ({ ...sp.baseStats } as Stats)
    : sp.bs
      ? ({
          hp: sp.bs.hp ?? 0,
          atk: 0, // 占位，下一行修复
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
        } as Stats)
      : null;

  if (!baseStats) return null;

  // 精简字段 bs → 标准字段
  if (sp.bs) {
    baseStats.atk = sp.bs.at ?? 0;
    baseStats.def = sp.bs.df ?? 0;
    baseStats.spa = sp.bs.sa ?? 0;
    baseStats.spd = sp.bs.sd ?? 0;
    baseStats.spe = sp.bs.sp ?? 0;
  }

  const isMega = isMegaName(speciesName);
  // calc 0.12 没有 baseSpecies 字段，从名称推导
  const baseName: string = isMega ? baseSpeciesOf(speciesName) : speciesName;
  const zhRow = zhByEn.get(speciesName) ?? zhByEn.get(baseName);
  // calc 0.12 也没有 num 字段，从 zhRow 兜底
  const id: number = zhRow?.id ?? 0;

  const baseZh = zhRow?.name_zh ?? baseName;
  const nameZh = isMega ? megaZhName(baseZh, speciesName) : baseZh;
  // 下拉展示用：中文名（英文物种名）
  const label = `${nameZh}（${speciesName}）`;

  const legality = checkLegality(speciesName, id, M_C);

  return {
    id,
    name: speciesName,
    baseSpecies: baseName,
    nameEn: speciesName,
    nameZh,
    label,
    isMega,
    baseStats,
    types: [...(sp.types ?? [])],
    // 注意：@smogon/calc 的 Species.abilities 是普通对象 {"0": "...", "1": "...", "H": "..."}，
    // 不能直接展开（会抛 "object is not iterable"），必须走 Object.values
    abilities: Array.from(new Set(Object.values(sp.abilities ?? {}).map((a) => String(a)))).sort(),
    sprites: buildSpriteCandidates(id, speciesName),
    legal: legality.legal,
    illegalReason: legality.legal ? '' : legality.reason,
  };
}

const state = reactive({
  loaded: false,
  /** 冠军世代（gen 0）图鉴是否可用 */
  isChampions: true,
  entries: [] as PokemonEntry[],
  byName: new Map<string, PokemonEntry>(),
  /** 招式列表（带中文名 label，v-model 绑英文 value） */
  moves: [] as SelectOpt[],
  /** 道具列表 */
  items: [] as SelectOpt[],
});

let built = false;

/** 构建图鉴（纯本地计算，第一次调用时执行一次） */
function build(): void {
  if (state.loaded || built) return;
  built = true;
  const { gen, isChampions } = getGeneration();
  state.isChampions = isChampions;
  const genNum = gen?.num ?? (isChampions ? 0 : 9);

  // calc 0.12 顶层导出的世代字典（Showdown 格式 key）
  const { speciesDict, movesDict, itemsList } = getGenDicts(genNum);

  // 优先：从 calc 物种字典枚举全部 Showdown 格式物种名
  const calcNames = Object.keys(speciesDict ?? {});
  const names = new Set<string>(calcNames);

  // 兜底：加上 m-c.json 白名单（避免冠军世代字典不完整）
  for (const n of M_C.legalSpecies) names.add(n);
  for (const n of M_C.legalMegas) names.add(n);

  const list: PokemonEntry[] = [];
  for (const n of names) {
    const e = makeEntry(gen, n);
    if (e) list.push(e);
  }

  // 排序：先按图鉴编号，基础形态在前，Mega 紧随其后
  list.sort((a, b) => {
    if (a.id !== b.id) return a.id - b.id;
    if (a.name === a.baseSpecies) return -1;
    if (b.name === b.baseSpecies) return 1;
    return a.name.localeCompare(b.name);
  });

  // 每个条目都包一层 reactive，保证后续异步补图片时能触发视图更新
  const reactiveList = list.map((e) => reactive(e));
  state.entries = reactiveList;
  state.byName.clear();
  for (const e of reactiveList) state.byName.set(e.name, e);

  // 招式列表：calc.MOVES[genNum] 是 Showdown 格式 key 的字典（冠军世代共 525 条）
  const moveOpts = Object.keys(movesDict ?? {})
    .filter((n) => n && n !== '(No Move)' && !n.startsWith('Hidden Power'))
    .map((n) => ({ label: zhMoveMap.get(n) ? `${zhMoveMap.get(n)}（${n}）` : n, value: n }));
  // 按中文名排序，方便中文用户完整浏览
  moveOpts.sort(
    (a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN') || a.value.localeCompare(b.value),
  );
  state.moves = moveOpts;

  // 道具列表：calc.ITEMS[genNum] 是 Showdown 格式字符串数组
  const itemOpts = (itemsList ?? [])
    .filter((n) => typeof n === 'string' && n)
    .map((n) => ({ label: zhItemMap.get(n) ? `${zhItemMap.get(n)}（${n}）` : n, value: n }));
  itemOpts.sort(
    (a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN') || a.value.localeCompare(b.value),
  );
  state.items = itemOpts;

  state.loaded = true;
}

/** 懒加载入口：首次调用时同步完成图鉴构建 */
export function usePokemonRepo() {
  build();
  return state;
}

/** 按名称取条目 */
export function getEntry(name: string): PokemonEntry | undefined {
  usePokemonRepo();
  return state.byName.get(name);
}

/**
 * 异步补全图片：选中某只宝可梦后请求一次 PokeAPI，把官方绘图提到候选列表最前面。
 * 失败则保持原有静态候选链（最终仍会回落到本地精灵球占位图）。
 */
export function ensureSprite(name: string): void {
  const entry = getEntry(name);
  if (!entry || entry.__spriteLoaded) return;
  entry.__spriteLoaded = true;
  void resolveSpriteCandidates(entry.id, entry.name).then((list) => {
    entry.sprites = list;
  });
}
