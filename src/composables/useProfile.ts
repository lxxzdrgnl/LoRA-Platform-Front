import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, type UserResponse } from '../services/api';
import { useAuthStore } from '../stores/auth';

export function useProfile() {
  const router = useRouter();
  const authStore = useAuthStore();
  const user = ref<UserResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadUserProfile = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.user.getMyProfile();
      user.value = response.data;
      authStore.setUser(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to load user profile:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load profile';
      // Token might be expired
      authStore.clearTokens();
      router.push('/login');
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateProfile = async (data: { nickname: string; profileImageUrl?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.user.updateMyProfile(data);
      user.value = response.data;
      authStore.setUser(response.data);

      // Dispatch custom event to update Navigation
      window.dispatchEvent(new CustomEvent('profile-updated', {
        detail: response.data
      }));

      return response.data;
    } catch (err) {
      console.error('Failed to update profile:', err);
      error.value = err instanceof Error ? err.message : 'Failed to update profile';
      alert('Failed to update profile. Please try again.');
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    user,
    loading,
    error,
    loadUserProfile,
    updateProfile,
  };
}
