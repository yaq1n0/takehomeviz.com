import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { initTheme } from './lib/theme';
import './style.css';

import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faPlus,
  faXmark,
  faCheck,
  faShareNodes,
  faChevronDown,
  faChevronRight,
  faArrowRight,
  faRotateLeft,
  faSun,
  faMoon,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(
  faPlus,
  faXmark,
  faCheck,
  faShareNodes,
  faChevronDown,
  faChevronRight,
  faArrowRight,
  faRotateLeft,
  faSun,
  faMoon,
);

initTheme();

const app = createApp(App);
app.component('FontAwesomeIcon', FontAwesomeIcon);
app.use(createPinia());
app.mount('#app');
