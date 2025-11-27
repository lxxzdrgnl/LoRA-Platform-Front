<script setup lang="ts">
import { ref, onUnmounted, computed, watch } from 'vue';
import { api, authStore, getWebSocketUrl } from '../../services/api';
import { BookText, Images, BrainCircuit, ChevronDown, HelpCircle } from 'lucide-vue-next';

const emit = defineEmits(['refresh-history', 'training-status-change']);

const openSections = ref<string[]>(['model-details', 'training-images']);

const title = ref('');
const description = ref('');
const triggerWord = ref('');
const trainingImagesCount = ref(0);
const learningRate = ref(0.0001);
const epochs = ref(10);
const loraRank = ref(32);
const baseModel = ref('Lykon/AnyLoRA');
const isPublic = ref(false);
const skipPreprocessing = ref(false);

const isTraining = ref(false);
const modelId = ref<number | null>(null);
const trainingJobId = ref<number | null>(null);
const error = ref('');
const currentEpoch = ref(0);
const totalEpochs = ref(0);
const statusMessage = ref('');

// Image upload state
const selectedImages = ref<File[]>([]);
const imagePreviewUrls = ref<string[]>([]);
const isDragging = ref(false);
const uploadError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES_COUNT = 40; // Max 40 images

const recommendedEpochs = computed(() => {
  const image_count = trainingImagesCount.value;
  const current_learning_rate = learningRate.value;

  const BASE_STEPS = 2000;
  const BASE_LR = 1e-4;

  if (image_count <= 0) return null; // Return null to indicate no recommendation
  if (current_learning_rate <= 0) return 100; // Default if learning rate is invalid

  const ratio = BASE_LR / current_learning_rate;
  const target_steps = Math.floor(BASE_STEPS * ratio);
  
  let calculated_epochs = Math.floor(target_steps / image_count);

  // Safety caps
  if (calculated_epochs < 10) {
    calculated_epochs = 10;
  }

  return calculated_epochs;
});

watch([trainingImagesCount, learningRate], () => {
    if (recommendedEpochs.value !== null) {
        epochs.value = Math.min(recommendedEpochs.value, 250);
    }
}, { immediate: true }); // immediate: true to run the watcher once immediately on component setup

let websocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const formatLearningRate = (value: number): string => {
  return value.toExponential(0);
};

const toggleSection = (section: string) => {
  const index = openSections.value.indexOf(section);
  if (index > -1) {
    openSections.value.splice(index, 1);
  } else {
    openSections.value.push(section);
  }
};

const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name}: 허용되지 않는 파일 형식입니다. (jpg, jpeg, png, webp만 가능)`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: 파일 크기가 10MB를 초과합니다.`;
  }
  return null;
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    addFiles(Array.from(target.files));
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = false;
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = false;
  if (event.dataTransfer?.files) {
    addFiles(Array.from(event.dataTransfer.files));
  }
};

const addFiles = (files: File[]) => {
  if (!authStore.requireAuth()) return;
  uploadError.value = '';
  const newFilesToProcess = files.filter(file => {
    const validationError = validateImageFile(file);
    if (validationError) {
      uploadError.value = validationError; // Display error for this specific file
      return false;
    }
    return true;
  });

  if (selectedImages.value.length + newFilesToProcess.length > MAX_IMAGES_COUNT) {
    uploadError.value = `최대 ${MAX_IMAGES_COUNT}장의 이미지만 업로드할 수 있습니다.`;
    return;
  }

  for (const file of newFilesToProcess) {
    selectedImages.value.push(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        imagePreviewUrls.value.push(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }
  trainingImagesCount.value = selectedImages.value.length;
};

const removeImage = (index: number) => {
  if (!authStore.requireAuth()) return;
  selectedImages.value.splice(index, 1);
  imagePreviewUrls.value.splice(index, 1);
  trainingImagesCount.value = selectedImages.value.length;
};

const uploadImagesToS3 = async (): Promise<string[]> => {
  if (selectedImages.value.length === 0) {
    error.value = '업로드할 이미지를 선택해주세요.';
    return [];
  }

  statusMessage.value = 'Getting presigned URLs...';
  try {
    const fileNames = selectedImages.value.map(file => file.name);
    // Presigned URL 요청 시 job ID 대신 임시 식별자를 사용할 수 있지만,
    // 여기서는 먼저 모델과 작업을 생성한 후 ID를 받아 업로드하는 방식을 유지합니다.
    // 이 부분은 백엔드 API 설계에 따라 달라질 수 있습니다.
    // 우선 모델 생성 후 받는 Job ID를 사용하겠습니다.

    // 이 함수는 startTraining 내부에서 호출되므로, jobId를 인자로 받아야 합니다.
    // 지금 구조에서는 startTraining에서 직접 처리하므로 이 함수는 약간의 수정이 필요합니다.
    // 여기서는 startTraining 로직에 통합되어 있다고 가정하고 진행합니다.
    // 독립 실행을 위해선 jobId를 받아야 합니다.
    // 하지만 현재 로직은 startTraining에서 모든것을 관장하므로, 이 함수를 직접 호출하지 않습니다.
    // startTraining 로직을 그대로 가져오겠습니다.
    return []; // 이 함수는 startTraining으로 이전되었습니다.
  } catch (err) {
    error.value = `Failed to upload images: ${err instanceof Error ? err.message : 'Unknown error'}`;
    return [];
  }
};


const startTraining = async () => {
  if (!authStore.requireAuth()) return;

  if (!title.value.trim()) {
    error.value = 'Please enter a model title';
    return;
  }
  if (selectedImages.value.length === 0) {
    error.value = '업로드할 이미지를 선택해주세요.';
    return;
  }

  try {
    isTraining.value = true;
    emit('training-status-change', {
      isTraining: true,
      statusMessage: '',
      currentEpoch: 0,
      totalEpochs: epochs.value
    });
    error.value = '';
    uploadError.value = '';
    currentEpoch.value = 0;
    totalEpochs.value = epochs.value;
    statusMessage.value = 'Creating model...';

    // 1. Create model to get a modelId
    const modelResponse = await api.training.createModel({
      title: title.value,
      description: description.value,
      trainingImagesCount: selectedImages.value.length,
      epochs: epochs.value,
      learningRate: learningRate.value,
      loraRank: loraRank.value,
      baseModel: baseModel.value,
      isPublic: isPublic.value,
    });
    modelId.value = modelResponse.data.id;
    statusMessage.value = 'Creating training job...';

    // 2. Create a training job to get a jobId
    const jobResponse = await api.training.createTrainingJob(modelId.value);
    trainingJobId.value = jobResponse.data.id;

    // 3. Get presigned URLs for image uploads
    statusMessage.value = 'Getting presigned URLs...';
    const fileNames = selectedImages.value.map(file => file.name);
    const urlResponse = await api.upload.getPresignedUrls(fileNames);
    const { uploadUrls, downloadUrls } = urlResponse.data;

    // 4. Upload images to S3
    statusMessage.value = 'Uploading images to S3...';
    for (let i = 0; i < selectedImages.value.length; i++) {
      const file = selectedImages.value[i];
      const uploadUrl = uploadUrls[i];
      if (uploadUrl && file) { // Ensure both uploadUrl and file are defined
        statusMessage.value = `Uploading image ${i + 1}/${selectedImages.value.length}...`;
        await api.upload.uploadToS3(uploadUrl, file);
      } else {
        throw new Error(`Upload URL or file for ${file?.name || 'unknown file'} is missing.`);
      }
    }
    statusMessage.value = 'All images uploaded successfully!';
    
    // 5. Start the actual training process
    statusMessage.value = 'Starting training...';
    await api.training.startTraining(trainingJobId.value, {
      totalEpochs: epochs.value,
      modelName: title.value,
      trainingImageUrls: downloadUrls,
      learningRate: learningRate.value,
    });

    statusMessage.value = 'Training started...';
    emit('training-status-change', {
      isTraining: true,
      statusMessage: statusMessage.value,
      currentEpoch: currentEpoch.value,
      totalEpochs: totalEpochs.value
    });
    connectWebSocket();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to start training';
    isTraining.value = false;
    emit('training-status-change', {
      isTraining: false,
      statusMessage: '',
      currentEpoch: 0,
      totalEpochs: 0
    });
  }
};

const connectWebSocket = () => {
  if (websocket) websocket.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  const userId = localStorage.getItem('userId') || '0';
  const wsUrl = getWebSocketUrl(`/ws/training?userId=${userId}`);
  statusMessage.value = 'Connecting to training server...';
  websocket = new WebSocket(wsUrl);

  websocket.onopen = () => {
    heartbeatTimer = setInterval(() => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  };

  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'pong') return;

    if (trainingJobId.value && data.jobId && data.jobId !== trainingJobId.value) {
        return;
    }

    if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
      isTraining.value = false;
      statusMessage.value = 'Training completed successfully!';
      emit('training-status-change', {
        isTraining: false,
        statusMessage: statusMessage.value,
        currentEpoch: currentEpoch.value,
        totalEpochs: totalEpochs.value
      });
      disconnectWebSocket();
      emit('refresh-history');
    } else if (data.status === 'FAILED') {
      isTraining.value = false;
      error.value = data.message || 'Training failed';
      emit('training-status-change', {
        isTraining: false,
        statusMessage: '',
        currentEpoch: 0,
        totalEpochs: 0
      });
      disconnectWebSocket();
      emit('refresh-history');
    } else {
      statusMessage.value = data.message || data.status;
      emit('training-status-change', {
        isTraining: true,
        statusMessage: statusMessage.value,
        currentEpoch: currentEpoch.value,
        totalEpochs: totalEpochs.value
      });
    }
  };

  websocket.onerror = () => {
    error.value = 'WebSocket connection error';
  };

  websocket.onclose = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (isTraining.value) {
      reconnectTimer = setTimeout(connectWebSocket, 5000);
    }
  };
};

const disconnectWebSocket = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (websocket) {
    websocket.close();
    websocket = null;
  }
};

const cancelTraining = async () => {
  if (!trainingJobId.value) return;
  try {
    await api.training.deleteTrainingJob(trainingJobId.value);
    isTraining.value = false;
    statusMessage.value = 'Training cancelled';
    emit('training-status-change', {
      isTraining: false,
      statusMessage: '',
      currentEpoch: 0,
      totalEpochs: 0
    });
    disconnectWebSocket();
    emit('refresh-history');
  } catch (err) {
    console.error('Failed to cancel training:', err);
  }
};

const handleAuthCheck = (event: FocusEvent) => {
  if (!authStore.isAuthenticated()) {
    (event.target as HTMLElement).blur();
    authStore.requireAuth();
  }
};

onUnmounted(() => {
  disconnectWebSocket();
});
</script>

<template>
  <div class="config-section">
    <div class="card">
      <h2 class="text-3xl font-bold mb-lg gradient-text text-center">Training Configuration</h2>

      <!-- Accordion -->
      <div class="accordion">
        <!-- Section 1: Model Details -->
        <div class="accordion-item">
          <div class="accordion-header" @click="toggleSection('model-details')">
            <div class="flex items-center gap-md">
              <BookText :size="24" class="text-primary" />
              <h3 class="text-xl font-semibold">Model Details</h3>
            </div>
            <ChevronDown :class="['accordion-chevron', { 'rotated': openSections.includes('model-details') }]" />
          </div>
          <div v-if="openSections.includes('model-details')" class="accordion-content">
            <div class="form-group">
              <label class="label">Model Title *</label>
              <input v-model="title" type="text" class="input" placeholder="My Custom LoRA Model" :disabled="isTraining" @focus="handleAuthCheck" />
            </div>
            <div class="form-group">
              <label class="label">Description</label>
              <textarea v-model="description" class="textarea" rows="3" placeholder="Describe your model..." :disabled="isTraining" @focus="handleAuthCheck"></textarea>
            </div>
            <div class="form-group">
                <div class="flex items-center gap-sm mb-xs">
                    <label class="label m-0">Trigger Word</label>
                    <div class="tooltip-container">
                        <HelpCircle :size="16" class="text-muted cursor-pointer" />
                        <div class="tooltip-text">
                            이미지 생성 시 학습된 스타일이나 캐릭터를 활성화하기 위한 특수 키워드입니다. 프롬프트에 이 단어를 포함하면 학습한 특징이 적용됩니다.
                        </div>
                    </div>
                </div>
              <input v-model="triggerWord" type="text" class="input" placeholder="e.g., sksperson, mychar, specialstyle" :disabled="isTraining" @focus="handleAuthCheck" />
            </div>
          </div>
        </div>

        <!-- Section 2: Training Images -->
        <div class="accordion-item">
          <div class="accordion-header" @click="toggleSection('training-images')">
            <div class="flex items-center gap-md">
              <Images :size="24" class="text-primary" />
              <h3 class="text-xl font-semibold">Training Images <span v-if="trainingImagesCount > 0" class="text-sm text-muted">({{ trainingImagesCount }} images)</span></h3>
            </div>
            <ChevronDown :class="['accordion-chevron', { 'rotated': openSections.includes('training-images') }]" />
          </div>
          <div v-if="openSections.includes('training-images')" class="accordion-content">
            <div class="form-group flex items-center gap-md">
              <div class="flex items-center gap-sm">
                  <label class="label text-base m-0" for="skip-preprocessing">Skip Preprocessing</label>
                  <div class="tooltip-container">
                      <HelpCircle :size="16" class="text-muted cursor-pointer" />
                      <div class="tooltip-text">
                          체크 시 이미지 전처리(택스트 제거, 캐릭터 크롭 등)을 스킵합니다. 이미지가 이미 잘 준비되어 있을 때 유용합니다.
                      </div>
                  </div>
              </div>
              <label class="switch">
                <input
                  id="skip-preprocessing"
                  v-model="skipPreprocessing"
                  type="checkbox"
                  :disabled="isTraining"
                />
                <span class="switch-slider round"></span>
              </label>
            </div>
            <div class="form-group">
              <div class="upload-zone" :class="{ 'upload-zone-dragging': isDragging }" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop" @click="() => fileInput?.click()">
                <input ref="fileInput" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" style="display: none;" :disabled="isTraining" @change="handleFileSelect" />
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p class="upload-text">클릭하거나 이미지를 드래그하여 업로드</p>
                <p class="upload-hint">JPG, JPEG, PNG, WEBP (이미지 당 최대 10MB, 최대 40장)</p>
              </div>
              <div v-if="uploadError" class="mt-sm text-error text-sm p-sm bg-red-500/10 rounded-lg">{{ uploadError }}</div>
              <div v-if="imagePreviewUrls.length > 0" class="image-preview-grid mt-md">
                <div v-for="(url, index) in imagePreviewUrls" :key="index" class="image-preview-item">
                  <img :src="url" :alt="`Preview ${index + 1}`" class="preview-image" />
                  <button v-if="!isTraining" class="remove-image-btn" @click.stop="removeImage(index)" title="Remove image"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                  <div class="image-name">{{ selectedImages[index]?.name }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: Hyperparameters -->
        <div class="accordion-item">
          <div class="accordion-header" @click="toggleSection('hyperparameters')">
            <div class="flex items-center gap-md">
              <BrainCircuit :size="24" class="text-primary" />
              <h3 class="text-xl font-semibold">Hyperparameters (Advanced)</h3>
            </div>
            <ChevronDown :class="['accordion-chevron', { 'rotated': openSections.includes('hyperparameters') }]" />
          </div>
          <div v-if="openSections.includes('hyperparameters')" class="accordion-content">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  <div class="form-group">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-sm">
                            <label class="label m-0">Learning Rate</label>
                            <div class="tooltip-container">
                                <HelpCircle :size="16" class="text-muted cursor-pointer" />
                                <div class="tooltip-text">
                                    학습률은 모델이 한 번에 얼마나 많이 학습할지를 결정합니다. 값이 너무 크면 학습이 불안정해지고, 너무 작으면 학습 속도가 느려집니다. 일반적으로 1e-4를 추천합니다.
                                </div>
                            </div>
                        </div>
                        <span class="font-mono text-sm">{{ formatLearningRate(learningRate) }}</span>
                    </div>
                      <input v-model.number="learningRate" type="range" min="0.00002" max="0.0002" step="0.00001" class="slider mt-xs" :disabled="isTraining" />
                      <div class="flex justify-between text-xs text-muted mt-xs">
                        <span>2e-5</span>
                        <span>2e-4</span>
                      </div>
                  </div>
                  <div class="form-group">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-sm">
                            <label class="label m-0">Epochs</label>
                            <div class="tooltip-container">
                                <HelpCircle :size="16" class="text-muted cursor-pointer" />
                                <div class="tooltip-text">
                                    전체 학습 데이터셋을 몇 번 반복하여 학습할지 결정합니다. 이미지 개수와 learning rate를 기반으로 계산된 값을 추천합니다.
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-sm">
                           <span v-if="recommendedEpochs !== null && trainingImagesCount > 0" class="text-xs text-warning">
                                (추천: {{ recommendedEpochs }})
                            </span>
                            <span class="font-mono text-sm">{{ epochs }}</span>
                        </div>
                    </div>
                      <input v-model.number="epochs" type="range" min="5" max="250" class="slider mt-xs" :disabled="isTraining" />
                  </div>
                  <div class="form-group">
                    <div class="flex items-center gap-sm mb-xs">
                        <label class="label m-0">LoRA Rank</label>
                        <div class="tooltip-container">
                            <HelpCircle :size="16" class="text-muted cursor-pointer" />
                            <div class="tooltip-text">
                                LoRA 모델의 복잡성을 결정합니다. 높은 값은 더 많은 디테일을 학습할 수 있지만, 파일 크기가 커지고 과적합의 위험이 있습니다. 32가 일반적으로 좋은 시작점입니다.
                            </div>
                        </div>
                    </div>
                    <select v-model.number="loraRank" class="input" :disabled="isTraining">
                        <option :value="16">16</option>
                        <option :value="32">32 (Recommended)</option>
                        <option :value="64">64</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <div class="flex items-center gap-sm mb-xs">
                        <label class="label m-0">Base Model</label>
                        <div class="tooltip-container">
                            <HelpCircle :size="16" class="text-muted cursor-pointer" />
                            <div class="tooltip-text">
                                LoRA 모델을 학습시킬 기반이 되는 스테이블 디퓨전 모델입니다.
                            </div>
                        </div>
                    </div>
                    <select v-model="baseModel" class="input" :disabled="isTraining">
                        <option value="stablediffusionapi/anything-v5">Anything V5</option>
                        <option value="Lykon/AnyLoRA">AnyLoRA</option>
                    </select>
                  </div>
              </div>

          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-md mt-lg">
        <button
          class="btn btn-primary flex-1 btn-lg custom-shadow-glow"
          :disabled="isTraining"
          @click="startTraining"
        >
          {{ isTraining ? 'Training...' : 'Start Training' }}
        </button>
        <button
          v-if="isTraining"
          class="btn btn-secondary btn-lg"
          @click="cancelTraining"
        >
          Cancel
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="card mt-md p-md bg-red-500/10 border border-error/30">
        <p class="text-error text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background-color: var(--bg-dark);
  border: none;
  box-shadow: none;
}

.config-section {
  height: fit-content;
}

/* Image Upload Styles */
.upload-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-xl);
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-card);
}

.upload-zone:hover {
  border-color: var(--primary);
  background: var(--bg-hover);
}

.upload-zone-dragging {
  border-color: var(--primary);
  background: var(--bg-hover);
}

.upload-icon {
  margin: 0 auto var(--space-md);
  color: var(--text-muted);
}

.upload-text {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: var(--space-xs);
}

.upload-hint {
  font-size: 14px;
  color: var(--text-muted);
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-md);
}

.image-preview-item {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border);
  transition: all 0.3s ease;
}

.image-preview-item:hover {
  transform: translateY(-2px);
}

.preview-image {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
}

.remove-image-btn {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: var(--radius-full);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.remove-image-btn:hover {
  background: #ef4444;
  transform: scale(1.1);
}

.image-name {
  padding: var(--space-xs) var(--space-sm);
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: var(--bg-card);
}

/* Accordion Styles */
.accordion {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: visible;
  margin-top: var(--space-lg);
}
.accordion-item {
  border-bottom: 1px solid var(--border);
}
.accordion-item:last-child {
  border-bottom: none;
}
.accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  cursor: pointer;
  background-color: var(--bg-card);
  transition: background-color 0.2s;
}
.accordion-header:hover {
  background-color: var(--bg-hover);
}
.accordion-chevron {
  transition: transform 0.3s ease;
}
.accordion-chevron.rotated {
  transform: rotate(180deg);
}
.accordion-content {
  padding: var(--space-lg);
  background-color: var(--bg-dark);
  border-top: 1px solid var(--border);
}

.slider {
    -webkit-appearance: none;
    width: 100%;
    height: 8px;
    border-radius: 5px;
    background: var(--bg-hover);
    outline: none;
    opacity: 0.7;
    transition: opacity .2s;
}
.slider:hover {
    opacity: 1;
}
.slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
}
.slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
}

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

.switch-slider {
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

.switch-slider:before {
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

input:checked + .switch-slider {
  background-color: var(--primary);
}

input:focus + .switch-slider {
  box-shadow: 0 0 1px var(--primary);
}

input:checked + .switch-slider:before {
  transform: translateX(26px);
}


@media (max-width: 1024px) {
  .image-preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .card {
    padding: var(--space-md);
  }

  .accordion-header {
    padding: var(--space-md);
  }

  .accordion-content {
    padding: var(--space-md);
  }
}

.tooltip-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.tooltip-text {
  visibility: hidden;
  opacity: 0;
  width: 250px;
  background-color: var(--bg-hover);
  color: var(--text-primary);
  text-align: left;
  border-radius: var(--radius-md);
  padding: var(--space-md);
  position: absolute;
  z-index: 10;
  bottom: 150%;
  left: 50%;
  transform: translateX(-50%);
  transition: opacity 0.3s;
  box-shadow: var(--shadow-lg);
  font-size: 14px;
  line-height: 1.5;
}

.tooltip-text::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: var(--bg-hover) transparent transparent transparent;
}

.tooltip-container:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
}
</style>