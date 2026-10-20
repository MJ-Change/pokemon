import natures from '@/data/natures-zh.json';
import type { StatKey, StatPoints, Stats, StatStages } from '@/types';

/* =========================================================================
 * 《宝可梦冠军》(Pokémon Champions) 能力值计算公式 —— 方案 A 的数学基础
 * =========================================================================
 *
 * 【公式来源】
 *  1) 社区实测资料（Wikidex / Pokexperto 的 Pokémon Champions 词条）：
 *       · HP(PS)     = 种族值 + PC + 75
 *       · 其它能力值 = floor( (种族值 + PC + 20) × 性格补正 )
 *     其中 PC 即 Stat Points(SP)，单项上限 32，单只总计 66。
 *
 *  2) @smogon/calc 0.12 已内置冠军世代（Generations.get(0)），
 *     其 Stats.calcStatChampions() 实现为：
 *       if (stat === 'hp') return base === 1 ? base : base + sp + 75;
 *       return Math.floor(nature * (base + sp + 20));   // nature ∈ {0.9, 1, 1.1}
 *     与 1) 完全一致（可交叉验证）。
 *
 * 【关键理解】把 SP 全部置 0 时，公式退化为：
 *       HP = 种族值 + 75、其它 = floor((种族值 + 20) × 性格)
 *   这恰好等于主系列「Lv.50 / 个体值 31 / 努力值 0」的面板值。
 *   也就是说：SP 的作用就是在 Lv.50 / IV31 / EV0 的基础上「每点 +1 能力值」。
 *   => 绝不能把 SP 当作 EV 去换算（详见 calc-adapter.ts 的说明）。
 * ========================================================================= */

export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_ZH: Record<StatKey, string> = {
  hp: 'HP',
  atk: '攻击',
  def: '防御',
  spa: '特攻',
  spd: '特防',
  spe: '速度',
};

/** 单项 SP 上限 */
export const SP_MAX_PER_STAT = 32;
/** 单只宝可梦 SP 总量 */
export const SP_TOTAL = 66;

/** 生成一份全 0 的 SP */
export function emptySP(): StatPoints {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

/* =========================================================================
 * 能力变化（Rank / Stage，-6 ~ +6）
 * ========================================================================= */

/** 能力变化等级下限 */
export const STAGE_MIN = -6;
/** 能力变化等级上限 */
export const STAGE_MAX = 6;

/** 生成一份全 0 的能力变化 */
export function emptyStages(): StatStages {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

/**
 * 能力变化等级 → 面板倍率（HP 恒为 1，不适用）：
 *   +n → (2 + n) / 2；-n → 2 / (2 - n)
 */
export function stageMultiplier(stage: number): number {
  const s = Math.max(STAGE_MIN, Math.min(STAGE_MAX, stage | 0));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/** 把能力变化套到一层面板上（HP 不受影响，其余向下取整） */
export function applyStages(stats: Stats, stages?: StatStages): Stats {
  const out = { ...stats };
  if (!stages) return out;
  for (const k of STAT_KEYS) {
    if (k === 'hp') continue;
    const s = stages[k] ?? 0;
    if (s !== 0) out[k] = Math.floor(stats[k] * stageMultiplier(s));
  }
  return out;
}

/** 本地性格数据（中英映射 + 增减项） */
export interface NatureInfo {
  name: string;
  nameZh: string;
  plus: StatKey | null;
  minus: StatKey | null;
}

export const NATURES: NatureInfo[] = natures as NatureInfo[];

/** 按英文名取性格 */
export function getNature(name: string): NatureInfo | undefined {
  return NATURES.find((n) => n.name === name);
}

/** 性格对某项能力的补正倍率：1.1 / 0.9 / 1 */
export function natureMultiplier(natureName: string, stat: StatKey): number {
  if (stat === 'hp') return 1; // HP 不受性格影响
  const n = getNature(natureName);
  if (!n || !n.plus || !n.minus) return 1; // 勤奋/坦率/认真/害羞/浮躁 为平衡性格
  if (n.plus === stat) return 1.1;
  if (n.minus === stat) return 0.9;
  return 1;
}

/**
 * 单一项能力的冠军公式计算
 * @param stat      能力代号
 * @param baseStat  种族值
 * @param sp        该项投入的 SP（0~32）
 * @param natureMul 性格补正倍率（HP 传 1）
 */
export function calcChampionStat(
  stat: StatKey,
  baseStat: number,
  sp: number,
  natureMul: number,
): number {
  if (stat === 'hp') {
    // HP = 种族值 + SP + 75（脱壳忍者 base=1 时固定为 1）
    return baseStat === 1 ? 1 : baseStat + sp + 75;
  }
  // 其它能力 = floor((种族值 + SP + 20) × 性格补正)
  return Math.floor(natureMul * (baseStat + sp + 20));
}

/** 按冠军公式算出六项最终面板数值 */
export function computeChampionStats(
  baseStats: Stats,
  sp: StatPoints,
  natureName: string,
): Stats {
  const out = {} as Stats;
  for (const key of STAT_KEYS) {
    out[key] = calcChampionStat(
      key,
      baseStats[key] ?? 0,
      sp[key] ?? 0,
      natureMultiplier(natureName, key),
    );
  }
  return out;
}

/** SP 已用总量 */
export function totalSP(sp: StatPoints): number {
  return STAT_KEYS.reduce((sum, k) => sum + (sp[k] ?? 0), 0);
}

/** SP 合法性校验：单项 ≤ 32，总量 ≤ 66 */
export function validateSP(sp: StatPoints): {
  total: number;
  valid: boolean;
  message: string;
} {
  const total = totalSP(sp);
  const overflow = STAT_KEYS.filter((k) => (sp[k] ?? 0) > SP_MAX_PER_STAT);
  if (overflow.length > 0) {
    return {
      total,
      valid: false,
      message: `以下项目超过单项上限 ${SP_MAX_PER_STAT}：${overflow
        .map((k) => STAT_ZH[k])
        .join('、')}`,
    };
  }
  if (total > SP_TOTAL) {
    return {
      total,
      valid: false,
      message: `SP 总量 ${total} 超过上限 ${SP_TOTAL}（超出 ${total - SP_TOTAL} 点）`,
    };
  }
  if (total < SP_TOTAL) {
    return { total, valid: true, message: `剩余 ${SP_TOTAL - total} 点未分配` };
  }
  return { total, valid: true, message: 'SP 分配合法' };
}

/** 把总 SP 均摊/裁剪到合法范围（供“自动分配”按钮使用） */
export function clampSP(sp: StatPoints): StatPoints {
  const out = emptySP();
  for (const k of STAT_KEYS) out[k] = Math.max(0, Math.min(SP_MAX_PER_STAT, Math.round(sp[k] ?? 0)));
  // 超总量时从后往前裁剪（速度 → 特防 …）
  let total = totalSP(out);
  for (let i = STAT_KEYS.length - 1; i >= 0 && total > SP_TOTAL; i--) {
    const k = STAT_KEYS[i];
    const cut = Math.min(out[k], total - SP_TOTAL);
    out[k] -= cut;
    total -= cut;
  }
  return out;
}
