<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue';
import { api, getWebSocketUrl } from '../../services/api';
import type { TrainingJobResponse, TrainingJobWithModelResponse } from '../../services/api';

const props = defineProps<{
  show: boolean;
  job: TrainingJobWithModelResponse | null;
}>();

const emit = defineEmits(['close', 'deleted']);

const loading = ref(false);
const error = ref('');
const jobData = ref<TrainingJobResponse | null>(null);
const currentUserId = ref<number | null>(null);

let websocket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Computed properties for model information (from TrainingJobResponse)
const modelTitle = computed(() => props.job?.modelTitle || props.job?.modelName || 'N/A');
const baseModel = computed(() => props.job?.baseModel || 'N/A');
const modelThumbnail = computed(() => props.job?.modelThumbnail || props.job?.modelThumbnailUrl);
const trainingImagesCount = computed(() => props.job?.trainingImagesCount || 0);

// Merge job data with real-time updates
const currentJob = computed(() => {
  if (!props.job) return null;
  // Use real-time data if available, otherwise use props
  return jobData.value ? {
    ...props.job,
    ...jobData.value
  } : props.job;
});

watch(() => props.job, async (newJob) => {
  if (newJob) {
    // Initialize with passed job data
    jobData.value = newJob;

    // Get user ID for WebSocket
    if (!currentUserId.value) {
      try {
        const userResponse = await api.user.getMyProfile();
        currentUserId.value = userResponse.data.id;
      } catch (err) {
        console.error('Failed to get user profile:', err);
      }
    }

    // Connect to WebSocket if job is in progress
    if (newJob.status === 'IN_PROGRESS' || newJob.status === 'TRAINING') {
      connectWebSocket();
    }
  }
});

watch(() => props.show, (isShown) => {
  if (!isShown) {
    disconnectWebSocket();
  }
});


const connectWebSocket = () => {
  if (websocket) websocket.close();
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  const userId = currentUserId.value || 0;
  const wsUrl = getWebSocketUrl(`/ws/training?userId=${userId}`);

  console.log(`Detail Modal: Connecting WebSocket to: ${wsUrl}, with userId: ${userId}`);

  try {
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Detail Modal: WebSocket connected successfully');
      heartbeatTimer = setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Detail Modal: WebSocket message received:', data);

      if (data.type === 'pong') return;

      // Only update if this is the job we're watching
      if (props.job && data.jobId && data.jobId !== props.job.id) {
        console.log(`Detail Modal: Ignoring message for different job: ${data.jobId} (current: ${props.job.id})`);
        return;
      }

      // Update job details based on WebSocket message
      if (jobData.value) {
        if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
          jobData.value.status = 'COMPLETED';
          jobData.value.completedAt = new Date().toISOString();
          disconnectWebSocket();
        } else if (data.status === 'FAILED' || data.status === 'FAIL') {
          jobData.value.status = 'FAILED';
          jobData.value.errorMessage = data.message || data.error || 'Training failed';
          disconnectWebSocket();
        } else if (data.status === 'TRAINING') {
          jobData.value.status = 'TRAINING';
          if (data.currentEpoch !== null && data.currentEpoch !== undefined) {
            jobData.value.currentEpoch = data.currentEpoch;
          }
          if (data.phase) {
            jobData.value.phase = data.phase;
          }
        } else {
          // Update phase for other statuses
          if (data.status) {
            jobData.value.phase = data.status;
          }
        }
      }
    };

    websocket.onerror = (event) => {
      console.error('Detail Modal: WebSocket error:', event);
    };

    websocket.onclose = (event) => {
      console.log('Detail Modal: WebSocket closed:', event.code, event.reason);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  } catch (err) {
    console.error('Detail Modal: Failed to create WebSocket:', err);
  }
};

const disconnectWebSocket = () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (websocket) {
    websocket.close();
    websocket = null;
  }
};

const deleteJob = async () => {
  if (!props.job || !confirm('Are you sure you want to delete this training job? This action cannot be undone.')) return;
  try {
    await api.training.deleteTrainingJob(props.job.id);
    emit('deleted', props.job.id);
    closeModal();
  } catch (err) {
    console.error('Failed to delete training job:', err);
    alert('Failed to delete training job. Please try again.');
  }
};

const closeModal = () => {
  disconnectWebSocket();
  emit('close');
  jobData.value = null;
};

onUnmounted(() => {
  disconnectWebSocket();
});

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
        <div v-else-if="currentJob" class="grid grid-cols-2 gap-xl">
          <!-- Left: Model Info -->
          <div class="card">
            <h2 class="text-2xl font-bold mb-lg gradient-text">Model Information</h2>
            <div class="model-preview mb-lg">
              <img
                v-if="modelThumbnail"
                :src="modelThumbnail"
                :alt="modelTitle"
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
              <p class="font-medium text-primary">{{ modelTitle }}</p>
            </div>
            <div class="form-group">
              <label class="label">Base Model</label>
              <p class="font-medium text-primary">{{ baseModel }}</p>
            </div>
            <div class="grid grid-cols-2 gap-md">
              <div class="form-group">
                <label class="label">Training Images</label>
                <p class="font-medium text-primary">{{ trainingImagesCount }}</p>
              </div>
              <div class="form-group">
                <label class="label">Status</label>
                <p class="badge" :class="getStatusClass(currentJob.status)">{{ currentJob.status }}</p>
              </div>
            </div>
            <div v-if="currentJob.status === 'COMPLETED' && currentJob.modelId" class="mt-auto pt-lg">
              <router-link
                :to="`/models/${currentJob.modelId}`"
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
              <label class="label">Status</label>
              <p class="badge" :class="getStatusClass(currentJob.status)">{{ currentJob.status }}</p>
            </div>

            <!-- Progress -->
            <div class="form-group">
              <label class="label">Progress</label>
              <div class="progress-info mb-sm">
                <span class="font-medium text-primary">{{ currentJob.currentEpoch }} / {{ currentJob.totalEpochs }} epochs</span>
                <span class="text-secondary text-sm">{{ Math.round(currentJob.progressPercentage || 0) }}%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${currentJob.progressPercentage || 0}%` }"
                ></div>
              </div>
            </div>

            <!-- Phase -->
            <div class="form-group" v-if="currentJob.phase">
              <label class="label">Current Phase</label>
              <p class="font-medium text-primary">{{ currentJob.phase }}</p>
            </div>

            <!-- Timestamps -->
            <div class="grid grid-cols-2 gap-md">
              <div class="form-group">
                <label class="label">Created</label>
                <p class="text-sm text-secondary">{{ formatDate(currentJob.createdAt) }}</p>
              </div>
              <div class="form-group" v-if="currentJob.startedAt">
                <label class="label">Started</label>
                <p class="text-sm text-secondary">{{ formatDate(currentJob.startedAt) }}</p>
              </div>
            </div>
            <div class="form-group" v-if="currentJob.completedAt">
              <label class="label">Completed</label>
              <p class="text-sm text-secondary">{{ formatDate(currentJob.completedAt) }}</p>
            </div>

            <!-- Error Message -->
            <div
              v-if="currentJob.status === 'FAILED' && currentJob.errorMessage"
              class="error-box"
            >
              <label class="label text-error">Error Message</label>
              <p class="text-sm">{{ currentJob.errorMessage }}</p>
            </div>

            <!-- Actions -->
            <div class="mt-auto pt-lg flex flex-col gap-md">
              <button
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
