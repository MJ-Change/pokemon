/**
 * 数据补全脚本（在你本机安装好依赖后运行一次即可）
 *
 *   npm install
 *   npm run build:data          # 补全白名单 + 中文名
 *   npm run build:data -- --no-zh   # 只补全白名单，不请求 PokeAPI
 *
 * 作用：
 *  1. 从 @smogon/calc 的「冠军世代」(Generations.get(0)) 图鉴导出完整名单，
 *     写回 src/data/regulations/m-c.json（legalPokemonIds / legalSpecies / legalMegas），
 *     并把 whitelistComplete 置为 true。
 *  2. 从 PokeAPI 抓取 zh-Hans 名称，补全 / 合并 src/data/pokemon-zh.json。
 *
 * 说明：冠军世代的图鉴本身就是冠军平衡/合法性清单，因此它是白名单的最佳数据源。
 *      若你的 @smogon/calc 版本没有 gen 0，脚本会给出提示并只做本地合并。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as calcPkg from '@smogon/calc';

const Generations = calcPkg.Generations ?? calcPkg.default?.Generations;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REG_PATH = resolve(root, 'src/data/regulations/m-c.json');
const ZH_PATH = resolve(root, 'src/data/pokemon-zh.json');
const NO_ZH = process.argv.includes('--no-zh');

/** 迭代 Dex（兼容数组 / 可迭代对象 / 普通字典） */
function dexValues(dex) {
  if (!dex) return [];
  if (typeof dex[Symbol.iterator] === 'function') {
    try {
      return Array.from(dex);
    } catch {
      /* ignore */
    }
  }
  return Object.values(dex);
}

/** 拆出形态后缀，用于拼中文名 */
function formeSuffix(name) {
  const mega = /-Mega(?:-([A-Za-z0-9]+))?$/.exec(name);
  if (mega) return `·Mega${mega[1] ? ' ' + mega[1].toUpperCase() : ''}`;
  const map = {
    '-Alola': '（阿罗拉的样子）',
    '-Galar': '（伽勒尔的样子）',
    '-Hisui': '（洗翠的样子）',
    '-Paldea': '（帕底亚的样子）',
  };
  for (const [k, v] of Object.entries(map)) {
    if (name.endsWith(k)) return v;
  }
  const paldea = /-Paldea-([A-Za-z]+)$/.exec(name);
  if (paldea) return `（帕底亚・${paldea[1]}）`;
  return '';
}

/** PokeAPI slug */
function slug(name) {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

async function fetchZhName(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const hit = (data.names ?? []).find((n) => n.language?.name === 'zh-Hans');
  return hit?.name ?? null;
}

async function main() {
  if (!Generations) {
    console.error('✗ 未能从 @smogon/calc 读取 Generations，请确认依赖已安装。');
    process.exit(1);
  }

  const regulation = JSON.parse(readFileSync(REG_PATH, 'utf8'));

  // ---------- 1) 导出冠军图鉴名单 ----------
  let gen;
  try {
    gen = Generations.get(0);
  } catch {
    gen = null;
  }

  if (!gen || !gen.species) {
    console.warn('⚠ 当前 @smogon/calc 版本没有冠军世代(gen 0)，跳过白名单同步。');
    console.warn('  可改用 Serebii / Bulbapedia 的 M-C 页面手动补全 legalPokemonIds / legalSpecies / legalMegas。');
  } else {
    const names = new Set();
    for (const sp of dexValues(gen.species)) {
      if (!sp?.name) continue;
      names.add(sp.name);
      for (const f of sp.otherFormes ?? []) names.add(f);
    }

    const ids = new Set();
    const species = [];
    const megas = [];
    for (const name of [...names].sort()) {
      const sp = typeof gen.species.get === 'function' ? gen.species.get(name) : gen.species[name];
      if (!sp) continue;
      if (typeof sp.num === 'number' && sp.num > 0) ids.add(sp.num);
      if (/-Mega(?:-[A-Za-z0-9]+)?$/i.test(name)) megas.push(name);
      else species.push(name);
    }

    if (ids.size === 0) {
      console.warn('⚠ 冠军图鉴条目缺少全国图鉴编号(num)，保留原有 legalPokemonIds。');
    } else {
      regulation.legalPokemonIds = [...ids].sort((a, b) => a - b);
    }
    regulation.legalSpecies = species;
    regulation.legalMegas = megas.length > 0 ? megas : regulation.legalMegas;
    regulation.whitelistComplete = true;
    regulation.notes = [
      'legalPokemonIds / legalSpecies / legalMegas 由 scripts/build-data.mjs 从 @smogon/calc 冠军世代(gen 0)图鉴自动导出。',
      'Pokémon Champions 每场战斗仅可 Mega 进化 1 次；太晶化在 M-C 中不可用。',
      '校验策略：名称优先、全国图鉴编号兜底；Mega 形态必须命中 legalMegas。',
      'SP 规则：单项上限 32，单只总量 66；属性公式 HP = 种族值 + SP + 75，其它 = ⌊(种族值 + SP + 20) × 性格⌋。',
    ];
    writeFileSync(REG_PATH, JSON.stringify(regulation, null, 2) + '\n', 'utf8');
    console.log(`✓ 已写入白名单：物种 ${species.length} 项，编号 ${regulation.legalPokemonIds.length} 项，Mega ${regulation.legalMegas.length} 项`);
  }

  // ---------- 2) 补全中文名 ----------
  const existing = existsSync(ZH_PATH) ? JSON.parse(readFileSync(ZH_PATH, 'utf8')) : [];
  const zhMap = new Map(existing.map((r) => [r.name_en, r]));

  if (NO_ZH) {
    console.log('· 已跳过 PokeAPI 中文名补全（--no-zh）');
    return;
  }

  const entries = regulation.legalSpecies.concat(regulation.legalMegas);
  const baseBySlug = new Map();
  for (const n of entries) {
    const base = n.replace(/-Mega(?:-[A-Za-z0-9]+)?$/i, '');
    baseBySlug.set(slug(base), base);
  }

  const court = [];
  const baseIds = new Map(); // base name -> national dex id
  for (const id of regulation.legalPokemonIds) baseIds.set(id, id);

  // 逐个基础种去 PokeAPI 查 zh-Hans（限量并发 + 简单节流）
  const uniqueIds = [...new Set(regulation.legalPokemonIds)];
  console.log(`· 正在从 PokeAPI 抓取 ${uniqueIds.length} 条中文名…`);
  for (let i = 0; i < uniqueIds.length; i += 4) {
    const batch = uniqueIds.slice(i, i + 4);
    await Promise.all(
      batch.map(async (id) => {
        try {
          const zh = await fetchZhName(id);
          if (zh) court.push({ id, zh });
        } catch {
          /* 网络失败就跳过，保留已有数据 */
        }
      }),
    );
    await new Promise((r) => setTimeout(r, 120));
  }

  const zhById = new Map(court.map((c) => [c.id, c.zh]));

  const out = [];
  for (const n of entries) {
    const isMega = /-Mega(?:-[A-Za-z0-9]+)?$/i.test(n);
    const base = n.replace(/-Mega(?:-[A-Za-z0-9]+)?$/i, '');
    const sp = typeof gen?.species?.get === 'function' ? gen.species.get(base) : undefined;
    const id = sp?.num ?? 0;
    const baseZh = zhById.get(id) ?? zhMap.get(base)?.name_zh ?? zhMap.get(n)?.name_zh ?? base;
    const old = zhMap.get(n);
    if (old) {
      out.push(old);
      continue;
    }
    out.push({ id, name_en: n, name_zh: isMega ? `${baseZh}${formeSuffix(n)}` : `${baseZh}${formeSuffix(n)}` });
  }

  writeFileSync(ZH_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`✓ 已写入 ${ZH_PATH}（共 ${out.length} 条，其中新抓取中文名 ${court.length} 条）`);
}

main().catch((e) => {
  console.error('✗ 执行失败：', e);
  process.exit(1);
});
