<template>
  <!-- 带官方图片的宝可梦搜索下拉框 -->
  <el-select
    :model-value="modelValue"
    filterable
    clearable
    :filter-method="filterMethod"
    :placeholder="placeholder || '搜索宝可梦（支持中文 / 英文 / 图鉴编号）'"
    class="pc-pokemon-select"
    popper-class="pc-pokemon-select-popper"
    @update:model-value="onChange"
    @visible-change="onVisibleChange"
  >
    <!-- 已选项的小图标 -->
    <template #prefix>
      <SpriteImage v-if="current" :candidates="current.sprites" :size="22" :alt="current.nameZh" />
    </template>

    <el-option v-for="item in filtered" :key="item.name" :label="item.label" :value="item.name">
      <div class="pc-opt">
        <SpriteImage :candidates="item.sprites" :size="34" :alt="item.nameZh" />
        <div class="pc-opt__text">
          <div class="pc-opt__zh">
            {{ item.nameZh }}
            <el-tag v-if="item.isMega" size="small" type="warning" effect="plain">Mega</el-tag>
            <el-tag v-if="!item.legal" size="small" type="danger" effect="plain">M-C 不可用</el-tag>
          </div>
          <div class="pc-opt__en">{{ item.nameEn }}</div>
        </div>
      </div>
    </el-option>

    <template #empty>
      <div class="pc-opt-empty">
        <template v-if="!repo.loaded">正在加载冠军图鉴…</template>
        <template v-else-if="keyword">没有匹配的宝可梦</template>
        <template v-else>输入关键词以缩小范围（当前仅展示前 {{ MAX_RENDER }} 条）</template>
      </div>
    </template>
  </el-select>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import SpriteImage from './SpriteImage.vue';
import { ensureSprite, usePokemonRepo } from '@/composables/usePokemonRepo';
import type { PokemonEntry } from '@/types';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const repo = usePokemonRepo();
const keyword = ref('');
/** 未搜索时最多渲染多少条，避免一次渲染几百个带图选项 */
const MAX_RENDER = 60;

const filtered = computed<PokemonEntry[]>(() => {
  const all = repo.entries as PokemonEntry[];
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return all.slice(0, MAX_RENDER);
  const hit = all.filter(
    (e) =>
      e.nameZh.toLowerCase().includes(kw) ||
      e.nameEn.toLowerCase().includes(kw) ||
      e.baseSpecies.toLowerCase().includes(kw) ||
      String(e.id) === kw,
  );
  return hit.slice(0, MAX_RENDER);
});

const current = computed<PokemonEntry | undefined>(() => repo.byName.get(props.modelValue));

/** 自定义过滤：同时匹配中文名 / 英文名 / 基础种名 / 图鉴编号 */
function filterMethod(query: string) {
  keyword.value = query ?? '';
}

function onChange(value: string) {
  emit('update:modelValue', value ?? '');
  if (value) ensureSprite(value);
}

function onVisibleChange(visible: boolean) {
  if (!visible) keyword.value = '';
}
</script>

<style scoped>
.pc-pokemon-select {
  width: 100%;
}

.pc-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
}

.pc-opt__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  overflow: hidden;
}

.pc-opt__zh {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.pc-opt__en {
  font-size: 11px;
  color: #94a3b8;
}

.pc-opt-empty {
  padding: 10px 12px;
  color: #94a3b8;
  font-size: 12px;
}
</style>
