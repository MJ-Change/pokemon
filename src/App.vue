<template>
  <div class="pc-container">
    <header class="pc-header">
      <h1 class="pc-header__title">宝可梦冠军 · 伤害计算器</h1>
    </header>

    <!-- 顶部规则区：Regulation M-C -->
    <RegulationBar v-model="regulationId" :warnings="warnings" />

    <!-- 攻击方 / 防守方 -->
    <div class="pc-grid-2">
      <AttackerPanel v-model="attacker" v-model:move="move" />
      <DefenderPanel v-model="defender" v-model:move="defenderMove" />
    </div>

    <!-- 环境参数 -->
    <FieldPanel v-model="field" />

    <!-- 结果展示：攻击方→防守方 + 防守方→攻击方 -->
    <div class="pc-grid-2">
      <DamageResult :result="result" :move-name="move" side-label="攻击方 → 防守方" />
      <DamageResult
        :result="resultReverse"
        :move-name="defenderMove || '（未选）'"
        side-label="防守方 → 攻击方"
        side-tone="reverse"
        fill-empty
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import RegulationBar from './components/RegulationBar.vue';
import AttackerPanel from './components/AttackerPanel.vue';
import DefenderPanel from './components/DefenderPanel.vue';
import FieldPanel from './components/FieldPanel.vue';
import DamageResult from './components/DamageResult.vue';
import { runCalculation } from './core/calc-adapter';
import { validateSP, emptyStages } from './core/champion-stats';
import { usePokemonRepo } from './composables/usePokemonRepo';
import type { FieldConfig, PokemonConfig } from './types';

// 提前构建图鉴（同步、纯本地）
const repo = usePokemonRepo();

const regulationId = ref('M-C');

/**
 * 子面板通过 emit 回传「整份新配置对象」，因此这里用 ref 而非 reactive：
 * reactive 对象无法整体重新赋值（v-model 会生成赋值表达式），ref 则可以 .value = 新对象。
 */
const attacker = ref<PokemonConfig>({
  species: 'Garchomp',
  nature: 'Jolly',
  // 冠军 SP 规则：单项 ≤ 32，全只合计 66
  sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  stages: emptyStages(),
  ability: '',
  item: '',
  moves: ['Earthquake'],
});

const defender = ref<PokemonConfig>({
  species: 'Charizard',
  nature: 'Timid',
  sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
  stages: emptyStages(),
  ability: '',
  item: '',
  moves: [],
});

const move = ref('Earthquake');
const defenderMove = ref('');

const field = ref<FieldConfig>({
  weather: '',
  terrain: '',
  isReflect: false,
  isLightScreen: false,
  isAuroraVeil: false,
});

/** 主计算结果（攻击方 → 防守方，依赖变化时自动重算） */
const result = computed(() =>
  runCalculation({
    attacker: attacker.value,
    defender: defender.value,
    move: move.value,
    field: field.value,
  }),
);

/** 反向计算结果（防守方 → 攻击方） */
const resultReverse = computed(() => {
  if (!defenderMove.value) {
    return {
      ok: false as const,
      error: '请先在防守方「招式」栏选择一个招式',
      rolls: [], min: 0, max: 0, minPct: 0, maxPct: 0,
      defenderHP: 0, koRolls: 0, koTotal: 0, koChance: 0,
      hitsToKO: [0, 0] as [number, number],
      attackerStats: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      defenderStats: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      basePower: 0, moveType: '', desc: '',
    };
  }
  return runCalculation({
    attacker: defender.value,
    defender: attacker.value,
    move: defenderMove.value,
    field: field.value,
  });
});

/** 顶部告警：非法宝可梦 + SP 分配异常（只提示，不阻止计算） */
const warnings = computed(() => {
  const list: string[] = [];
  const sides: Array<[string, PokemonConfig]> = [
    ['攻击方', attacker.value],
    ['防守方', defender.value],
  ];
  for (const [side, cfg] of sides) {
    const entry = repo.byName.get(cfg.species);
    if (entry && !entry.legal) {
      list.push(`${side}「${entry.nameZh}」：⚠️ 当前 M-C 规则下不可用（${entry.illegalReason}）`);
    }
    const v = validateSP(cfg.sp);
    if (!v.valid) list.push(`${side} SP 分配异常：${v.message}`);
  }
  return list;
});
</script>

<style scoped>
.pc-header__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--pc-primary-dark);
}
</style>
