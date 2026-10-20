/**
 * 全局类型定义
 */

/** 六项能力代号（与 @smogon/calc、本地 natures-zh.json 保持一致） */
export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

/** 一组能力数值 */
export type Stats = Record<StatKey, number>;

/**
 * 能力点数（Stat Points, SP）
 * 《宝可梦冠军》取消了 IV 与 EV，改用 SP：单项 0~32，全队单只总计 66 点。
 */
export type StatPoints = Record<StatKey, number>;

/** 能力变化等级（-6 ~ +6；HP 恒为 0，不参与能力变化） */
export type StatStages = Record<StatKey, number>;

/** 一只宝可梦在某侧的完整配置 */
export interface PokemonConfig {
  /** 计算器使用的物种名（Showdown 命名，如 Garchomp / Charizard-Mega-X） */
  species: string;
  /** 性格英文名（如 Jolly） */
  nature: string;
  /** 能力点数 SP */
  sp: StatPoints;
  /** 能力变化（-6~+6），参与伤害计算并联动面板展示 */
  stages: StatStages;
  /** 特性英文名 */
  ability: string;
  /** 道具英文名 */
  item: string;
  /** 招式英文名列表（防守方一般留空） */
  moves: string[];
}

/** 环境参数 */
export interface FieldConfig {
  weather: string;
  terrain: string;
  /** 防守方：反射壁（减半物理伤害） */
  isReflect: boolean;
  /** 防守方：光墙（减半特殊伤害） */
  isLightScreen: boolean;
  /** 防守方：极光幕（需雪天，物理/特殊都减半） */
  isAuroraVeil: boolean;
}

/** 规则校验结果 */
export interface LegalityResult {
  legal: boolean;
  /** 简短结论，用于展示（如「⚠️ 当前 M-C 规则下不可用」） */
  message: string;
  /** 详细原因 */
  reason: string;
}

/** 图鉴条目（合并 @smogon/calc 冠军图鉴 + 本地中文映射） */
export interface PokemonEntry {
  /** 全国图鉴编号 */
  id: number;
  /** Showdown 物种名（含形态后缀） */
  name: string;
  /** 基础种名（Mega 形态时为进化前的基础种） */
  baseSpecies: string;
  nameEn: string;
  nameZh: string;
  /** 下拉框展示文本 */
  label: string;
  isMega: boolean;
  baseStats: Stats;
  types: string[];
  abilities: string[];
  /** 候选图片地址（按顺序尝试，最后一个为本地精灵球占位图） */
  sprites: string[];
  /** 当前规则下是否合法 */
  legal: boolean;
  /** 不合法时的提示 */
  illegalReason: string;
  /** 是否已尝试过异步补全图片（内部标记） */
  __spriteLoaded?: boolean;
}

/** 伤害计算结果 */
export interface CalcResult {
  ok: boolean;
  error?: string;
  /** 16 个随机数档位的伤害值 */
  rolls: number[];
  min: number;
  max: number;
  minPct: number;
  maxPct: number;
  /** 防守方最大 HP */
  defenderHP: number;
  /** 造成击杀的随机档位数 / 总档位数 */
  koRolls: number;
  koTotal: number;
  /** 击杀概率 0~1 */
  koChance: number;
  /** 击杀所需回合区间 [最少, 最多] */
  hitsToKO: [number, number];
  /** 攻击方面板（冠军公式） */
  attackerStats: Stats;
  /** 防守方面板（冠军公式） */
  defenderStats: Stats;
  /** 招式基础威力（用于展示） */
  basePower: number;
  /** 招式属性 */
  moveType: string;
  /** 是否命中要害以外的默认条件说明 */
  desc: string;
}
