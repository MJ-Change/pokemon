<template>
  <!-- 性格下拉（中文名 + 性格增减项） -->
  <el-select
    :model-value="modelValue"
    filterable
    class="pc-full"
    placeholder="选择性格"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-option v-for="n in NATURES" :key="n.name" :label="natureLabel(n)" :value="n.name" />
  </el-select>
</template>

<script setup lang="ts">
import { NATURES, STAT_ZH } from '@/core/champion-stats';

defineProps<{ modelValue: string }>();
defineEmits<{ (e: 'update:modelValue', value: string): void }>();

/** 性格下拉的展示文本：中文名 + 增减项 */
function natureLabel(n: { name: string; nameZh: string; plus: string | null; minus: string | null }) {
  if (!n.plus || !n.minus) return `${n.nameZh}（${n.name} · 平衡）`;
  const plus = STAT_ZH[n.plus as keyof typeof STAT_ZH];
  const minus = STAT_ZH[n.minus as keyof typeof STAT_ZH];
  return `${n.nameZh}（${n.name} · +${plus} −${minus}）`;
}
</script>

<style scoped>
.pc-full {
  width: 100%;
}
</style>
