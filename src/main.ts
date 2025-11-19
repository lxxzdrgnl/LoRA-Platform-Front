import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import favicon from './assets/favicon_v2.svg'

const setFavicon = () => {
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/svg+xml';
  link.rel = 'icon';
  link.href = favicon;
  document.getElementsByTagName('head')[0].appendChild(link);
};

setFavicon();

const app = createApp(App)

app.use(router)
app.mount('#app')
