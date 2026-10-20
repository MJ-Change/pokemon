import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import {fileURLToPath, URL} from 'node:url';

// Vite 配置
export default defineConfig({
  plugins: [vue()],
  // 相对路径 base：部署到 GitHub Pages 项目页（https://用户名.github.io/仓库名/）等任意子路径都可正常加载
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @smogon/calc 是 CommonJS 包，显式交给 Vite 预构建处理，避免 dev 下报 "does not provide an export named"。
  optimizeDeps: {
    include: ['@smogon/calc'],
  },
});
