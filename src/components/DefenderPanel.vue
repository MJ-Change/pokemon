<template>
  <div class="pc-card pc-card--defender">
    <div class="pc-card__title">
      <span>防守方</span>
      <el-tag v-if="entry" :type="entry.legal ? 'success' : 'danger'" size="small" effect="plain">
        {{ entry.legal ? 'M-C 可用' : 'M-C 不可用' }}
      </el-tag>
      <span v-if="entry" class="pc-muted pc-hp">满 HP {{ hpText }}</span>
    </div>

    <div class="pc-form-item">
      <span class="pc-label">宝可梦</span>
      <PokemonSelect :model-value="cfg.species" @update:model-value="patch('species', $event)" />
      <div v-if="entry" class="pc-types">
        <span
          v-for="t in entry.types"
          :key="t"
          class="pc-type"
          :style="{ background: typeColor(t) }"
        >
          {{ typeZh(t) }}
        </span>
        <span class="pc-muted">#{{ entry.id }}</span>
      </div>
      <div v-if="entry && !entry.legal" class="pc-warn">
        ⚠️ 当前 M-C 规则下不可用（{{ entry.illegalReason }}）；仍可继续计算。
      </div>
    </div>

    <div class="pc-form-item">
      <span class="pc-label">性格</span>
      <NatureSelect :model-value="cfg.nature" @update:model-value="patch('nature', $event)" />
    </div>

    <div class="pc-form-item">
      <span class="pc-label">能力点数（SP）</span>
      <StatPointEditor
        :sp="cfg.sp"
        :base-stats="entry ? entry.baseStats : ZERO_STATS"
        :nature="cfg.nature"
        @update:sp="patch('sp', $event)"
      />
    </div>

    <div class="pc-form-item">
      <span class="pc-label">能力变化</span>
      <StatStageEditor :model-value="cfg.stages" @update:model-value="patch('stages', $event)" />
    </div>

    <div class="pc-row">
      <div class="pc-form-item pc-flex">
        <span class="pc-label">特性</span>
        <SearchSelect
          :model-value="cfg.ability"
          :options="abilityOptions"
          placeholder="选择特性"
          @update:model-value="patch('ability', $event)"
        />
      </div>
    </div>

    <div class="pc-form-item">
      <span class="pc-label">招式</span>
      <SearchSelect
        :model-value="move"
        :options="repo.moves"
        placeholder="搜索招式"
        @update:model-value="$emit('update:move', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import PokemonSelect from './PokemonSelect.vue';
import SearchSelect from './SearchSelect.vue';
import StatPointEditor from './StatPointEditor.vue';
import StatStageEditor from './StatStageEditor.vue';
import NatureSelect from './NatureSelect.vue';
import { computeChampionStats } from '@/core/champion-stats';
import { typeColor, typeZh } from '@/core/type-info';
import { abilitiesToOptions, usePokemonRepo } from '@/composables/usePokemonRepo';
import type { PokemonConfig, Stats } from '@/types';

const props = defineProps<{ modelValue: PokemonConfig; move: string }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: PokemonConfig): void;
  (e: 'update:move', value: string): void;
}>();

const repo = usePokemonRepo();
const cfg = computed(() => props.modelValue);
const entry = computed(() => repo.byName.get(props.modelValue.species));

const ZERO_STATS: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

const abilityOptions = computed(() => abilitiesToOptions(entry.value?.abilities ?? []));

/** 防守方的满 HP（按冠军公式 HP = 种族值 + SP + 75） */
const hpText = computed(() => {
  if (!entry.value) return '—';
  return String(computeChampionStats(entry.value.baseStats, cfg.value.sp, cfg.value.nature).hp);
});

function patch<K extends keyof PokemonConfig>(key: K, value: PokemonConfig[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value } as PokemonConfig);
}

watch(entry, (e) => {
  if (!e) return;
  if (props.modelValue.ability && !e.abilities.includes(props.modelValue.ability)) {
    patch('ability', e.abilities[0] ?? '');
  }
});
</script>

<style scoped>
.pc-flex {
  flex: 1;
  min-width: 0;
}

.pc-types {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.pc-type {
  color: #fff;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
}

.pc-hp {
  margin-left: auto;
  font-weight: 400;
}
</style>
