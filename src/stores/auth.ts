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

    // Attempt to clear any session cookies
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const rawCookie = cookies[i];
      if (!rawCookie) continue; // Skip if rawCookie is empty or undefined

      const cookie = rawCookie.trim();
      if (!cookie) continue; // Skip if cookie is empty after trimming

      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      
      if (!name) continue; // Skip if name is empty

      document.cookie = name.trim() + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    }
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
      const frontendUrl = import.meta.env.VITE_FRONTEND_URL;
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
