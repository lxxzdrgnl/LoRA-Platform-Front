<script setup lang="ts">
import { ref } from 'vue';
import type { TrainingJobWithModelResponse } from '../../services/api';
import TrainingHistoryDetailModal from '../training/TrainingHistoryDetailModal.vue';

interface Props {
  history: TrainingJobWithModelResponse[];
  loading?: boolean;
}

interface Emits {
  (e: 'deleted', jobId: number): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const showModal = ref(false);
const selectedJob = ref<TrainingJobWithModelResponse | null>(null);

const openModal = (job: TrainingJobWithModelResponse) => {
  selectedJob.value = job;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  selectedJob.value = null;
};

const handleDeleted = (jobId: number) => {
  closeModal();
  // Emit event to parent to refresh the list
  emit('deleted', jobId);
};
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center p-xl">
      <div class="loading"></div>
    </div>

    <!-- History List -->
    <div v-else-if="history.length" class="grid grid-cols-1 gap-md">
      <div
        v-for="job in history"
        :key="job.id"
        class="card p-lg history-card"
        @click="openModal(job)"
      >
        <div class="flex items-center justify-between mb-md">
          <div>
            <h3 class="text-lg font-bold">{{ job.modelTitle || `Training Job #${job.id}` }}</h3>
            <p class="text-sm text-muted">{{ new Date(job.createdAt).toLocaleString() }}</p>
          </div>
          <span
            class="badge text-xs font-semibold"
            :class="{
              'badge-success': job.status === 'COMPLETED',
              'badge-primary': job.status === 'TRAINING' || job.status === 'IN_PROGRESS',
              'badge-error': job.status === 'FAILED',
              'badge-secondary': job.status === 'PENDING'
            }"
          >
            {{ job.status }}
          </span>
        </div>

        <!-- Progress Bar -->
        <div v-if="job.status === 'TRAINING' || job.status === 'IN_PROGRESS'" class="mb-md">
          <div class="w-full rounded-full overflow-hidden" style="height: 8px; background: var(--bg-hover);">
            <div
              class="h-full transition-all duration-300"
              style="background: linear-gradient(90deg, var(--primary), var(--primary-dark));"
              :style="{ width: `${(job.currentEpoch / job.totalEpochs) * 100}%` }"
            ></div>
          </div>
          <p class="text-sm text-center mt-xs text-secondary">
            Epoch {{ job.currentEpoch }} / {{ job.totalEpochs }}
            <span v-if="job.phase" class="text-muted"> - {{ job.phase }}</span>
          </p>
        </div>

        <!-- Completed Info -->
        <div v-if="job.status === 'COMPLETED' && job.completedAt" class="text-sm text-secondary">
          완료: {{ new Date(job.completedAt).toLocaleString() }}
        </div>

        <!-- Error Message -->
        <div
          v-if="job.status === 'FAILED' && job.errorMessage"
          class="p-sm rounded text-sm text-error"
          style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--error);"
        >
          {{ job.errorMessage }}
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="card text-center p-xl">
      <p class="text-secondary text-lg">학습 기록이 없습니다</p>
    </div>

    <!-- Detail Modal -->
    <TrainingHistoryDetailModal
      :show="showModal"
      :job="selectedJob"
      @close="closeModal"
      @deleted="handleDeleted"
    />
  </div>
</template>

<style scoped>
.history-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-card:hover {
  background-color: var(--bg-hover);
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
