<script setup lang="ts">
import { ref } from 'vue';
import GenerationHistoryList from './GenerationHistoryList.vue';
import TrainingHistoryList from './TrainingHistoryList.vue';
import type { GenerationHistoryResponse, TrainingJobWithModelResponse, AvailableModelResponse } from '../../services/api';

interface Props {
  generationHistory: GenerationHistoryResponse[];
  trainingHistory: TrainingJobWithModelResponse[];
  availableModels: AvailableModelResponse[];
  loading?: boolean;
  hasMore?: boolean;
}

interface Emits {
  (e: 'openGenerationDetail', historyId: number): void;
  (e: 'downloadImage', event: Event, imageUrl: string, historyId: number): void;
  (e: 'loadMore', modelId: number | null): void;
  (e: 'filterChange', modelId: number | null): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const historySubTab = ref<'generate' | 'training'>('generate');
const currentFilterModelId = ref<number | null>(null);

const openHistoryDetailModal = (historyId: number) => {
  emit('openGenerationDetail', historyId);
};

const downloadImage = (event: Event, imageUrl: string, historyId: number) => {
  emit('downloadImage', event, imageUrl, historyId);
};

const loadMore = () => {
  emit('loadMore', currentFilterModelId.value);
};

const handleFilterChange = (modelId: number | null) => {
  currentFilterModelId.value = modelId;
  emit('filterChange', modelId);
};
</script>

<template>
  <div>
    <!-- History Sub-tabs -->
    <div class="history-subtabs mb-lg">
      <button
        class="subtab-btn"
        :class="{ active: historySubTab === 'generate' }"
        @click="historySubTab = 'generate'"
      >
        Generation History
      </button>
      <button
        class="subtab-btn"
        :class="{ active: historySubTab === 'training' }"
        @click="historySubTab = 'training'"
      >
        Training History
      </button>
    </div>

    <!-- Generation History -->
    <GenerationHistoryList
      v-if="historySubTab === 'generate'"
      :history="generationHistory"
      :available-models="availableModels"
      :loading="loading"
      :has-more="hasMore"
      @open-detail="openHistoryDetailModal"
      @download="downloadImage"
      @load-more="loadMore"
      @filter-change="handleFilterChange"
    />

    <!-- Training History -->
    <TrainingHistoryList
      v-if="historySubTab === 'training'"
      :history="trainingHistory"
      :loading="loading"
    />
  </div>
</template>

<style scoped>
.history-subtabs {
  display: flex;
  gap: var(--space-sm);
  border-bottom: 2px solid var(--border);
  margin-bottom: var(--space-lg);
}

.subtab-btn {
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.3s ease;
}

.subtab-btn:hover {
  color: var(--text-primary);
}

.subtab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
</style>
