/**
 * PokeAPI 请求封装
 *  - 统一处理超时、缓存与错误
 *  - 提供图片地址解析，并返回「候选列表」，配合 SpriteImage 组件的 @error 做容错
 *  - 冠军独占 Mega（如 Garchomp-Mega-Z、Lucario-Mega-Z）在 PokeAPI 中不存在，
 *    会自动回退到 Showdown 图鉴立绘 → 基础种官方绘图 → 本地精灵球占位图
 */

const API_BASE = 'https://pokeapi.co/api/v2';
const TIMEOUT = 8000;

/** 本地精灵球占位图（public/pokeball.svg） */
export const PLACEHOLDER_SPRITE = '/pokeball.svg';

/** PokeAPI 官方绘图地址 */
export function officialArtworkUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

/** PokeAPI 默认像素图（小尺寸，用于兜底） */
export function defaultSpriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

/** Showdown 图鉴立绘（覆盖 Mega 等全部形态） */
export function showdownDexUrl(speciesName: string): string {
  return `https://play.pokemonshowdown.com/sprites/dex/${toPokeApiSlug(speciesName)}.png`;
}

/** 把 Showdown 物种名转成 PokeAPI 的 slug（Mr. Mime -> mr-mime，Farfetch'd -> farfetchd） */
export function toPokeApiSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '') // Mr. Mime -> mr mime
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** 去掉 Mega 后缀，得到基础种名 */
export function toBaseSpecies(name: string): string {
  return name.replace(/-Mega(?:-[A-Za-z0-9]+)?$/i, '');
}

/**
 * 同步生成图片候选地址列表（无需网络，选中即刻渲染）
 * 顺序即尝试顺序，最后一定是本地精灵球占位图。
 */
export function buildSpriteCandidates(id: number, speciesName: string): string[] {
  const isMega = /-Mega(?:-[A-Za-z0-9]+)?$/i.test(speciesName);
  const list: string[] = [];
  if (isMega) {
    // Mega 形态优先用 Showdown 立绘（PokeAPI 没有冠军独占 Mega 的官方绘图）
    list.push(showdownDexUrl(speciesName));
    if (id) list.push(officialArtworkUrl(id)); // 兜底：基础种官方绘图
  } else {
    if (id) list.push(officialArtworkUrl(id)); // 首选：PokeAPI 官方绘图
    list.push(showdownDexUrl(speciesName));
  }
  list.push(PLACEHOLDER_SPRITE);
  return list;
}

/* ------------------------------ 请求封装 ------------------------------ */

export interface PokeApiPokemon {
  id: number;
  name: string;
  artwork: string;
  sprite: string;
  types: string[];
  abilities: string[];
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
}

/** 内存缓存，避免重复请求同一只宝可梦 */
const cache = new Map<string, PokeApiPokemon>();

const STAT_MAP: Record<string, keyof PokeApiPokemon['stats']> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
};

/**
 * 请求 PokeAPI 的 /pokemon/{name_or_id}
 * @throws 网络错误 / 404 / 超时
 */
export async function fetchPokemon(nameOrId: string | number): Promise<PokeApiPokemon> {
  const key = String(nameOrId).toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}/pokemon/${encodeURIComponent(key)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`PokeAPI ${res.status}: ${res.statusText}`);
    const data: any = await res.json();
    const stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const s of data.stats ?? []) {
      const k = STAT_MAP[s?.stat?.name];
      if (k) stats[k] = s.base_stat;
    }
    const parsed: PokeApiPokemon = {
      id: data.id,
      name: data.name,
      artwork: data?.sprites?.other?.['official-artwork']?.front_default ?? officialArtworkUrl(data.id),
      sprite: data?.sprites?.front_default ?? defaultSpriteUrl(data.id),
      types: (data.types ?? []).map((t: any) => t?.type?.name).filter(Boolean),
      abilities: (data.abilities ?? []).map((a: any) => a?.ability?.name).filter(Boolean),
      stats,
    };
    cache.set(key, parsed);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 异步解析图片候选列表：先尝试 PokeAPI，成功则把官方绘图提到最前面。
 * 失败时静默回退到静态候选列表（内置 @error 兜底链），不影响界面。
 */
export async function resolveSpriteCandidates(
  id: number,
  speciesName: string,
): Promise<string[]> {
  const staticList = buildSpriteCandidates(id, speciesName);
  try {
    const detail = await fetchPokemon(toPokeApiSlug(toBaseSpecies(speciesName)));
    const head = detail.artwork || staticList[0];
    return [head, ...staticList.filter((u) => u !== head)];
  } catch {
    return staticList;
  }
}

/** 清空缓存（调试用） */
export function clearPokeApiCache(): void {
  cache.clear();
}
