<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue';
import { api } from '../../services/api';
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

let eventSource: EventSource | null = null;

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

    // 🔥 NEW: 진행 중인 작업이면 Redis 캐시에서 진행률 복원
    if (newJob.status === 'IN_PROGRESS' || newJob.status === 'TRAINING') {
      try {
        const progressResponse = await api.training.getTrainingProgress(newJob.id);
        if (progressResponse.data) {
          const cachedProgress = progressResponse.data;
          console.log('✅ 진행률 복원:', cachedProgress);

          // Redis 캐시에서 복원된 진행률로 업데이트 (Race Condition 방지)
          if (jobData.value) {
            if (cachedProgress.currentEpoch !== null && cachedProgress.currentEpoch !== undefined) {
              jobData.value.currentEpoch = cachedProgress.currentEpoch;
            }
            if (cachedProgress.totalEpochs) {
              jobData.value.totalEpochs = cachedProgress.totalEpochs;
            }
            if (cachedProgress.status) {
              jobData.value.status = cachedProgress.status;
            }
            if (cachedProgress.phase) {
              jobData.value.phase = cachedProgress.phase;
            }
          }
        }
      } catch (err) {
        console.log('⚠️ 캐시된 진행률 없음 (정상 - 아직 시작 안 됨)');
      }

      // SSE 연결
      connectSSE();
    }
  }
});

watch(() => props.show, (isShown) => {
  if (!isShown) {
    disconnectSSE();
  }
});


const connectSSE = () => {
  if (eventSource) eventSource.close();

  // SSE 연결 (JWT 토큰 URL 파라미터로 전달)
  const token = localStorage.getItem('accessToken');
  if (!token) {
    console.error('Detail Modal: No access token found');
    return;
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const sseUrl = `${baseUrl}/api/training/stream?token=${token}`;

  console.log(`Detail Modal: Connecting SSE to: ${sseUrl}`);

  try {
    eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      console.log('Detail Modal: SSE connected successfully');
    };

    // 연결 성공 이벤트
    eventSource.addEventListener('connected', (event) => {
      console.log('Detail Modal: SSE connection confirmed:', event.data);
    });

    // 학습 진행률 이벤트
    eventSource.addEventListener('training_progress', (event) => {
      const data = JSON.parse(event.data);
      console.log('Detail Modal: SSE training_progress received:', data);

      // Only update if this is the job we're watching
      if (props.job && data.jobId && data.jobId !== props.job.id) {
        console.log(`Detail Modal: Ignoring message for different job: ${data.jobId} (current: ${props.job.id})`);
        return;
      }

      // Update job details based on SSE message
      if (jobData.value) {
        if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
          jobData.value.status = 'COMPLETED';
          jobData.value.completedAt = new Date().toISOString();
          disconnectSSE();
        } else if (data.status === 'FAILED' || data.status === 'FAIL') {
          jobData.value.status = 'FAILED';
          jobData.value.errorMessage = data.message || data.error || 'Training failed';
          disconnectSSE();
        } else if (data.status === 'TRAINING') {
          jobData.value.status = 'TRAINING';
          // 🔥 Race Condition 방지: 더 큰 epoch만 갱신
          if (data.currentEpoch !== null && data.currentEpoch !== undefined) {
            if (!jobData.value.currentEpoch || data.currentEpoch >= jobData.value.currentEpoch) {
              jobData.value.currentEpoch = data.currentEpoch;
            } else {
              console.log(`⚠️ Race Condition 방지: SSE epoch(${data.currentEpoch}) < 현재(${jobData.value.currentEpoch})`);
            }
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
    });

    eventSource.onerror = (event) => {
      console.error('Detail Modal: SSE error:', event);
      // SSE는 자동 재연결을 시도하므로 여기서는 로그만 출력
    };

  } catch (err) {
    console.error('Detail Modal: Failed to create SSE:', err);
  }
};

const disconnectSSE = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
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
  disconnectSSE();
  emit('close');
  jobData.value = null;
};

onUnmounted(() => {
  disconnectSSE();
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
