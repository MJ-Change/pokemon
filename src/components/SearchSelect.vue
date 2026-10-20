<template>
  <!--
    通用可搜索下拉框（用于招式 / 道具 / 特性长列表）
    支持两种 options 格式：
      1) string[]            → label = value = 字符串
      2) { label, value }[]  → label 用于显示（中文），value 用于绑定（英文，传给 calc）
  -->
  <el-select
    :model-value="modelValue"
    filterable
    clearable
    :filter-method="filterMethod"
    :placeholder="placeholder"
    :multiple="multiple"
    class="pc-search-select"
    @update:model-value="onChange"
    @visible-change="onVisibleChange"
  >
    <el-option
      v-for="opt in visible"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    />
    <template #empty>
      <div class="pc-empty">
        <template v-if="keyword">没有匹配项</template>
        <template v-else>共 {{ normalized.length }} 项</template>
      </div>
    </template>
  </el-select>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

/** 下拉选项的统一结构 */
interface SelectOption {
  /** 展示文本（支持中文） */
  label: string;
  /** 绑定值（英文，传给 calc） */
  value: string;
}

type RawOptions = string[] | SelectOption[];

const props = withDefaults(
  defineProps<{
    modelValue: string | string[];
    options: RawOptions;
    placeholder?: string;
    multiple?: boolean;
    /** 最大渲染条数；<= 0 表示不限制（完整渲染全部选项） */
    maxRender?: number;
  }>(),
  { placeholder: '请选择', multiple: false, maxRender: 0 },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: any): void }>();

const keyword = ref('');

/** 把原始 options 统一成 { label, value }[] */
const normalized = computed<SelectOption[]>(() => {
  const src = props.options as any[];
  if (src.length === 0) return [];
  if (typeof src[0] === 'string') {
    return src.map((s) => ({ label: String(s), value: String(s) }));
  }
  return src as SelectOption[];
});

const visible = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const list = normalized.value;
  const cap = props.maxRender > 0 ? props.maxRender : list.length;
  if (!kw) return list.slice(0, cap);
  return list
    .filter((o) => o.label.toLowerCase().includes(kw) || o.value.toLowerCase().includes(kw))
    .slice(0, cap);
});

function filterMethod(query: string) {
  keyword.value = query ?? '';
}

function onChange(value: any) {
  emit('update:modelValue', value ?? (props.multiple ? [] : ''));
}

function onVisibleChange(visible: boolean) {
  if (!visible) keyword.value = '';
}
</script>

<style scoped>
.pc-search-select {
  width: 100%;
}

.pc-empty {
  padding: 10px 12px;
  color: #94a3b8;
  font-size: 12px;
}
</style>
