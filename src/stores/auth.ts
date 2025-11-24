import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserResponse } from '../services/api';

export const useAuthStore = defineStore('auth', () => {
  // State
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<UserResponse | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value);

  // Actions
  function setTokens(access: string, refresh: string) {
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  function setUser(userData: UserResponse) {
    user.value = userData;
  }

  function getAccessToken(): string | null {
    return accessToken.value;
  }

  function getRefreshToken(): string | null {
    return refreshToken.value;
  }

  function requireAuth(): boolean {
    if (!isAuthenticated.value) {
      alert('Login to continue');
      const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://blueming-front.s3-website.ap-northeast-2.amazonaws.com';
      window.location.href = `${frontendUrl}/login`;
      return false;
    }
    return true;
  }

  return {
    // State
    accessToken,
    refreshToken,
    user,

    // Getters
    isAuthenticated,

    // Actions
    setTokens,
    clearTokens,
    setUser,
    getAccessToken,
    getRefreshToken,
    requireAuth,
  };
});
