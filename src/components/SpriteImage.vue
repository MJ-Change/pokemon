<template>
  <!--
    图片容错组件：
    按 candidates 顺序依次尝试加载，任何一张失败(@error)就自动切下一张，
    列表最后一项固定是本地精灵球占位图 public/pokeball.svg，因此永远不会出现裂图。
  -->
  <img
    class="pc-sprite"
    :src="src"
    :alt="alt"
    :width="size"
    :height="size"
    :style="{ width: size + 'px', height: size + 'px' }"
    loading="lazy"
    @error="handleError"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PLACEHOLDER_SPRITE } from '@/services/pokeapi';

const props = withDefaults(
  defineProps<{
    /** 候选图片地址，按顺序尝试 */
    candidates: string[];
    alt?: string;
    /** 展示尺寸（px） */
    size?: number;
  }>(),
  { alt: '宝可梦图片', size: 40 },
);

const index = ref(0);

// 候选列表变化（比如选中了别的宝可梦）时重置尝试位置
watch(
  () => props.candidates,
  () => {
    index.value = 0;
  },
);

const list = computed(() =>
  props.candidates && props.candidates.length > 0 ? props.candidates : [PLACEHOLDER_SPRITE],
);

const src = computed(() => list.value[Math.min(index.value, list.value.length - 1)]);

function handleError() {
  // 还有下一张候选就继续尝试，否则停在最后一张（本地占位图）
  if (index.value < list.value.length - 1) index.value += 1;
}
</script>

<style scoped>
.pc-sprite {
  object-fit: contain;
  border-radius: 6px;
  background: #f8fafc;
  flex: 0 0 auto;
}
</style>
