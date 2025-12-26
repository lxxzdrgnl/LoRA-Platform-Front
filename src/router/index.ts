import { createRouter, createWebHistory } from 'vue-router';
import ModelList from '../views/ModelList.vue';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import AuthCallback from '../views/AuthCallback.vue';
import Profile from '../views/Profile.vue';
import Search from '../views/Search.vue';
import Training from '../views/Training.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../services/api';

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
      path: '/register',
      name: 'register',
      component: Register,
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
      component: { template: '<div>Logging in with test account...</div>' },
      beforeEnter: async (to, from, next) => {
        try {
          console.log('🔧 Test login: Calling POST /api/auth/test');
          const response = await api.auth.testLogin();
          const { accessToken, refreshToken, userId, email, nickname, profileImageUrl } = response.data;

          console.log('✅ Test login successful:', { userId, email, nickname });

          const authStore = useAuthStore();
          authStore.setTokens(accessToken, refreshToken);
          authStore.setUser({
            id: userId,
            email,
            nickname,
            profileImageUrl,
            name: nickname,
            role: 'USER',
            createdAt: new Date().toISOString()
          });

          // Redirect to home
          next({ name: 'home' });
        } catch (error: any) {
          console.error('❌ Test login failed:', error);
          alert('Test login failed: ' + (error.message || 'Unknown error'));
          next({ name: 'login' });
        }
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

  if ((to.name === 'login' || to.name === 'register') && isAuthenticated) {
    // If authenticated user tries to access /login or /register, redirect to home
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
