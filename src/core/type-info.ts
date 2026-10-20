/**
 * 属性（Type）中英映射与配色，仅用于界面展示
 */
export const TYPE_ZH: Record<string, string> = {
  Normal: '一般',
  Fire: '火',
  Water: '水',
  Electric: '电',
  Grass: '草',
  Ice: '冰',
  Fighting: '格斗',
  Poison: '毒',
  Ground: '地面',
  Flying: '飞行',
  Psychic: '超能',
  Bug: '虫',
  Rock: '岩石',
  Ghost: '幽灵',
  Dragon: '龙',
  Dark: '恶',
  Steel: '钢',
  Fairy: '妖精',
  Stellar: '星晶',
};

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a878',
  Fire: '#f08030',
  Water: '#6890f0',
  Electric: '#f8d030',
  Grass: '#78c850',
  Ice: '#98d8d8',
  Fighting: '#c03028',
  Poison: '#a040a0',
  Ground: '#e0c068',
  Flying: '#a890f0',
  Psychic: '#f85888',
  Bug: '#a8b820',
  Rock: '#b8a038',
  Ghost: '#705898',
  Dragon: '#7038f8',
  Dark: '#705848',
  Steel: '#b8b8d0',
  Fairy: '#ee99ac',
  Stellar: '#40b5a5',
};

export function typeZh(type: string): string {
  return TYPE_ZH[type] ?? type;
}

export function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#94a3b8';
}
