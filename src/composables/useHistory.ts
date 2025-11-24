import { ref } from 'vue';
import { api, type GenerationHistoryResponse, type TrainingJobResponse } from '../services/api';

export function useHistory() {
  const generationHistory = ref<GenerationHistoryResponse[]>([]);
  const trainingHistory = ref<TrainingJobResponse[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadGenerationHistory = async (page = 0, size = 20) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.generate.getHistoryList(page, size);
      // Manually add thumbnailUrl for the template (backward compatibility)
      generationHistory.value = response.data.content.map(item => ({
        ...item,
        thumbnailUrl: item.generatedImages?.[0]?.s3Url
      }));
      return response.data;
    } catch (err) {
      console.error('Failed to load generation history:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load generation history';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const loadTrainingHistory = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.training.getMyTrainingJobs();
      trainingHistory.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Failed to load training history:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load training history';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteGenerationHistory = (historyId: number) => {
    generationHistory.value = generationHistory.value.filter(h => h.id !== historyId);
  };

  const downloadImage = async (imageUrl: string, historyId: number) => {
    if (!imageUrl) {
      alert('No image available for download.');
      return;
    }

    try {
      const freshUrl = `${imageUrl}?time=${new Date().getTime()}`;
      const response = await fetch(freshUrl, {
        method: 'GET',
        mode: 'cors',
      });
      if (!response.ok) throw new Error('Network response was not ok.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `blueming_ai_history_${historyId}.png`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Download failed: ${err}. This might be a CORS issue. Opening image in a new tab as a fallback.`);
      window.open(imageUrl, '_blank');
    }
  };

  return {
    generationHistory,
    trainingHistory,
    loading,
    error,
    loadGenerationHistory,
    loadTrainingHistory,
    deleteGenerationHistory,
    downloadImage,
  };
}
