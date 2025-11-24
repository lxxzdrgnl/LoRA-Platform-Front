import { ref } from 'vue';
import { api, type LoraModel } from '../services/api';

export function useModels() {
  const myModels = ref<LoraModel[]>([]);
  const likedModels = ref<LoraModel[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadMyModels = async (page = 0, size = 20) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.models.getMyModels(page, size);
      myModels.value = response.data.content;
      return response.data;
    } catch (err) {
      console.error('Failed to load my models:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load models';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const loadLikedModels = async (page = 0, size = 20) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.community.getLikedModels(page, size);
      likedModels.value = response.data.content;
      return response.data;
    } catch (err) {
      console.error('Failed to load liked models:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load liked models';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const refreshAllModels = async () => {
    await Promise.all([
      loadMyModels(),
      loadLikedModels(),
    ]);
  };

  return {
    myModels,
    likedModels,
    loading,
    error,
    loadMyModels,
    loadLikedModels,
    refreshAllModels,
  };
}
