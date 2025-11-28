import { ref } from 'vue';
import { api, type GenerationHistoryResponse, type TrainingJobResponse, type TrainingJobWithModelResponse, type AvailableModelResponse } from '../services/api';

export function useHistory() {
  const generationHistory = ref<GenerationHistoryResponse[]>([]);
  const trainingHistory = ref<TrainingJobWithModelResponse[]>([]);
  const availableModels = ref<AvailableModelResponse[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentPage = ref(0);
  const hasMore = ref(false);
  const totalPages = ref(0);

  const loadGenerationHistory = async (page = 0, size = 20, append = false, modelId?: number) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.generate.getHistoryList(page, size, modelId);
      console.log('📊 Full API Response:', response.data);
      console.log('📊 Pagination Info:', {
        currentPage: response.data.number,
        totalPages: response.data.totalPages,
        totalElements: response.data.totalElements,
        size: response.data.size,
        contentLength: response.data.content.length
      });

      // Manually add thumbnailUrl for the template (backward compatibility)
      const newItems = response.data.content.map(item => ({
        ...item,
        thumbnailUrl: item.generatedImages?.[0]?.s3Url
      }));

      if (append) {
        generationHistory.value = [...generationHistory.value, ...newItems];
      } else {
        generationHistory.value = newItems;
      }

      // Handle different possible field names for current page
      const pageNumber = response.data.number ?? page;

      currentPage.value = pageNumber;
      totalPages.value = response.data.totalPages;
      hasMore.value = pageNumber < response.data.totalPages - 1;

      console.log('✅ Updated state:', {
        currentPage: currentPage.value,
        totalPages: totalPages.value,
        hasMore: hasMore.value,
        totalItems: generationHistory.value.length
      });

      return response.data;
    } catch (err) {
      console.error('Failed to load generation history:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load generation history';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const loadMoreHistory = async (size = 20, modelId?: number) => {
    if (hasMore.value && !loading.value) {
      await loadGenerationHistory(currentPage.value + 1, size, true, modelId);
    }
  };

  const loadAvailableModels = async () => {
    try {
      const response = await api.generate.getAvailableModels();
      availableModels.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Failed to load available models:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load available models';
      throw err;
    }
  };

  const loadTrainingHistory = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.training.getMyTrainingJobs();
      const jobs: TrainingJobResponse[] = response.data;

      // TrainingJobResponse now includes modelName, baseModel, modelThumbnailUrl
      const jobsWithAlias: TrainingJobWithModelResponse[] = jobs.map(job => ({
        ...job,
        modelTitle: job.modelName, // Alias for backward compatibility
        modelThumbnail: job.modelThumbnailUrl, // Alias for backward compatibility
      }));

      trainingHistory.value = jobsWithAlias;
      return jobsWithAlias;
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
    availableModels,
    loading,
    error,
    currentPage,
    hasMore,
    totalPages,
    loadGenerationHistory,
    loadMoreHistory,
    loadAvailableModels,
    loadTrainingHistory,
    deleteGenerationHistory,
    downloadImage,
  };
}
