<template>
  <!--
    SP（能力点数）分配器
    《宝可梦冠军》取消了 IV / EV，改为 SP：单项 0~32，单只总计 66。
    右侧「最终能力」一列直接由冠军公式实时推导（方案 A），所见即所得。
  -->
  <div class="sp-editor">
    <div class="sp-head">
      <span>能力</span>
      <span class="sp-head__num">种族值</span>
      <span class="sp-head__sp">SP（0-32）</span>
      <span class="sp-head__num">最终能力</span>
    </div>

    <div v-for="key in STAT_KEYS" :key="key" class="sp-row">
      <span class="sp-name">{{ STAT_ZH[key] }}</span>
      <span class="sp-base">{{ baseStats[key] }}</span>
      <div class="sp-ctrl">
        <el-slider
          :model-value="sp[key]"
          :min="0"
          :max="SP_MAX_PER_STAT"
          :show-tooltip="false"
          size="small"
          class="sp-slider"
          @update:model-value="((v: number | number[]) => setStat(key, v)) as any"
        />
        <el-input-number
          :model-value="sp[key]"
          :min="0"
          :max="SP_MAX_PER_STAT"
          :controls="false"
          size="small"
          class="sp-input"
          @update:model-value="((v: number | undefined) => setStat(key, v)) as any"
        />
      </div>
      <span class="sp-final" :class="{ 'is-up': isBoosted(key), 'is-down': isLowered(key) }">
        {{ finalStats[key] }}
      </span>
    </div>

    <div class="sp-total">
      <span>
        已分配 <b :class="totalClass">{{ total }}</b> / {{ SP_TOTAL }}
      </span>
      <span class="pc-muted">{{ hint }}</span>
      <el-button link type="primary" size="small" @click="clearAll">清空</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  SP_MAX_PER_STAT,
  SP_TOTAL,
  STAT_KEYS,
  STAT_ZH,
  computeChampionStats,
  natureMultiplier,
  totalSP,
  validateSP,
} from '@/core/champion-stats';
import type { StatKey, StatPoints, Stats } from '@/types';

const props = defineProps<{
  sp: StatPoints;
  baseStats: Stats;
  nature: string;
}>();
const emit = defineEmits<{ (e: 'update:sp', value: StatPoints): void }>();

/** 冠军公式实时面板（方案 A） */
const finalStats = computed<Stats>(() =>
  computeChampionStats(props.baseStats, props.sp, props.nature),
);

const total = computed(() => totalSP(props.sp));
const validation = computed(() => validateSP(props.sp));
const hint = computed(() => validation.value.message);
const totalClass = computed(() => ({
  'pc-ok': validation.value.valid && total.value === SP_TOTAL,
  'pc-warn': validation.value.valid && total.value !== SP_TOTAL,
  'pc-error': !validation.value.valid,
}));

/** 单项 SP 写入：兼容滑块（可能给出数组）与数字输入框（可能给出 undefined） */
function setStat(key: StatKey, value: number | number[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const v = Math.max(0, Math.min(SP_MAX_PER_STAT, Math.round(Number(raw ?? 0))));
  emit('update:sp', { ...props.sp, [key]: v } as StatPoints);
}

function clearAll() {
  emit('update:sp', { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
}

/** 该能力是否被性格提升 / 降低（仅用于着色提示） */
function isBoosted(key: StatKey) {
  return natureMultiplier(props.nature, key) > 1;
}
function isLowered(key: StatKey) {
  return natureMultiplier(props.nature, key) < 1;
}
</script>

<style scoped>
.sp-editor {
  border: 1px solid var(--pc-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fbfcfe;
}

.sp-head,
.sp-row {
  display: grid;
  grid-template-columns: 52px 48px 1fr 62px;
  align-items: center;
  gap: 8px;
}

.sp-head {
  font-size: 11px;
  color: var(--pc-text-sub);
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--pc-border);
}

.sp-head__num,
.sp-head__sp {
  text-align: center;
}

.sp-row {
  padding: 3px 0;
}

.sp-name {
  font-size: 12px;
}

.sp-base {
  font-size: 12px;
  text-align: center;
  color: var(--pc-text-sub);
}

.sp-ctrl {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp-slider {
  flex: 1;
}

.sp-input {
  width: 52px;
}

.sp-input :deep(.el-input__wrapper) {
  padding: 0 6px;
  box-shadow: none;
  background: #fff;
  border: 1px solid var(--pc-border);
}

.sp-final {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}

.sp-final.is-up {
  color: #16a34a;
}

.sp-final.is-down {
  color: #dc2626;
}

.sp-total {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--pc-border);
  font-size: 12px;
}
</style>
