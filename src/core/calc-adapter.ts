import { Generations, Pokemon, Move, Field, calculate, SPECIES, MOVES, ITEMS } from '@smogon/calc';
import type { CalcResult, FieldConfig, PokemonConfig, StatPoints, Stats } from '@/types';
import { STAT_KEYS, computeChampionStats, applyStages } from './champion-stats';

/**
 * Showdown 物种名 → @smogon/calc Species.get() 的 key
 * calc 0.12 的 Dex.get 需要「全小写 + 去所有分隔符」格式：
 *   "Garchomp" → "garchomp"
 *   "Raichu-Alola" → "raichualola"
 *   "Garchomp-Mega-Z" → "garchompmegaz"
 */
export function toCalcKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** 各世代顶层字典（用于枚举物种/招式/道具名，Showdown 格式 key） */
export function getGenDicts(genNum: number) {
  const idx = Math.max(0, Math.min(9, genNum | 0));
  return {
    speciesDict: SPECIES[idx] ?? {},
    movesDict: MOVES[idx] ?? {},
    itemsList: Array.isArray(ITEMS[idx]) ? ITEMS[idx] : [],
  };
}

/* =========================================================================
 * @smogon/calc 适配器
 * =========================================================================
 *
 * 【为什么不能把 SP 换算成 EV（重点）】
 * 主系列的面板公式是：能力 = floor( (floor((2×种族 + 个体值 + floor(努力值/4)) × 等级/100) + 5) × 性格 )
 * 它是一条「先乘等级、再加常数、再取整」的复合取整链，SP 与 EV 之间并不存在线性等价关系：
 *   · SP 是「直接加在最终能力上」的（HP +SP、其它先 +SP 再乘性格）；
 *   · EV 需要先 /4、再参与等级缩放，中间被 floor 截断，会出现/消失 1 点误差；
 *   · 一旦用 Math.min(sp * 8, 252) 之类的换算，SP=32 会被截断成 EV=252，
 *     从而在部分种族值/性格组合下算出比真实面板低 1 点的结果；
 *   · 而且《宝可梦冠军》根本不存在 IV/EV 这两个概念，任何换算都只是「近似」。
 * 所以本项目采用【方案 A】：不做任何 EV 换算，直接给出冠军公式算出的面板数值。
 *
 * 【方案 A 的两条实现路径】
 *  路径 1（首选，零误差）：@smogon/calc 0.12 已内置冠军世代 Generations.get(0)。
 *      它的 Stats.calcStatChampions(gen, stat, base, sp, nature) 的第 4 个形参
 *      **就是 SP 本身**（HP = base + sp + 75；其它 = floor(nature × (base + sp + 20))）。
 *      因此只需把 SP 直接塞进 Pokemon 构造器的 `evs` 字段即可，全程没有任何 EV 语义。
 *  路径 2（兜底，用于没有 gen 0 的旧版本）：用 gen 9 + Lv.50 + IV31 + EV0，
 *      此时面板公式退化为 HP = base + 75、其它 = floor((base + 20) × nature)，
 *      再把 SP 折叠进 `overrides.baseStats`（即 baseStats[k] + sp[k]），
 *      得到的最终面板与冠军公式**逐点相等**，同样跳过了 calc 内置的 EV 计算。
 * ========================================================================= */

let cachedGen: any = null;
let cachedIsChampions = true;

/** 取得用于计算的世代对象，并标记是否为冠军世代（gen 0） */
export function getGeneration(): { gen: any; isChampions: boolean } {
  if (cachedGen) return { gen: cachedGen, isChampions: cachedIsChampions };
  try {
    const gen = Generations.get(0);
    if (!gen || !gen.species) throw new Error('gen 0 dex missing');
    cachedGen = gen;
    cachedIsChampions = true;
  } catch {
    // 兜底：退回到第九世代，并用「折叠 SP 到 baseStats」的方案 A 近似实现
    cachedGen = Generations.get(9);
    cachedIsChampions = false;
  }
  return { gen: cachedGen, isChampions: cachedIsChampions };
}

/** 从世代图鉴读取种族值（用于面板展示） */
function lookupBaseStats(gen: any, speciesName: string): Stats | null {
  let sp: any;
  const key = toCalcKey(speciesName);
  try {
    sp = gen.species.get ? gen.species.get(key) : gen.species[speciesName];
  } catch {
    sp = null;
  }
  if (!sp || !sp.baseStats) return null;
  return { ...sp.baseStats } as Stats;
}

/**
 * 构造 @smogon/calc 的 Pokemon 对象
 * @param cfg 该侧的配置
 * @param moves 需要带上的招式（攻击方通常只带 1 个用于计算）
 */
export function buildPokemon(cfg: PokemonConfig, moves: string[] = []): any {
  const { gen, isChampions } = getGeneration();

  const options: any = {
    nature: cfg.nature,
    ability: cfg.ability || undefined,
    item: cfg.item || undefined,
    moves: moves.filter(Boolean),
    // 能力变化（-6~+6）：calc 内部按等级倍率参与伤害计算；HP 无能力变化
    boosts: {
      atk: cfg.stages?.atk ?? 0,
      def: cfg.stages?.def ?? 0,
      spa: cfg.stages?.spa ?? 0,
      spd: cfg.stages?.spd ?? 0,
      spe: cfg.stages?.spe ?? 0,
    },
  };

  if (isChampions) {
    // ===== 方案 A · 路径 1：冠军世代直接把 SP 当 SP 用 =====
    // gen 0 会强制等级 50，且 calcStatChampions 的第 4 个形参就是 SP，无需任何换算。
    options.evs = { ...cfg.sp };
  } else {
    // ===== 方案 A · 路径 2：gen 9 + 折叠 SP 进 baseStats =====
    options.level = 50;
    options.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    options.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const base = lookupBaseStats(gen, cfg.species);
    if (base) {
      const folded: any = {};
      for (const k of STAT_KEYS) folded[k] = base[k] + (cfg.sp[k] ?? 0);
      options.overrides = { baseStats: folded };
    }
  }

  return new Pokemon(gen, cfg.species, options);
}

/** 取出计算后 Pokemon 的面板数值 */
function statsOf(pokemon: any, fallback: Stats): Stats {
  const out: Stats = { ...fallback };
  for (const k of STAT_KEYS) {
    const v = pokemon?.stats?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** 计算防御侧「按冠军公式推算」的面板（用于与 calc 结果做交叉自检） */
function formulaStatsOf(gen: any, cfg: PokemonConfig): Stats | null {
  const base = lookupBaseStats(gen, cfg.species);
  if (!base) return null;
  return computeChampionStats(base, cfg.sp, cfg.nature);
}

/** 把 Result.damage 规整成「各随机档位的伤害值」数组 */
function extractRolls(damage: unknown): number[] {
  if (typeof damage === 'number') return [damage];
  if (Array.isArray(damage)) {
    if (damage.length === 0) return [];
    if (typeof damage[0] === 'number') return damage as number[];
    // 多维（多段攻击等）：取每一行的最大值作为该档位伤害，仅作近似
    return (damage as any[]).map((row) => (Array.isArray(row) ? Math.max(...row) : Number(row)));
  }
  return [];
}

/** 兼容不同版本 calc 的 range() 返回形式 */
function extractRange(result: any, rolls: number[]): [number, number] {
  try {
    if (typeof result.range === 'function') {
      const r = result.range();
      if (Array.isArray(r) && r.length >= 2) return [r[0], r[1]];
      if (r && typeof r === 'object') {
        if (typeof r.min === 'number' && typeof r.max === 'number') return [r.min, r.max];
      }
    }
  } catch {
    /* 忽略，走下面的兜底 */
  }
  if (rolls.length > 0) return [Math.min(...rolls), Math.max(...rolls)];
  return [0, 0];
}

/** 目标伤害的最大/最小百分比对应的进度条颜色 */
export function damageBarColor(maxPct: number, koChance: number): string {
  if (koChance >= 1) return '#dc2626'; // 确定击杀
  if (maxPct >= 100) return '#ef4444';
  if (maxPct >= 50) return '#f59e0b';
  if (maxPct >= 25) return '#84cc16';
  return '#22c55e';
}

/** KO 概率的中文描述 */
export function koLabel(koRolls: number, koTotal: number): string {
  if (koTotal <= 0) return '—';
  const ratio = koRolls / koTotal;
  if (ratio >= 1) return '确定击杀 (16/16)';
  if (ratio === 0) return '无法击杀 (0/16)';
  if (ratio >= 0.75) return `大概率击杀 (${koRolls}/16)`;
  if (ratio >= 0.25) return `可能击杀 (${koRolls}/16)`;
  return `小概率击杀 (${koRolls}/16)`;
}

/** 主入口：跑一次伤害计算 */
export function runCalculation(input: {
  attacker: PokemonConfig;
  defender: PokemonConfig;
  move: string;
  field: FieldConfig;
}): CalcResult {
  const { gen, isChampions } = getGeneration();
  const empty: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  const fail = (error: string, attackerStats: Stats = empty, defenderStats: Stats = empty): CalcResult => ({
    ok: false,
    error,
    rolls: [],
    min: 0,
    max: 0,
    minPct: 0,
    maxPct: 0,
    defenderHP: 0,
    koRolls: 0,
    koTotal: 0,
    koChance: 0,
    hitsToKO: [0, 0],
    attackerStats,
    defenderStats,
    basePower: 0,
    moveType: '',
    desc: '',
  });

  if (!input.attacker.species || !input.defender.species || !input.move) {
    return fail('请先选择攻击方、防守方与招式');
  }

  let attacker: any;
  let defender: any;
  let move: any;
  try {
    attacker = buildPokemon(input.attacker, [input.move]);
    defender = buildPokemon(input.defender, []);
    move = new Move(gen, input.move, {});
  } catch (e: any) {
    return fail(`构造失败：${e?.message ?? e}（请确认物种名/招式名是否存在于冠军图鉴）`);
  }

  const atkRaw = statsOf(attacker, formulaStatsOf(gen, input.attacker) ?? empty);
  const defRaw = statsOf(defender, formulaStatsOf(gen, input.defender) ?? empty);
  const defenderHP = defRaw.hp || 1;

  // 面板展示：套用能力变化（HP 不变）。伤害计算本身由 calc 内部使用 boosts，
  // 这里的数值只用于展示与 KO 概率对照（HP 与能力变化无关，KO 分母不受影响）。
  const atkStats = applyStages(atkRaw, input.attacker.stages);
  const defStats = applyStages(defRaw, input.defender.stages);

  const field = new Field({
    weather: (input.field.weather || undefined) as any,
    terrain: (input.field.terrain || undefined) as any,
    defenderSide: {
      isReflect: input.field.isReflect,
      isLightScreen: input.field.isLightScreen,
      isAuroraVeil: input.field.isAuroraVeil,
    },
  });

  let result: any;
  try {
    result = calculate(gen, attacker, defender, move, field);
  } catch (e: any) {
    return fail(`计算出错：${e?.message ?? e}`, atkStats, defStats);
  }

  if (!result) return fail('该招式组合无法计算（可能为基础变化招式或零威力）', atkStats, defStats);

  const rolls = extractRolls(result?.damage);
  const [min, max] = extractRange(result, rolls);
  const koTotal = rolls.length;
  const koRolls = rolls.filter((d) => d >= defenderHP).length;

  const best = max > 0 ? Math.max(1, Math.ceil(defenderHP / max)) : 0;
  const worst = min > 0 ? Math.max(1, Math.ceil(defenderHP / min)) : 0;

  return {
    ok: true,
    rolls,
    min,
    max,
    minPct: (min / defenderHP) * 100,
    maxPct: (max / defenderHP) * 100,
    defenderHP,
    koRolls,
    koTotal,
    koChance: koTotal > 0 ? koRolls / koTotal : 0,
    hitsToKO: best > 0 && worst > 0 ? [Math.min(best, worst), Math.max(best, worst)] : [0, 0],
    attackerStats: atkStats,
    defenderStats: defStats,
    basePower: move?.basePower ?? 0,
    moveType: String(move?.type ?? ''),
    desc: `${isChampions ? '冠军世代(gen 0)' : '第九世代(方案A 折叠 baseStats)'} · ${input.attacker.species} 的 ${input.move}`,
  };
}

/** 环境参数可选项（中文标注；仅保留 calc gen 0 实测生效的天气） */
export const WEATHER_OPTIONS = [
  { value: '', label: '无' },
  { value: 'Sun', label: '大晴天（火 ×1.5 / 水 ×0.5）' },
  { value: 'Rain', label: '下雨（水 ×1.5 / 火 ×0.5）' },
  { value: 'Sand', label: '沙暴（岩石特防 ×1.5）' },
  { value: 'Snow', label: '下雪（冰系防御 ×1.5）' },
];

export const TERRAIN_OPTIONS = [
  { value: '', label: '无' },
  { value: 'Electric', label: '电气场地（电系 ×1.3）' },
  { value: 'Grassy', label: '青草场地（草系 ×1.3）' },
  { value: 'Psychic', label: '精神场地（超能系 ×1.3）' },
  { value: 'Misty', label: '薄雾场地（龙系 ×0.5）' },
];
