<template>
  <div class="pc-card pc-reg">
    <div class="pc-reg__row">
      <span class="pc-reg__label">当前赛季规则</span>
      <el-select
        :model-value="modelValue"
        class="pc-reg__select"
        @update:model-value="$emit('update:modelValue', $event)"
      >
        <el-option
          v-for="r in REGULATIONS"
          :key="r.regulation"
          :label="`Regulation ${r.regulation}（${r.game}）`"
          :value="r.regulation"
        />
      </el-select>

      <el-button link type="primary" size="small" @click="detailVisible = true">规则详情</el-button>
    </div>

    <el-alert
      v-if="!reg.whitelistComplete"
      class="pc-reg__alert"
      type="warning"
      show-icon
      :closable="false"
      title="白名单为种子数据，尚未完整收录"
      description="未命中的宝可梦会被标记为「⚠️ 当前 M-C 规则下不可用」，但不会阻止计算。运行 npm run build:data 可从 @smogon/calc 的冠军图鉴自动补全名单。"
    />

    <el-alert
      v-for="(w, i) in warnings"
      :key="i"
      class="pc-reg__alert"
      type="error"
      show-icon
      :closable="false"
      :title="w"
    />

    <el-dialog v-model="detailVisible" title="Regulation M-C 详情" width="560px">
      <div class="pc-reg__detail">
        <p><b>规则版本：</b>{{ reg.regulation }}（{{ reg.game }}）</p>
        <p><b>有效期：</b>{{ reg.startDate }} ~ {{ reg.endDate }}</p>
        <p><b>等级：</b>Lv.{{ reg.level }}（冠军规则固定）</p>
        <p><b>能力点数（SP）：</b>单项上限 {{ reg.statPointMaxPerStat }}，单只总量 {{ reg.statPointTotal }}</p>
        <p><b>Mega 进化：</b>每场战斗最多 {{ reg.megaEvolutionsPerBattle }} 次</p>
        <p><b>太晶化：</b>{{ reg.terastallization ? '允许' : '不允许' }}</p>
        <p><b>白名单：</b>物种 {{ reg.legalSpecies.length }} 项 / 图鉴编号 {{ reg.legalPokemonIds.length }} 项 / Mega {{ reg.legalMegas.length }} 项</p>
        <p><b>Mega 名单：</b>{{ reg.legalMegas.join('、') }}</p>
        <ul class="pc-muted">
          <li v-for="(n, i) in reg.notes" :key="i">{{ n }}</li>
        </ul>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { REGULATIONS, getRegulation } from '@/core/regulation';

const props = defineProps<{ modelValue: string; warnings?: string[] }>();
defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const detailVisible = ref(false);
const reg = computed(() => getRegulation(props.modelValue));
const warnings = computed(() => props.warnings ?? []);
</script>

<style scoped>
.pc-reg__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pc-reg__label {
  font-size: 13px;
  font-weight: 600;
}

.pc-reg__select {
  width: 260px;
}

.pc-reg__alert {
  margin-top: 10px;
}

.pc-reg__detail p {
  margin: 6px 0;
}
</style>
