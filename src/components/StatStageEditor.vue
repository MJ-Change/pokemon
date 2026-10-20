<template>
  <div class="pc-stages">
    <div v-for="k in STAGE_KEYS_NO_HP" :key="k" class="pc-stages__item">
      <span class="pc-stages__label">{{ STAT_ZH[k] }}</span>
      <el-select
        :model-value="modelValue[k]"
        size="small"
        class="pc-stages__select"
        @update:model-value="set(k, $event)"
      >
        <el-option v-for="n in STAGE_RANGE" :key="n" :label="stageLabel(n)" :value="n" />
      </el-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STAT_KEYS, STAT_ZH, STAGE_MIN, STAGE_MAX } from '@/core/champion-stats';
import type { StatKey, StatStages } from '@/types';

const props = defineProps<{ modelValue: StatStages }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: StatStages): void }>();

/** HP 不参与能力变化 */
const STAGE_KEYS_NO_HP = STAT_KEYS.filter((k) => k !== 'hp') as StatKey[];

const STAGE_RANGE: number[] = [];
for (let n = STAGE_MAX; n >= STAGE_MIN; n--) STAGE_RANGE.push(n);

function stageLabel(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function set(k: StatKey, v: number) {
  emit('update:modelValue', { ...props.modelValue, [k]: v });
}
</script>

<style scoped>
.pc-stages {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pc-stages__item {
  flex: 1;
  min-width: 0;
}

.pc-stages__label {
  display: block;
  font-size: 11px;
  color: var(--pc-text-sub);
  margin-bottom: 2px;
}

.pc-stages__select {
  width: 100%;
}
</style>
