import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { initTheme } from './lib/theme';
import './style.css';

import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faPlus,
  faCopy,
  faXmark,
  faCheck,
  faShareNodes,
  faChevronDown,
  faChevronRight,
  faArrowRight,
  faArrowUpRightFromSquare,
  faRotateLeft,
  faSun,
  faMoon,
  faCode,
  faEnvelope,
  faExpand,
  faCompress,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(
  faPlus,
  faCopy,
  faXmark,
  faCheck,
  faShareNodes,
  faChevronDown,
  faChevronRight,
  faArrowRight,
  faArrowUpRightFromSquare,
  faRotateLeft,
  faSun,
  faMoon,
  faCode,
  faEnvelope,
  faExpand,
  faCompress,
);

initTheme();

const app = createApp(App);
app.component('FontAwesomeIcon', FontAwesomeIcon);
app.use(createPinia());
app.mount('#app');
