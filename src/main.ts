import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';

import App from './App.vue';
import './styles/main.css';

// 全站简体中文：Element Plus 使用 zh-cn 语言包
createApp(App).use(ElementPlus, { locale: zhCn }).mount('#app');
