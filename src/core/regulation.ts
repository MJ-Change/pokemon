import mcRaw from '@/data/regulations/m-c.json';
import type { LegalityResult } from '@/types';

/**
 * Regulation M-C 白名单校验
 * 规则数据来源：src/data/regulations/m-c.json（本地文件，不依赖网络）
 *
 * 校验策略：名称优先、图鉴编号兜底
 *  1. Mega 形态（名字含 "-Mega"）必须命中 legalMegas；
 *  2. 普通形态优先命中 legalSpecies；
 *  3. 若名称未命中，则用全国图鉴编号命中 legalPokemonIds 兜底；
 *  4. 都不命中 → 判定不可用（但**不阻止计算**，仅做提示）。
 */

export interface RegulationData {
  regulation: string;
  startDate: string;
  endDate: string;
  game: string;
  level: number;
  statPointTotal: number;
  statPointMaxPerStat: number;
  megaEvolutionsPerBattle: number;
  terastallization: boolean;
  whitelistComplete: boolean;
  legalPokemonIds: number[];
  legalSpecies: string[];
  legalMegas: string[];
  legalItems: string[];
  bannedItems: string[];
  notes: string[];
}

export const M_C: RegulationData = mcRaw as RegulationData;

/** 当前可选规则列表（本项目只做 M-C） */
export const REGULATIONS: RegulationData[] = [M_C];

export function getRegulation(id: string): RegulationData {
  return REGULATIONS.find((r) => r.regulation === id) ?? M_C;
}

/**
 * 名称是否属于 Mega 形态
 * 兼容主系列写法（Charizard-Mega-X / Absol-Mega）与冠军新增写法（Garchomp-Mega-Z）
 */
export function isMegaName(name: string): boolean {
  return /-Mega(?:-[A-Za-z0-9]+)?$/i.test(name);
}

/** 去掉 Mega 后缀，拿到基础种名（如 Charizard-Mega-X -> Charizard、Garchomp-Mega-Z -> Garchomp） */
export function baseSpeciesOf(name: string): string {
  return name.replace(/-Mega(?:-[A-Za-z0-9]+)?$/i, '');
}

/** 解析 Mega 后缀标签（X / Y / Z），用于中文展示 */
export function megaSuffixOf(name: string): string {
  const m = /-Mega-([A-Za-z0-9]+)$/i.exec(name);
  return m ? m[1].toUpperCase() : '';
}

/** 规则是否仍处于有效期（按当前系统时间判断） */
export function isRegulationActive(reg: RegulationData, now = new Date()): boolean {
  const start = new Date(`${reg.startDate}T00:00:00`);
  const end = new Date(`${reg.endDate}T23:59:59`);
  return now >= start && now <= end;
}

/**
 * 核心校验函数
 * @param speciesName 计算器使用的物种名（Showdown 命名，可能带 -Mega 后缀）
 * @param nationalDexId 全国图鉴编号（可空，用于兜底）
 * @param regulation 规则数据，默认 M-C
 */
export function checkLegality(
  speciesName: string,
  nationalDexId?: number,
  regulation: RegulationData = M_C,
): LegalityResult {
  if (!speciesName) {
    return { legal: true, message: '', reason: '尚未选择宝可梦' };
  }

  const mega = isMegaName(speciesName);
  const base = baseSpeciesOf(speciesName);

  // 1) Mega 形态：必须在 legalMegas 白名单内
  if (mega) {
    const hit = regulation.legalMegas.includes(speciesName);
    if (hit && regulation.legalPokemonIds.includes(nationalDexId ?? -1)) {
      return { legal: true, message: '', reason: `${speciesName} 在 M-C 允许的 Mega 名单内` };
    }
    if (hit) {
      return {
        legal: true,
        message: '',
        reason: `${speciesName} 在 M-C 允许的 Mega 名单内（基础种编号 ${nationalDexId} 未列入 legalPokemonIds，以名称判定为准）`,
      };
    }
    return {
      legal: false,
      message: '⚠️ 当前 M-C 规则下不可用',
      reason: `Mega 形态 ${speciesName} 不在 M-C 的 legalMegas 白名单内`,
    };
  }

  // 2) 普通形态：名称优先
  if (regulation.legalSpecies.includes(speciesName) || regulation.legalSpecies.includes(base)) {
    return { legal: true, message: '', reason: `${speciesName} 在 M-C 的 legalSpecies 名单内` };
  }

  // 3) 编号兜底
  if (nationalDexId !== undefined && regulation.legalPokemonIds.includes(nationalDexId)) {
    return {
      legal: true,
      message: '',
      reason: `全国图鉴编号 ${nationalDexId} 在 M-C 的 legalPokemonIds 名单内（名称未收录，按编号兜底）`,
    };
  }

  return {
    legal: false,
    message: '⚠️ 当前 M-C 规则下不可用',
    reason: `${speciesName}（编号 ${nationalDexId ?? '未知'}）不在 M-C 白名单内`,
  };
}

/** 道具是否被禁（M-C 暂无禁用道具数据时返回合法） */
export function checkItemLegality(item: string, regulation: RegulationData = M_C): boolean {
  if (!item) return true;
  if (regulation.bannedItems.includes(item)) return false;
  if (regulation.legalItems.length === 0) return true; // 名单未填写时不做限制
  return regulation.legalItems.includes(item);
}
