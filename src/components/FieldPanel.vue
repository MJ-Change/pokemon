<template>
  <div class="pc-card">
    <div class="pc-card__title">环境参数</div>

    <div class="pc-grid-3">
      <div class="pc-form-item">
        <span class="pc-label">天气</span>
        <el-select
          :model-value="modelValue.weather"
          class="pc-full"
          @update:model-value="patch('weather', $event)"
        >
          <el-option v-for="w in WEATHER_OPTIONS" :key="w.value" :label="w.label" :value="w.value" />
        </el-select>
      </div>

      <div class="pc-form-item">
        <span class="pc-label">场地</span>
        <el-select
          :model-value="modelValue.terrain"
          class="pc-full"
          @update:model-value="patch('terrain', $event)"
        >
          <el-option v-for="t in TERRAIN_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </div>

      <div class="pc-form-item">
        <span class="pc-label">防守方场地（墙）</span>
        <div class="pc-checks">
          <el-checkbox
            :model-value="modelValue.isReflect"
            @update:model-value="patch('isReflect', !!$event)"
          >
            反射壁
          </el-checkbox>
          <el-checkbox
            :model-value="modelValue.isLightScreen"
            @update:model-value="patch('isLightScreen', !!$event)"
          >
            光墙
          </el-checkbox>
          <el-checkbox
            :model-value="modelValue.isAuroraVeil"
            @update:model-value="patch('isAuroraVeil', !!$event)"
          >
            极光幕
          </el-checkbox>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TERRAIN_OPTIONS, WEATHER_OPTIONS } from '@/core/calc-adapter';
import type { FieldConfig } from '@/types';

const props = defineProps<{ modelValue: FieldConfig }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: FieldConfig): void }>();

function patch<K extends keyof FieldConfig>(key: K, value: FieldConfig[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value } as FieldConfig);
}
</script>

<style scoped>
.pc-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 900px) {
  .pc-grid-3 {
    grid-template-columns: 1fr;
  }
}

.pc-full {
  width: 100%;
}

.pc-checks {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  padding-top: 2px;
}
</style>
