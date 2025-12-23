import { createRouter, createWebHistory } from 'vue-router';
import ModelList from '../views/ModelList.vue';
import Login from '../views/Login.vue';
import AuthCallback from '../views/AuthCallback.vue';
import Profile from '../views/Profile.vue';
import Search from '../views/Search.vue';
import Training from '../views/Training.vue';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: ModelList,
    },
    {
      path: '/models',
      name: 'models',
      component: ModelList,
    },
    {
      path: '/search',
      name: 'search',
      component: Search,
    },
    {
      path: '/training',
      name: 'training',
      component: Training,
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallback,
    },
    {
      path: '/profile',
      name: 'profile',
      component: Profile,
    },
    {
      path: '/my-models',
      name: 'my-models',
      component: Profile,
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: Profile,
    },
    {
      path: '/generate-history',
      name: 'generate-history',
      component: Profile,
    },
    {
      path: '/test',
      name: 'test-login',
      component: { template: '<div>Redirecting...</div>' },
      beforeEnter: () => {
        // CloudFront를 통해 백엔드 API로 리다이렉트 (상대 경로)
        const redirectUrl = '/api/auth/test';
        console.log('🔧 Redirecting to:', redirectUrl);
        window.location.href = redirectUrl;
        return false;
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = authStore.isAuthenticated;

  if (to.name === 'login' && isAuthenticated) {
    // If authenticated user tries to access /login, redirect to home
    next({ name: 'home' });
  } else if (requiresAuth && !isAuthenticated) {
    // If route requires auth and user is not authenticated, redirect to login
    alert('Login to continue');
    next({ name: 'login' });
  } else {
    next();
  }
});

export default router;
