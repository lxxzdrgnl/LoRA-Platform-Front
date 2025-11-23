<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, authStore } from '../services/api';
import { BookText, Images, BrainCircuit, ChevronDown } from 'lucide-vue-next';

const router = useRouter();

const openSections = ref<string[]>(['model-details']);

const title = ref('');
const description = ref('');
const characterName = ref('');
const style = ref('');
const trainingImagesCount = ref(20);
const learningRate = ref(0.0001);
const epochs = ref(10);
const loraRank = ref(8);
const baseModel = ref('stablediffusionapi/anything-v5');
const isPublic = ref(false);

const isTraining = ref(false);
const modelId = ref<number | null>(null);
const trainingJobId = ref<number | null>(null);
const error = ref('');
const currentEpoch = ref(0);
const totalEpochs = ref(0);
const statusMessage = ref('');

const trainingHistory = ref<any[]>([]);

// Image upload state
const selectedImages = ref<File[]>([]);
const imagePreviewUrls = ref<string[]>([]);
const isDragging = ref(false);
const uploadError = ref('');
const fileInput = ref<HTMLInputElement | null>(null); // Explicitly type fileInput ref

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

let eventSource: EventSource | null = null;

onMounted(async () => {
  // 인증 체크
  if (!authStore.requireAuth()) return;

  await loadTrainingHistory();
});

const toggleSection = (section: string) => {
  const index = openSections.value.indexOf(section);
  if (index > -1) {
    openSections.value.splice(index, 1);
  } else {
    openSections.value.push(section);
  }
};

const loadTrainingHistory = async () => {
  try {
    const response = await api.training.getMyTrainingJobs();
    trainingHistory.value = response.data;
  } catch (err) {
    console.error('Failed to load training history:', err);
  }
};

// Image validation
const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name}: 허용되지 않는 파일 형식입니다. (jpg, jpeg, png, webp만 가능)`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: 파일 크기가 10MB를 초과합니다.`;
  }
  return null;
};

// Handle file input change
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    addFiles(Array.from(target.files));
  }
};

// Handle drag and drop
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

// Add files with validation
const addFiles = (files: File[]) => {
  uploadError.value = '';

  for (const file of files) {
    const validationError = validateImageFile(file);
    if (validationError) {
      uploadError.value = validationError;
      continue;
    }

    selectedImages.value.push(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        imagePreviewUrls.value.push(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }

  // Update training images count
  trainingImagesCount.value = selectedImages.value.length;
};

// Remove image
const removeImage = (index: number) => {
  selectedImages.value.splice(index, 1);
  imagePreviewUrls.value.splice(index, 1);
  trainingImagesCount.value = selectedImages.value.length;
};

// Upload images to S3
const uploadImagesToS3 = async (): Promise<string[]> => {
  if (selectedImages.value.length === 0) {
    error.value = '업로드할 이미지를 선택해주세요.';
    return [];
  }

  statusMessage.value = 'Getting presigned URLs...';

  try {
    // Get all presigned URLs at once
    const fileNames = selectedImages.value.map(file => file.name);
    const urlResponse = await api.upload.getPresignedUrls(fileNames);
    const { uploadUrls, downloadUrls } = urlResponse.data;

    statusMessage.value = 'Uploading images to S3...';

    // Upload all images
    for (let i = 0; i < selectedImages.value.length; i++) {
      const file = selectedImages.value[i];
      const uploadUrl = uploadUrls[i];
      if (!file || !uploadUrl) {
        console.warn(`Skipping undefined file or URL at index ${i}`);
        continue;
      }
      statusMessage.value = `Uploading image ${i + 1}/${selectedImages.value.length}...`;

      // Upload to S3 using presigned URL
      await api.upload.uploadToS3(uploadUrl, file);
    }

    statusMessage.value = 'All images uploaded successfully!';
    return downloadUrls;
  } catch (err) {
    error.value = `Failed to upload images: ${err instanceof Error ? err.message : 'Unknown error'}`;
    return [];
  }
};

const startTraining = async () => {
  if (!title.value.trim()) {
    error.value = 'Please enter a model title';
    return;
  }

  try {
    isTraining.value = true;
    error.value = '';
    uploadError.value = '';
    currentEpoch.value = 0;
    totalEpochs.value = epochs.value;

    // 1. Upload images to S3 and get download URLs
    const trainingImageUrls = await uploadImagesToS3();
    if (trainingImageUrls.length === 0) {
      isTraining.value = false;
      return;
    }

    statusMessage.value = 'Creating model...';

    // 2. Create model with training parameters
    const modelResponse = await api.training.createModel({
      title: title.value,
      description: description.value,
      characterName: characterName.value,
      style: style.value,
      trainingImagesCount: trainingImagesCount.value,
      epochs: epochs.value,
      learningRate: learningRate.value,
      loraRank: loraRank.value,
      baseModel: baseModel.value,
      isPublic: isPublic.value,
    });

    modelId.value = modelResponse.data.id;
    statusMessage.value = 'Creating training job...';

    // 3. Create training job
    const jobResponse = await api.training.createTrainingJob(modelId.value);
    trainingJobId.value = jobResponse.data.id;
    statusMessage.value = 'Starting training...';

    // 4. Start training with S3 URLs
    await api.training.startTraining(trainingJobId.value, {
      totalEpochs: epochs.value,
      modelName: title.value,
      trainingImageUrls: trainingImageUrls,
    });

    statusMessage.value = 'Training started...';

    // 5. Connect to SSE for progress
    connectToProgressStream();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to start training';
    isTraining.value = false;
  }
};

const connectToProgressStream = () => {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = api.training.streamTrainingProgress((data) => {
    if (data.status === 'TRAINING' || data.status === 'IN_PROGRESS') {
      currentEpoch.value = (data.currentEpoch as number) || 0;
      totalEpochs.value = (data.totalEpochs as number) || epochs.value;
      statusMessage.value = (data.phase as string) || 'Training...';
    } else if (data.status === 'COMPLETED') {
      isTraining.value = false;
      statusMessage.value = 'Training completed successfully!';
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      // Reload training history
      loadTrainingHistory();
    } else if (data.status === 'FAILED') {
      isTraining.value = false;
      error.value = (data.errorMessage as string) || 'Training failed';
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    }
  });
};

const cancelTraining = async () => {
  if (!trainingJobId.value) return;

  try {
    await api.training.deleteTrainingJob(trainingJobId.value);
    isTraining.value = false;
    statusMessage.value = 'Training cancelled';
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  } catch (err) {
    console.error('Failed to cancel training:', err);
  }
};

const deleteTrainingJob = async (id: number) => {
  try {
    await api.training.deleteTrainingJob(id);
    trainingHistory.value = trainingHistory.value.filter(t => t.id !== id);
  } catch (err) {
    console.error('Failed to delete training:', err);
  }
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'IN_PROGRESS':
    case 'TRAINING':
      return 'in-progress';
    case 'FAILED':
      return 'failed';
    default:
      return 'default';
  }
};

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<template>
  <div>
    <header class="hero-section">
      <div class="animation-container">
        <div class="petal-container">
          <div v-for="i in 30" :key="i" :class="`petal petal-${i}`"></div>
        </div>
        <div class="shape shape1"></div>
        <div class="shape shape2"></div>
        <div class="shape shape3"></div>
      </div>
      <h1 class="hero-title">
        Craft Your AI Masterpiece
      </h1>
      <p class="hero-subtitle">
        Bring your vision to life by training a custom LoRA model. <br />
        Just upload your images, and we'll handle the rest.
      </p>
    </header>

    <div class="container">
      <!-- Main Content -->
      <div class="training-container">
        <!-- Training Configuration -->
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
                    <input v-model="title" type="text" class="input" placeholder="My Custom LoRA Model" :disabled="isTraining" />
                  </div>
                  <div class="form-group">
                    <label class="label">Description</label>
                    <textarea v-model="description" class="textarea" rows="3" placeholder="Describe your model..." :disabled="isTraining"></textarea>
                  </div>
                  <div class="grid grid-cols-2 gap-md">
                    <div class="form-group">
                      <label class="label">Character Name</label>
                      <input v-model="characterName" type="text" class="input" placeholder="e.g., Hatsune Miku" :disabled="isTraining" />
                    </div>
                    <div class="form-group">
                      <label class="label">Style</label>
                      <input v-model="style" type="text" class="input" placeholder="e.g., Anime, Illustration" :disabled="isTraining" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Section 2: Training Images -->
              <div class="accordion-item">
                <div class="accordion-header" @click="toggleSection('training-images')">
                  <div class="flex items-center gap-md">
                    <Images :size="24" class="text-primary" />
                    <h3 class="text-xl font-semibold">Training Images</h3>
                  </div>
                  <ChevronDown :class="['accordion-chevron', { 'rotated': openSections.includes('training-images') }]" />
                </div>
                <div v-if="openSections.includes('training-images')" class="accordion-content">
                  <div class="form-group">
                    <div class="upload-zone" :class="{ 'upload-zone-dragging': isDragging }" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop" @click="() => fileInput?.click()">
                      <input ref="fileInput" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" style="display: none;" :disabled="isTraining" @change="handleFileSelect" />
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      <p class="upload-text">클릭하거나 이미지를 드래그하여 업로드</p>
                      <p class="upload-hint">JPG, JPEG, PNG, WEBP (최대 10MB)</p>
                    </div>
                    <div v-if="uploadError" class="upload-error mt-sm">{{ uploadError }}</div>
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
                    <h3 class="text-xl font-semibold">Hyperparameters</h3>
                  </div>
                  <ChevronDown :class="['accordion-chevron', { 'rotated': openSections.includes('hyperparameters') }]" />
                </div>
                <div v-if="openSections.includes('hyperparameters')" class="accordion-content">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
                        <div class="form-group">
                            <label class="label justify-between">
                            <span>Learning Rate</span>
                            <span class="font-mono text-sm">{{ learningRate }}</span>
                            </label>
                            <input v-model.number="learningRate" type="range" min="0.00001" max="0.001" step="0.00001" class="slider" :disabled="isTraining" />
                        </div>
                        <div class="form-group">
                            <label class="label justify-between">
                            <span>Epochs</span>
                            <span class="font-mono text-sm">{{ epochs }}</span>
                            </label>
                            <input v-model.number="epochs" type="range" min="5" max="50" class="slider" :disabled="isTraining" />
                        </div>
                        <div class="form-group">
                            <label class="label">LoRA Rank</label>
                            <select v-model.number="loraRank" class="input" :disabled="isTraining">
                            <option :value="4">4</option>
                            <option :value="8">8</option>
                            <option :value="16">16</option>
                            <option :value="32">32</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="label">Base Model</label>
                            <select v-model="baseModel" class="input" :disabled="isTraining">
                            <option value="stablediffusionapi/anything-v5">Anything V5</option>
                            <option value="runwayml/stable-diffusion-v1-5">SD 1.5</option>
                            <option value="stabilityai/stable-diffusion-2-1">SD 2.1</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="label">Public</label>
                            <select v-model="isPublic" class="input" :disabled="isTraining">
                            <option :value="false">Private</option>
                            <option :value="true">Public</option>
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
            <div v-if="error" class="card mt-md p-md bg-error/10 border border-error/30">
              <p class="text-error text-sm">{{ error }}</p>
            </div>

            <!-- Progress -->
            <div v-if="isTraining" class="mt-lg">
              <div class="flex justify-between mb-sm">
                <span class="text-sm text-secondary">{{ statusMessage }}</span>
                <span class="text-sm font-semibold">Epoch {{ currentEpoch }} / {{ totalEpochs }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${(currentEpoch / totalEpochs) * 100}%` }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Training History -->
        <div class="history-section">
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
                    <div v-for="training in trainingHistory" :key="training.id" class="history-item card-sm">
                        <div class="status-icon" :class="getStatusClass(training.status)">
                            <svg v-if="training.status === 'COMPLETED'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            <svg v-else-if="training.status === 'IN_PROGRESS' || training.status === 'TRAINING'" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <h3 class="font-semibold text-lg">Training Job #{{ training.id }}</h3>
                                <span class="badge" :class="getStatusClass(training.status)">{{ training.status }}</span>
                            </div>
                            <p class="text-sm text-secondary mb-sm">Model ID: {{ training.modelId }}</p>
                            <div class="grid grid-cols-2 gap-x-md gap-y-sm text-sm">
                                <div><span class="text-muted">Progress:</span> <span class="ml-xs">{{ training.currentEpoch }} / {{ training.totalEpochs }}</span></div>
                                <div><span class="text-muted">Phase:</span> <span class="ml-xs">{{ training.phase || 'N/A' }}</span></div>
                                <div v-if="training.startedAt"><span class="text-muted">Started:</span> <span class="ml-xs">{{ new Date(training.startedAt).toLocaleString() }}</span></div>
                                <div v-if="training.completedAt"><span class="text-muted">Completed:</span> <span class="ml-xs">{{ new Date(training.completedAt).toLocaleString() }}</span></div>
                            </div>
                            <div v-if="training.errorMessage" class="text-sm text-error mt-sm">Error: {{ training.errorMessage }}</div>
                        </div>
                        <div class="flex flex-col gap-sm ml-md">
                            <router-link v-if="training.status === 'COMPLETED'" :to="`/models/${training.modelId}`" class="btn btn-secondary btn-sm">View Model</router-link>
                            <button v-if="training.status === 'FAILED' || training.status === 'COMPLETED'" class="btn btn-ghost btn-sm" @click="deleteTrainingJob(training.id)">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hero Section Styles from ModelList.vue */
.hero-section {
  text-align: center;
  padding: 10rem 1rem 8rem;
  position: relative;
  overflow: hidden;
  background: var(--bg-dark);
}

.config-section > .card,
.history-section > .card {
  background-color: var(--bg-dark);
  border: none;
  box-shadow: none;
}

.animation-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.petal-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.petal {
  position: absolute;
  background: rgba(173, 216, 230, 0.7); /* Light blue */
  border-radius: 150% 0 150% 0;
  top: -10%;
  opacity: 0;
  animation: fall 10s linear infinite;
}

.petal-1 { left: 10%; animation-delay: 0s; width: 15px; height: 20px; animation-duration: 12s; }
.petal-2 { left: 20%; animation-delay: 5s; width: 20px; height: 25px; animation-duration: 15s; }
.petal-3 { left: 30%; animation-delay: 2s; width: 12px; height: 18px; animation-duration: 10s; }
.petal-4 { left: 40%; animation-delay: 8s; width: 18px; height: 22px; animation-duration: 18s; }
.petal-5 { left: 50%; animation-delay: 1s; width: 22px; height: 28px; animation-duration: 13s; }
.petal-6 { left: 60%; animation-delay: 6s; width: 16px; height: 20px; animation-duration: 11s; }
.petal-7 { left: 70%; animation-delay: 3s; width: 14px; height: 19px; animation-duration: 14s; }
.petal-8 { left: 80%; animation-delay: 9s; width: 19px; height: 24px; animation-duration: 16s; }
.petal-9 { left: 90%; animation-delay: 4s; width: 17px; height: 21px; animation-duration: 12s; }
.petal-10 { left: 5%; animation-delay: 7s; width: 13px; height: 18px; animation-duration: 17s; }
.petal-11 { left: 15%; animation-delay: 2.5s; width: 18px; height: 23px; animation-name: fall2; animation-duration: 20s; }
.petal-12 { left: 25%; animation-delay: 6.5s; width: 15px; height: 20px; animation-name: fall3; animation-duration: 13s; }
.petal-13 { left: 35%; animation-delay: 1.5s; width: 20px; height: 25px; animation-name: fall2; animation-duration: 18s; }
.petal-14 { left: 45%; animation-delay: 5.5s; width: 12px; height: 17px; animation-name: fall3; animation-duration: 11s; }
.petal-15 { left: 55%; animation-delay: 0.5s; width: 16px; height: 22px; animation-name: fall2; animation-duration: 14s; }
.petal-16 { left: 65%; animation-delay: 8.5s; width: 14px; height: 18px; animation-duration: 19s; background-color: rgba(135, 206, 250, 0.7); }
.petal-17 { left: 75%; animation-delay: 3.5s; width: 18px; height: 24px; animation-duration: 16s; }
.petal-18 { left: 85%; animation-delay: 1.2s; width: 20px; height: 26px; animation-name: fall3; animation-duration: 12s; background-color: rgba(135, 206, 250, 0.7); }
.petal-19 { left: 95%; animation-delay: 4.5s; width: 15px; height: 20px; animation-duration: 15s; }
.petal-20 { left: 2%; animation-delay: 9.5s; width: 12px; height: 16px; animation-name: fall2; animation-duration: 18s; }
.petal-21 { left: 12%; animation-delay: 0.2s; width: 18px; height: 24px; animation-duration: 13s; background-color: rgba(135, 206, 250, 0.7); }
.petal-22 { left: 22%; animation-delay: 5.2s; width: 16px; height: 21px; animation-duration: 17s; }
.petal-23 { left: 32%; animation-delay: 2.8s; width: 14px; height: 18px; animation-name: fall3; animation-duration: 11s; }
.petal-24 { left: 42%; animation-delay: 7.8s; width: 20px; height: 26px; animation-duration: 19s; }
.petal-25 { left: 52%; animation-delay: 1.8s; width: 15px; height: 20px; animation-name: fall2; animation-duration: 12s; background-color: rgba(135, 206, 250, 0.7); }
.petal-26 { left: 62%; animation-delay: 6.8s; width: 22px; height: 28px; animation-duration: 16s; }
.petal-27 { left: 72%; animation-delay: 3.8s; width: 17px; height: 22px; animation-duration: 13s; }
.petal-28 { left: 82%; animation-delay: 8.8s; width: 13px; height: 19px; animation-name: fall3; animation-duration: 15s; }
.petal-29 { left: 92%; animation-delay: 4.8s; width: 19px; height: 25px; animation-duration: 17s; background-color: rgba(135, 206, 250, 0.7); }
.petal-30 { left: 98%; animation-delay: 2.2s; width: 15px; height: 20px; animation-name: fall2; animation-duration: 14s; }


@keyframes fall {
  0% { top: -10%; opacity: 0; transform: translateX(0) rotate(0deg); }
  10% { opacity: 1; }
  100% { top: 110%; opacity: 1; transform: translateX(50px) rotate(270deg); }
}

@keyframes fall2 {
  0% { top: -10%; opacity: 0; transform: translateX(0) rotate(0deg); }
  20% { opacity: 1; }
  100% { top: 110%; opacity: 1; transform: translateX(-80px) rotate(360deg); }
}

@keyframes fall3 {
  0% { top: -10%; opacity: 0; transform: translateX(0) rotate(0deg); }
  15% { opacity: 1; }
  100% { top: 110%; opacity: 1; transform: translateX(100px) rotate(180deg); }
}


.shape {
  position: absolute;
  mix-blend-mode: screen;
  filter: blur(120px);
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

.shape1 {
  width: 500px;
  height: 500px;
  background: rgba(0, 71, 171, 0.25);
  top: -150px;
  left: -150px;
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  animation-name: move1, pulse-glow;
  animation-duration: 25s, 8s;
}

.shape2 {
  width: 400px;
  height: 400px;
  background: rgba(0, 207, 255, 0.2);
  bottom: -100px;
  right: -100px;
  border-radius: 60% 40% 30% 70% / 50% 60% 40% 50%;
  animation-name: move2, pulse-glow;
  animation-duration: 30s, 10s;
  animation-direction: alternate-reverse, alternate;
}

.shape3 {
  width: 350px;
  height: 350px;
  background: rgba(79, 70, 229, 0.2);
  bottom: 50px;
  left: 15%;
  border-radius: 50% 50% 30% 70% / 60% 40% 60% 40%;
  animation-name: move3, pulse-glow;
  animation-duration: 20s, 9s;
}

@keyframes move1 {
  from { transform: translate(0, 0) rotate(0deg) scale(1); }
  to { transform: translate(100px, 50px) rotate(45deg) scale(1.1); }
}
@keyframes move2 {
  from { transform: translate(0, 0) rotate(0deg) scale(1); }
  to { transform: translate(-80px, -40px) rotate(-30deg) scale(1.2); }
}
@keyframes move3 {
  from { transform: translate(0, 0) rotate(0deg) scale(1); }
  to { transform: translate(50px, -100px) rotate(60deg) scale(1.1); }
}
@keyframes pulse-glow {
  0% { opacity: 0.5; }
  50% { opacity: 0.8; }
  100% { opacity: 0.5; }
}

.hero-title, .hero-subtitle, .hero-actions {
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: 4.5rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  max-width: 42rem;
  margin: 0 auto 2.5rem;
  line-height: 1.6;
}

.training-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-xl);
  max-width: 800px;
  margin: -50px auto 0;
  position: relative;
  z-index: 2;
}


.config-section,
.history-section {
  height: fit-content;
}

.history-section {
  margin-top: var(--space-xl);
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
  background: var(--text-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.badge {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.badge.completed {
  background-color: #10b981;
  color: white;
}
.badge.in-progress {
  background-color: #3b82f6;
  color: white;
}
.badge.failed {
  background-color: #ef4444;
  color: white;
}
.badge.default {
  background-color: var(--bg-hover);
}

/* Image Upload Styles */
.upload-zone {
  border: 2px dashed var(--text-muted);
  border-radius: var(--radius-md);
  padding: var(--space-xl);
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-secondary);
}

.upload-zone:hover {
  border-color: var(--text-secondary);
  background: var(--bg-hover);
}

.upload-zone-dragging {
  border-color: var(--text-primary);
  background: var(--bg-hover);
}

.upload-icon {
  margin: 0 auto var(--space-md);
  color: var(--text-secondary);
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

.upload-error {
  color: #ef4444;
  font-size: 14px;
  padding: var(--space-sm);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
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
  background: var(--bg-secondary);
  border: 1px solid var(--text-muted);
  transition: all 0.3s ease;
}

.image-preview-item:hover {
  border-color: var(--text-secondary);
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
  background: var(--bg-primary);
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
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  transition: background-color 0.2s, border-color 0.2s;
}
.history-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--primary);
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
.status-icon.completed {
    background-color: rgba(16, 185, 129, 0.1);
    color: #10b981;
}
.status-icon.in-progress {
    background-color: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
}
.status-icon.failed {
    background-color: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}
.status-icon.default {
    background-color: var(--bg-hover);
    color: var(--text-muted);
}


/* Accordion Styles */
.accordion {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
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
  background-color: var(--bg-secondary);
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
  background-color: var(--bg-primary);
  border-top: 1px solid var(--border);
}

.label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-xs);
    font-size: 0.9rem;
    color: var(--text-secondary);
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

@media (max-width: 1024px) {
  .image-preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
</style>