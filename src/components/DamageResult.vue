<template>
  <div class="pc-card pc-result" :class="{ 'pc-result--reverse': sideTone === 'reverse' }">
    <div class="pc-card__title">
      {{ sideLabel || '计算结果' }}
    </div>

    <el-alert v-if="!result.ok && !fillEmpty" type="warning" :closable="false" show-icon :title="result.error" />

    <!-- 空状态占位：与左侧结果卡等高、垂直居中（用于反向卡未选招式时） -->
    <div v-else-if="!result.ok" class="pc-result__empty">
      {{ result.error }}
    </div>

    <template v-else>
      <!-- 伤害范围 -->
      <div class="pc-result__main">
        <div class="pc-result__num">
          <span class="pc-result__value">{{ result.min }} ~ {{ result.max }}</span>
          <span class="pc-muted">/ {{ result.defenderHP }} HP</span>
        </div>
        <div class="pc-result__pct">
          {{ pct(result.minPct) }} ~ {{ pct(result.maxPct) }}
        </div>
      </div>

      <!-- 伤害进度条：颜色随击杀概率/伤害占比变化 -->
      <div class="pc-bar">
        <div
          class="pc-bar__fill"
          :style="{ width: barWidth, background: barColor }"
        />
        <div class="pc-bar__label" :style="{ color: barColor }">
          {{ koText }}
        </div>
      </div>

      <div class="pc-result__row">
        <span>击杀所需回合：</span>
        <b>{{ result.hitsToKO[0] }} ~ {{ result.hitsToKO[1] }} 次</b>
      </div>
      <div class="pc-result__row">
        <span>招式：</span>
        <b>{{ moveName }}</b>
        <span class="pc-muted">威力 {{ result.basePower }} · {{ typeZh(result.moveType) }}</span>
      </div>

      <!-- 双方面板（冠军公式，方案 A） -->
      <div class="pc-stats">
        <div class="pc-stats__col">
          <div class="pc-stats__title">攻击方面板</div>
          <div v-for="k in STAT_KEYS" :key="'a' + k" class="pc-stats__line">
            <span>{{ STAT_ZH[k] }}</span><b>{{ result.attackerStats[k] }}</b>
          </div>
        </div>
        <div class="pc-stats__col">
          <div class="pc-stats__title">防守方面板</div>
          <div v-for="k in STAT_KEYS" :key="'d' + k" class="pc-stats__line">
            <span>{{ STAT_ZH[k] }}</span><b>{{ result.defenderStats[k] }}</b>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { STAT_KEYS, STAT_ZH } from '@/core/champion-stats';
import { damageBarColor, koLabel } from '@/core/calc-adapter';
import { typeZh } from '@/core/type-info';
import type { CalcResult } from '@/types';

const props = withDefaults(
  defineProps<{
    result: CalcResult;
    moveName: string;
    sideLabel?: string;
    sideTone?: 'normal' | 'reverse';
    /** 为 true 时，失败态渲染为居中占位块（与另一张结果卡保持视觉平衡） */
    fillEmpty?: boolean;
  }>(),
  { sideLabel: '', sideTone: 'normal', fillEmpty: false },
);

const barColor = computed(() =>
  damageBarColor(props.result.maxPct, props.result.koChance),
);

const barWidth = computed(() => `${Math.min(100, Math.max(2, props.result.maxPct))}%`);

const koText = computed(() =>
  props.result.ok ? koLabel(props.result.koRolls, props.result.koTotal) : '—',
);

function pct(v: number) {
  return `${v.toFixed(2)}%`;
}
</script>

<style scoped>
/* 卡片纵向布局：让空状态占位块可以撑满剩余高度 */
.pc-result {
  display: flex;
  flex-direction: column;
}

/* 方向主题色：正向 = 攻击方红，反向 = 防守方蓝 */
.pc-result:not(.pc-result--reverse) .pc-card__title {
  color: var(--pc-attacker);
}

.pc-result--reverse .pc-card__title {
  color: var(--pc-defender);
}

.pc-result__empty {
  flex: 1;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--pc-border);
  border-radius: 10px;
  color: var(--pc-text-sub);
  font-size: 13px;
  line-height: 1.8;
  text-align: center;
  padding: 16px;
}

.pc-result__main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.pc-result__value {
  font-size: 26px;
  font-weight: 700;
  color: var(--pc-text);
}

.pc-result__pct {
  font-size: 18px;
  font-weight: 600;
  color: var(--pc-primary);
}

.pc-bar {
  position: relative;
  height: 22px;
  border-radius: 11px;
  background: #eef2f8;
  overflow: hidden;
  margin: 12px 0;
}

.pc-bar__fill {
  height: 100%;
  transition: width 0.25s ease, background 0.25s ease;
}

.pc-bar__label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.pc-result__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 3px 0;
}

.pc-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--pc-border);
}

.pc-stats__title {
  font-size: 12px;
  color: var(--pc-text-sub);
  margin-bottom: 4px;
}

.pc-stats__line {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 1px 0;
}

.pc-stats__line b {
  font-weight: 600;
}
</style>
