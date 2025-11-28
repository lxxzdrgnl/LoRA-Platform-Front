<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '../../services/api';
import type { TrainingJobWithModelResponse } from '../../services/api';
import TrainingHistoryDetailModal from './TrainingHistoryDetailModal.vue';

defineProps<{
  trainingHistory: TrainingJobWithModelResponse[];
}>();

const emit = defineEmits(['delete-job']);

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
  emit('delete-job', jobId);
};

const deleteTrainingJob = async (id: number, event: Event) => {
  event.stopPropagation(); // Prevent opening modal when clicking delete
  try {
    await api.training.deleteTrainingJob(id);
    emit('delete-job', id);
  } catch (err) {
    console.error('Failed to delete training:', err);
  }
};

const getBadgeStatusClass = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'badge-success';
    case 'IN_PROGRESS':
    case 'TRAINING':
      return 'badge-primary';
    case 'FAILED':
      return 'badge-error';
    default:
      return 'badge-secondary';
  }
};

const getIconStatusClass = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'badge-success';
    case 'IN_PROGRESS':
    case 'TRAINING':
      return 'badge-primary';
    case 'FAILED':
      return 'badge-error';
    default:
      return 'badge-secondary';
  }
};
</script>

<template>
  <div class="history-section mt-xl">
    <div class="card">
      <h2 class="text-2xl font-bold mb-lg gradient-text">Training History</h2>
      <div v-if="trainingHistory.length === 0" class="empty-state text-center py-xl">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto mb-md" style="color: var(--text-muted);">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p class="text-secondary">No training history yet</p>
        <p class="text-sm text-muted mt-sm">Start your first training to see it here</p>
      </div>
      <div v-else class="history-list">
        <div
          v-for="training in trainingHistory"
          :key="training.id"
          class="history-item"
          @click="openModal(training)"
        >
          <div class="status-icon" :class="getIconStatusClass(training.status)">
            <svg v-if="training.status === 'COMPLETED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <svg v-else-if="training.status === 'IN_PROGRESS' || training.status === 'TRAINING'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">{{ training.modelTitle || `Training Job #${training.id}` }}</h3>
              <span class="badge" :class="getBadgeStatusClass(training.status)">{{ training.status }}</span>
            </div>
            <p class="text-sm text-secondary mb-sm">{{ training.baseModel || 'Base Model' }}</p>
            <div class="grid grid-cols-2 gap-x-md gap-y-sm text-sm">
              <div><span class="text-muted">Progress:</span> <span class="ml-xs">{{ training.currentEpoch }} / {{ training.totalEpochs }}</span></div>
              <div><span class="text-muted">Phase:</span> <span class="ml-xs">{{ training.phase || 'N/A' }}</span></div>
              <div v-if="training.startedAt"><span class="text-muted">Started:</span> <span class="ml-xs">{{ new Date(training.startedAt).toLocaleString() }}</span></div>
              <div v-if="training.completedAt"><span class="text-muted">Completed:</span> <span class="ml-xs">{{ new Date(training.completedAt).toLocaleString() }}</span></div>
            </div>
            <div v-if="training.errorMessage" class="text-sm text-error mt-sm">Error: {{ training.errorMessage }}</div>
          </div>
          <div class="flex flex-col gap-sm ml-md" @click.stop>
            <router-link v-if="training.status === 'COMPLETED'" :to="`/models/${training.modelId}`" class="btn btn-secondary btn-sm">View Model</router-link>
            <button v-if="training.status === 'FAILED' || training.status === 'COMPLETED'" class="btn btn-ghost btn-sm" @click="deleteTrainingJob(training.id, $event)">Delete</button>
          </div>
        </div>
      </div>
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
.card {
  background-color: var(--bg-dark);
  border: none;
  box-shadow: none;
}

.history-section {
  height: fit-content;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  padding: var(--space-md);
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  transition: background-color 0.2s, border-color 0.2s, transform 0.2s;
  cursor: pointer;
}
.history-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--primary);
    transform: translateY(-2px);
}

.status-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.status-icon.badge-success {
    background-color: rgba(34, 197, 94, 0.15);
    color: #22c55e;
}

.status-icon.badge-primary {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
}

.status-icon.badge-error {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
}

.badge-success {
    background-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    font-weight: 600;
}

.badge-error {
    background-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    font-weight: 600;
}

.badge-primary {
    background-color: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    font-weight: 600;
}
</style>