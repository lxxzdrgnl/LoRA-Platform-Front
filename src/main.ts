import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import favicon from './assets/favicon_v2.svg'

const setFavicon = () => {
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (link) {
    link.href = favicon;
  } else {
    link = document.createElement('link');
    link.rel = 'icon';
    link.href = favicon;
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }
};

setFavicon();

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
