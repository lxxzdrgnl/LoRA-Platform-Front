<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '../../services/api';
import type { TrainingJobResponse, LoraModel } from '../../services/api';

const props = defineProps<{
  show: boolean;
  jobId: number | null;
}>();

const emit = defineEmits(['close', 'deleted']);

const loading = ref(true);
const error = ref('');
const job = ref<TrainingJobResponse | null>(null);
const model = ref<LoraModel | null>(null);

watch(() => props.jobId, async (newId) => {
  if (newId) {
    await fetchJobDetails(newId);
  }
});

const fetchJobDetails = async (id: number) => {
  try {
    loading.value = true;
    error.value = '';

    // Fetch training job details
    const jobResponse = await api.training.getTrainingJob(id);
    job.value = jobResponse.data;

    // Fetch model details
    if (job.value?.modelId) {
      const modelResponse = await api.models.getModelDetail(job.value.modelId);
      model.value = modelResponse.data;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load training job details.';
  } finally {
    loading.value = false;
  }
};

const deleteJob = async () => {
  if (!props.jobId || !confirm('Are you sure you want to delete this training job? This action cannot be undone.')) return;
  try {
    await api.training.deleteTrainingJob(props.jobId);
    emit('deleted', props.jobId);
    closeModal();
  } catch (err) {
    console.error('Failed to delete training job:', err);
    alert('Failed to delete training job. Please try again.');
  }
};

const closeModal = () => {
  emit('close');
  job.value = null;
  model.value = null;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'badge-success';
    case 'TRAINING':
    case 'IN_PROGRESS':
      return 'badge-primary';
    case 'FAILED':
      return 'badge-error';
    default:
      return 'badge-secondary';
  }
};
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h1 class="text-3xl font-bold gradient-text">Training Job Details</h1>
        <button class="modal-close" @click="closeModal">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body-content hide-scrollbar">
        <div v-if="loading" class="flex justify-center p-xl">
          <div class="loading"></div>
        </div>
        <div v-else-if="error" class="card text-center p-xl text-error bg-red-500/10">
          {{ error }}
        </div>
        <div v-else-if="job && model" class="grid grid-cols-2 gap-xl">
          <!-- Left: Model Info -->
          <div class="card">
            <h2 class="text-2xl font-bold mb-lg gradient-text">Model Information</h2>
            <div class="model-preview mb-lg">
              <img
                v-if="model.thumbnailUrl"
                :src="model.thumbnailUrl"
                :alt="model.title"
                class="model-thumbnail"
              />
              <div v-else class="model-thumbnail-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
            </div>
            <div class="form-group">
              <label class="label">Model Name</label>
              <p class="font-medium text-primary">{{ model.title }}</p>
            </div>
            <div class="form-group" v-if="model.description">
              <label class="label">Description</label>
              <p class="text-secondary text-sm">{{ model.description }}</p>
            </div>
            <div class="form-group">
              <label class="label">Base Model</label>
              <p class="font-medium text-primary">{{ model.baseModel }}</p>
            </div>
            <div class="grid grid-cols-2 gap-md">
              <div class="form-group">
                <label class="label">Training Images</label>
                <p class="font-medium text-primary">{{ model.trainingImagesCount }}</p>
              </div>
              <div class="form-group">
                <label class="label">Status</label>
                <p class="font-medium text-primary">{{ model.status }}</p>
              </div>
            </div>
            <div class="mt-auto pt-lg">
              <router-link
                v-if="model.status === 'ACTIVE'"
                :to="`/models/${model.id}`"
                class="btn btn-primary w-full"
              >
                View Model
              </router-link>
            </div>
          </div>

          <!-- Right: Training Details -->
          <div class="card">
            <h2 class="text-2xl font-bold mb-lg gradient-text">Training Details</h2>
            <div class="form-group">
              <label class="label">Job ID</label>
              <p class="font-medium text-primary">#{{ job.id }}</p>
            </div>
            <div class="form-group">
              <label class="label">Status</label>
              <p class="badge" :class="getStatusClass(job.status)">{{ job.status }}</p>
            </div>

            <!-- Progress -->
            <div class="form-group">
              <label class="label">Progress</label>
              <div class="progress-info mb-sm">
                <span class="font-medium text-primary">{{ job.currentEpoch }} / {{ job.totalEpochs }} epochs</span>
                <span class="text-secondary text-sm">{{ Math.round((job.currentEpoch / job.totalEpochs) * 100) }}%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${(job.currentEpoch / job.totalEpochs) * 100}%` }"
                ></div>
              </div>
            </div>

            <!-- Phase -->
            <div class="form-group" v-if="job.phase">
              <label class="label">Current Phase</label>
              <p class="font-medium text-primary">{{ job.phase }}</p>
            </div>

            <!-- Timestamps -->
            <div class="grid grid-cols-2 gap-md">
              <div class="form-group">
                <label class="label">Created</label>
                <p class="text-sm text-secondary">{{ formatDate(job.createdAt) }}</p>
              </div>
              <div class="form-group" v-if="job.startedAt">
                <label class="label">Started</label>
                <p class="text-sm text-secondary">{{ formatDate(job.startedAt) }}</p>
              </div>
            </div>
            <div class="form-group" v-if="job.completedAt">
              <label class="label">Completed</label>
              <p class="text-sm text-secondary">{{ formatDate(job.completedAt) }}</p>
            </div>

            <!-- Error Message -->
            <div
              v-if="job.status === 'FAILED' && job.errorMessage"
              class="error-box"
            >
              <label class="label text-error">Error Message</label>
              <p class="text-sm">{{ job.errorMessage }}</p>
            </div>

            <!-- Actions -->
            <div class="mt-auto pt-lg">
              <button
                v-if="job.status === 'FAILED' || job.status === 'COMPLETED'"
                class="btn w-full text-error"
                @click="deleteJob"
                style="background: var(--error-light, rgba(239, 68, 68, 0.1));"
              >
                Delete Training Job
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-lg);
}

.modal-content {
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-close {
  padding: var(--space-sm);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body-content {
  padding: var(--space-xl);
  overflow-y: auto;
}

.model-preview {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-hover);
}

.model-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.model-thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-dark));
  transition: width 0.3s ease;
}

.error-box {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid var(--error);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

@media (max-width: 1024px) {
  .grid-cols-2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: var(--space-sm);
  }

  .modal-body-content {
    padding: var(--space-md);
  }
}
</style>
