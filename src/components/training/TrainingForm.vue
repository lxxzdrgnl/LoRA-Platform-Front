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
const skipPreprocessing = ref(false);

const isTraining = ref(false);
const trainingJobId = ref<number | null>(null);
const error = ref('');
const currentEpoch = ref(0);
const totalEpochs = ref(0);
const statusMessage = ref('');
const currentUserId = ref<number | null>(null);

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

  // 1. 목표: 최소 1500스텝은 하되, 이미지가 많으면 장당 100스텝 비율로 늘림
  const targetSteps = Math.max(1500, image_count * 100); 

  // 2. 학습률 보정(LR) + 에포크 환산(나누기)
  let calculated_epochs = Math.max(10, Math.floor((targetSteps * (0.0001 / current_learning_rate)) / image_count));

  return calculated_epochs;
});

const isTrainingButtonDisabled = computed(() => {
  return isTraining.value || trainingImagesCount.value < 10 || !title.value.trim();
});

watch([trainingImagesCount, learningRate], () => {
    if (recommendedEpochs.value !== null) {
        epochs.value = Math.min(recommendedEpochs.value, 250);
    }
}, { immediate: true }); // immediate: true to run the watcher once immediately on component setup

let websocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20; // 최대 20번 재연결 시도 (100초) - 장시간 학습 대응

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

const startTraining = async () => {
  if (!authStore.requireAuth()) return;

  // 중복 클릭 방지
  if (isTraining.value) {
    console.log('Training already in progress, ignoring duplicate click');
    return;
  }

  if (!title.value.trim()) {
    error.value = 'Please enter a model title';
    return;
  }
  if (selectedImages.value.length === 0) {
    error.value = '업로드할 이미지를 선택해주세요.';
    return;
  }

  try {
    // Get current user ID if not already set
    if (!currentUserId.value) {
      const userResponse = await api.user.getMyProfile();
      currentUserId.value = userResponse.data.id;
      console.log('Current user ID:', currentUserId.value);
    }

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

    // 1. Get presigned URLs for image uploads
    statusMessage.value = 'Getting presigned URLs...';
    const fileNames = selectedImages.value.map(file => file.name);
    const urlResponse = await api.upload.getPresignedUrls(fileNames);
    const { uploadUrls, downloadUrls } = urlResponse.data;

    // 2. Upload images to S3
    statusMessage.value = 'Uploading images to S3...';
    for (let i = 0; i < selectedImages.value.length; i++) {
      const file = selectedImages.value[i];
      const uploadUrl = uploadUrls[i];
      if (uploadUrl && file) {
        statusMessage.value = `Uploading image ${i + 1}/${selectedImages.value.length}...`;
        await api.upload.uploadToS3(uploadUrl, file);
      } else {
        throw new Error(`Upload URL or file for ${file?.name || 'unknown file'} is missing.`);
      }
    }
    statusMessage.value = 'All images uploaded successfully!';

    // 3. Start training (통합 엔드포인트 - TrainingJob 생성 + 학습 시작)
    reconnectAttempts = 0; // 학습 시작 시 재연결 카운터 리셋
    statusMessage.value = 'Starting training...';
    const trainingResponse = await api.training.startTraining({
      modelName: title.value,
      modelDescription: description.value,
      trainingImageUrls: downloadUrls,
      triggerWord: triggerWord.value || undefined,
      epochs: epochs.value,
      learningRate: learningRate.value,
      loraRank: loraRank.value,
      baseModel: baseModel.value,
      skipPreprocessing: skipPreprocessing.value,
    });

    trainingJobId.value = trainingResponse.data.job.id;
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

  // Use the actual user ID from the API
  const userId = currentUserId.value || 0;
  const wsUrl = getWebSocketUrl(`/ws/training?userId=${userId}`);

  console.log(`Attempting WebSocket connection to: ${wsUrl}, with userId: ${userId}, attempt: ${reconnectAttempts + 1}`);
  statusMessage.value = 'Connecting to training server...';

  try {
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected successfully');
      statusMessage.value = 'Connected to training server';
      error.value = ''; // Clear any previous errors
      reconnectAttempts = 0; // 연결 성공 시 재연결 카운터 리셋

      heartbeatTimer = setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      if (data.type === 'pong') return;

      if (trainingJobId.value && data.jobId && data.jobId !== trainingJobId.value) {
          console.log(`Ignoring message for different job: ${data.jobId} (current: ${trainingJobId.value})`);
          return;
      }

      if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
        isTraining.value = false;
        statusMessage.value = '✅ Training completed successfully!';
        emit('training-status-change', {
          isTraining: false,
          statusMessage: statusMessage.value,
          currentEpoch: currentEpoch.value,
          totalEpochs: totalEpochs.value
        });
        disconnectWebSocket();
        emit('refresh-history');
      } else if (data.status === 'FAILED' || data.status === 'FAIL') {
        isTraining.value = false;
        error.value = data.message || data.error || 'Training failed';
        emit('training-status-change', {
          isTraining: false,
          statusMessage: '',
          currentEpoch: 0,
          totalEpochs: 0
        });
        disconnectWebSocket();
        emit('refresh-history');
      } else {
        // 진행 상태에 따라 메시지 포맷팅
        let formattedMessage = '';

        if (data.status === 'LOADING') {
          formattedMessage = '🔄 Loading server...';
        } else if (data.status === 'DOWNLOADING') {
          formattedMessage = '⬇️ Downloading training images from S3...';
        } else if (data.status === 'DOWNLOADING_COMPLETE') {
          formattedMessage = `✅ Downloaded ${data.message?.match(/\d+/)?.[0] || ''} images`;
        } else if (data.status === 'PREPROCESSING') {
          formattedMessage = '🖼️ Processing images (captioning, cropping)...';
        } else if (data.status === 'CAPTIONING_COMPLETE') {
          formattedMessage = '✅ Image preprocessing complete';
        } else if (data.status === 'TRAINING') {
          // epoch 정보가 있으면 업데이트
          if (data.currentEpoch !== null && data.currentEpoch !== undefined) {
            currentEpoch.value = data.currentEpoch;
            formattedMessage = `🚀 Training model... Epoch ${data.currentEpoch} / ${totalEpochs.value}`;
            console.log(`Epoch updated: ${currentEpoch.value}/${totalEpochs.value}`);
          } else {
            formattedMessage = '🚀 Starting training pipeline...';
          }
        } else if (data.status === 'UPLOADING') {
          formattedMessage = '⬆️ Uploading trained model to S3...';
        } else {
          formattedMessage = data.message || data.status;
        }

        statusMessage.value = formattedMessage;

        emit('training-status-change', {
          isTraining: true,
          statusMessage: statusMessage.value,
          currentEpoch: currentEpoch.value,
          totalEpochs: totalEpochs.value
        });
      }
    };

    websocket.onerror = (event) => {
      console.error('WebSocket error:', event);
      console.error('WebSocket URL:', wsUrl);
      // Don't show error immediately - wait for close event
    };

    websocket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      if (heartbeatTimer) clearInterval(heartbeatTimer);

      if (isTraining.value && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Training in progress, will reconnect in 5 seconds... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        statusMessage.value = `Reconnecting to training server... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
        reconnectTimer = setTimeout(connectWebSocket, 5000);
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('최대 재연결 시도 횟수 초과. 연결을 중단합니다.');
        error.value = '서버 연결이 불안정합니다. 학습 상태를 확인해주세요.';
        isTraining.value = false;
      }
    };
  } catch (err) {
    console.error('Failed to create WebSocket:', err);
    error.value = `Failed to connect to training server: ${err instanceof Error ? err.message : 'Unknown error'}`;

    if (isTraining.value) {
      // Retry connection
      reconnectTimer = setTimeout(connectWebSocket, 5000);
    }
  }
};

const disconnectWebSocket = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (websocket) {
    websocket.close();
    websocket = null;
  }
  reconnectAttempts = 0; // 재연결 카운터 리셋
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

// 페이지 로드 시 진행 중인 학습 작업 확인
const checkActiveTraining = async () => {
  if (!authStore.isAuthenticated()) return;

  try {
    // Get current user ID first
    const userResponse = await api.user.getMyProfile();
    currentUserId.value = userResponse.data.id;
    console.log('Current user ID:', currentUserId.value);

    const response = await api.training.getMyActiveTrainingJob();
    if (response.data) {
      const activeJob = response.data;
      console.log('Active training job found:', activeJob);

      // UI 업데이트
      isTraining.value = true;
      trainingJobId.value = activeJob.id;
      totalEpochs.value = activeJob.totalEpochs || 0;
      currentEpoch.value = activeJob.currentEpoch || 0;
      statusMessage.value = `Training in progress (${activeJob.status})`;

      emit('training-status-change', {
        isTraining: true,
        statusMessage: statusMessage.value,
        currentEpoch: currentEpoch.value,
        totalEpochs: totalEpochs.value
      });

      // WebSocket 연결
      connectWebSocket();
    }
  } catch (err) {
    console.error('Failed to check active training:', err);
  }
};

// 컴포넌트 마운트 시 진행 중인 작업 확인
import { onMounted } from 'vue';
onMounted(() => {
  checkActiveTraining();
});

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
              <label class="label">Model Name *</label>
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
                <p class="upload-hint">JPG, JPEG, PNG, WEBP (이미지 당 최대 10MB, 최소 10장, 최대 40장)</p>
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
          :disabled="isTrainingButtonDisabled"
          @click="startTraining"
        >
          {{ isTraining ? 'Training...' : 'Start Training' }}
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