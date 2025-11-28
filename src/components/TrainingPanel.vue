<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { api, type TrainingJobResponse } from '../services/api'; // Import TrainingJobResponse

interface TrainingPanelConfig {
  raw_dataset_path: string;
  output_dir: string;
  skip_preprocessing: boolean;
  learningRate: number; // New property
  epochs: number; // New property
}

const config = ref<TrainingPanelConfig>({
  raw_dataset_path: './dataset',
  output_dir: 'my_lora_model',
  skip_preprocessing: false,
  learningRate: 2e-4, // Default learning rate
  epochs: 25, // Default epochs
});

const recommendedEpochs = ref(50); // Initial recommended value
const datasetImageCount = ref(0); // New ref for image count

const isTraining = ref(false);
const statusMessage = ref('');
const currentEpoch = ref(0);
const totalEpochs = ref(0);
const currentStep = ref(0);
const totalSteps = ref(0);
const errorMessage = ref('');
const trainingJobId = ref<number | null>(null); // New ref for training job ID

let eventSource: EventSource | null = null;
let heartbeatTimer: number | null = null;
const HEARTBEAT_TIMEOUT = 300000; // 5분 동안 업데이트가 없으면 연결 끊김으로 간주

const updateRecommendedEpochs = (imageCount: number) => {
  // This is a placeholder for actual epoch calculation logic
  // For demonstration, let's say 5 epochs per image, capped at 250
  recommendedEpochs.value = Math.min(imageCount * 5, 250);
  // config.value.epochs = recommendedEpochs.value; // Removed automatic setting of epochs
};

const startTraining = async () => {
  try {
    errorMessage.value = '';

    // The new `startTraining` API takes a single config object.
    const response = await api.training.startTraining({
      modelName: config.value.output_dir,
      modelDescription: 'Training job created from UI',
      trainingImageUrls: [], // TODO: This needs to be implemented properly
      epochs: config.value.epochs,
      learningRate: config.value.learningRate,
      skipPreprocessing: config.value.skip_preprocessing,
    });

    statusMessage.value = response.message as string;
    if (response.data.job) {
      trainingJobId.value = response.data.job.id;
    }
    isTraining.value = true;

    // Connect to SSE stream for real-time progress
    connectToStream();
  } catch (error) {
    errorMessage.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

const checkServerStatus = async () => {
  try {
    // TODO: This needs to be updated to get the actual jobId from somewhere
    // For now, using a placeholder jobId for type compatibility
    if (trainingJobId.value === null) {
      // Attempt to find an existing job or set a default for checking
      // This is a simplification and needs proper state management
      console.warn("No trainingJobId available for status check. Skipping.");
      return;
    }

    const response = await api.training.getTrainingJob(trainingJobId.value);
    const status = response.data; // Assuming response.data is TrainingJobResponse
    isTraining.value = status.status === 'RUNNING' || status.status === 'PENDING';
    statusMessage.value = `Job ${status.id}: ${status.status}`;

    // 서버가 학습 중이라면 SSE 연결 시작
    if (isTraining.value) {
      connectToStream();
    }
  } catch (error) {
    console.error('Failed to check server status:', error);
    errorMessage.value = 'Failed to connect to server or retrieve job status';
  }
};

const resetHeartbeat = () => {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
  }

  heartbeatTimer = window.setTimeout(() => {
    // 60초 동안 업데이트가 없으면 연결 끊김
    handleConnectionLost();
  }, HEARTBEAT_TIMEOUT);
};

const handleConnectionLost = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }

  isTraining.value = false;
  errorMessage.value = 'Connection to server lost. The server may have been stopped.';
  statusMessage.value = 'Training interrupted - server connection lost';
};

const connectToStream = () => {
  // Close existing connection if any
  if (eventSource) {
    eventSource.close();
  }

  // Clear any existing heartbeat timer
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
  }

  errorMessage.value = '';

  // TODO: The SSE stream URL should ideally be dynamic or come from the API
  eventSource = new EventSource('http://127.0.0.1:8000/train/stream');

  eventSource.onopen = () => {
    console.log('SSE connection established');
    errorMessage.value = '';
    resetHeartbeat();
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      statusMessage.value = data.message || '';
      isTraining.value = data.status === 'TRAINING';

      // Reset heartbeat timer on every message
      resetHeartbeat();

      // Update progress information
      if (data.progress) {
        currentEpoch.value = data.progress.current_epoch || 0;
        totalEpochs.value = data.progress.total_epochs || 0;
        currentStep.value = data.progress.current_step || 0;
        totalSteps.value = data.progress.total_steps || 0;
      }

      // Close connection when training is complete or failed
      if (data.status === 'SUCCESS' || data.status === 'FAIL') {
        isTraining.value = false;
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (heartbeatTimer) {
          clearTimeout(heartbeatTimer);
          heartbeatTimer = null;
        }
      }
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    handleConnectionLost();
  };
};

// Check server status when component mounts
onMounted(() => {
  checkServerStatus();
  updateRecommendedEpochs(datasetImageCount.value); // Initial calculation
});

watch(datasetImageCount, (newVal) => {
  updateRecommendedEpochs(newVal);
});

watch(() => config.value.learningRate, () => {
  updateRecommendedEpochs(datasetImageCount.value);
});

// Cleanup on component unmount
onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
});
</script>

<template>
  <div class="card p-xl">
    <h2 class="text-3xl font-bold mb-lg">LoRA Training</h2>

    <div class="form-group">
      <label class="label" for="dataset-path">Dataset Path:</label>
      <input
        id="dataset-path"
        v-model="config.raw_dataset_path"
        type="text"
        placeholder="./dataset"
        class="input"
        :disabled="isTraining"
      />
    </div>

    <div class="form-group">
      <label class="label" for="output-dir">Output Directory:</label>
      <input
        id="output-dir"
        v-model="config.output_dir"
        type="text"
        placeholder="my_lora_model"
        class="input"
        :disabled="isTraining"
      />
    </div>

    <div class="form-group flex items-center justify-between">
      <label class="label text-base" for="skip-preprocessing">Skip Preprocessing</label>
      <label class="switch">
        <input
          id="skip-preprocessing"
          v-model="config.skip_preprocessing"
          type="checkbox"
          :disabled="isTraining"
        />
        <span class="slider round"></span>
      </label>
    </div>

    <div class="form-group">
      <label class="label" for="learning-rate">Learning Rate:</label>
      <input
        id="learning-rate"
        v-model.number="config.learningRate"
        type="number"
        step="1e-5"
        min="1e-6"
        max="1e-1"
        class="input"
        :disabled="isTraining"
      />
      <p class="text-sm text-muted mt-sm">
        일반적으로 learning rate 1e-4를 추천합니다.
      </p>
    </div>

    <div class="form-group">
      <label class="label" for="dataset-image-count">Dataset Image Count (for testing):</label>
      <input
        id="dataset-image-count"
        v-model.number="datasetImageCount"
        type="number"
        min="0"
        class="input"
        :disabled="isTraining"
      />
      <p class="text-sm text-muted mt-sm">
        이 값은 에포크 추천 값 계산을 위해 임시로 사용됩니다.
      </p>
    </div>

    <div class="form-group">
      <label class="label" for="epochs">Epochs:</label>
      <input
        id="epochs"
        v-model.number="config.epochs"
        type="number"
        min="1"
        max="250"
        class="input"
        :disabled="isTraining"
      />
      <p class="text-sm text-muted mt-sm">
        계산된 적정값인 {{ recommendedEpochs }} 에포크를 추천합니다 (최대 250 에포크).
      </p>
    </div>

    <button
      class="btn btn-primary btn-lg w-full"
      @click="startTraining"
      :disabled="isTraining"
    >
      {{ isTraining ? 'Training...' : 'Start Training' }}
    </button>

    <div v-if="statusMessage" class="mt-md p-md rounded-md" :class="isTraining ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'">
      {{ statusMessage }}
    </div>

    <div v-if="errorMessage" class="mt-md p-md rounded-md bg-red-500/10 text-error">
      {{ errorMessage }}
    </div>

    <!-- Progress Bars -->
    <div v-if="isTraining && totalEpochs > 0" class="mt-lg space-y-md">
      <div class="progress-item">
        <div class="flex justify-between mb-sm">
          <span class="text-sm font-semibold text-secondary">Epoch Progress</span>
          <span class="text-sm font-bold text-primary">{{ currentEpoch }} / {{ totalEpochs }}</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2.5">
          <div
            class="bg-primary h-2.5 rounded-full"
            :style="{ width: `${(currentEpoch / totalEpochs) * 100}%` }"
          ></div>
        </div>
      </div>

      <div class="progress-item" v-if="totalSteps > 0">
        <div class="flex justify-between mb-sm">
          <span class="text-sm font-semibold text-secondary">Step Progress</span>
          <span class="text-sm font-bold text-primary">{{ currentStep }} / {{ totalSteps }}</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2.5">
          <div
            class="bg-accent h-2.5 rounded-full"
            :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-hover);
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--primary);
}

input:checked + .slider:before {
  transform: translateX(26px);
}
</style>
