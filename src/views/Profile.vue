<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ModelCard from '../components/ModelCard.vue';
import ModelDetailModal from '../components/ModelDetailModal.vue';
import GenerateHistoryDetailModal from '../components/GenerateHistoryDetailModal.vue';
import { api, authStore, type UserResponse, type LoraModel } from '../services/api';

const router = useRouter();
const route = useRoute();

const user = ref<UserResponse | null>(null);
const isEditing = ref(false);
const editForm = ref({
  nickname: '',
  profileImageUrl: '',
});

const showDetailModal = ref(false);
const selectedModelId = ref<number | null>(null);

const showHistoryDetailModal = ref(false);
const selectedHistoryId = ref<number | null>(null);

const openModelDetail = (modelId: number) => {
  selectedModelId.value = modelId;
  showDetailModal.value = true;
};

const closeModelDetail = () => {
  showDetailModal.value = false;
  selectedModelId.value = null;
};

const openHistoryDetailModal = (historyId: number) => {
  selectedHistoryId.value = historyId;
  showHistoryDetailModal.value = true;
};

const closeHistoryDetailModal = () => {
  showHistoryDetailModal.value = false;
  selectedHistoryId.value = null;
};

const handleHistoryDeleted = (historyId: number) => {
  generationHistory.value = generationHistory.value.filter(h => h.id !== historyId);
  closeHistoryDetailModal();
};

const refreshAllModels = () => {
  loadMyModels();
  loadLikedModels();
};

// Set initial tab based on route
const getInitialTab = () => {
  if (route.path === '/my-models') return 'models';
  if (route.path === '/favorites') return 'favorites';
  if (route.path === '/generate-history') return 'history';
  return 'models'; // default to models for /profile or if no specific tab is set
};

const activeTab = ref<'models' | 'favorites' | 'history'>(getInitialTab());
const historySubTab = ref<'generate' | 'training'>('generate');
const loading = ref(true);
const myModels = ref<LoraModel[]>([]);
const likedModels = ref<LoraModel[]>([]);
const generationHistory = ref<any[]>([]);
const trainingHistory = ref<any[]>([]);

// Watch for route changes to update the active tab
watch(
  () => route.fullPath,
  () => {
    activeTab.value = getInitialTab();
  }
);

onMounted(async () => {
  // Check if user is logged in
  if (!authStore.isAuthenticated()) {
    router.push('/login');
    return;
  }

  await loadUserProfile();
  await loadMyModels();
  await loadLikedModels();
  await loadGenerationHistory();
  await loadTrainingHistory();
});

const loadUserProfile = async () => {
  try {
    const response = await api.user.getMyProfile();
    user.value = response.data;
    editForm.value = {
      nickname: user.value.nickname,
      profileImageUrl: user.value.profileImageUrl || '',
    };
  } catch (error) {
    console.error('Failed to load user profile:', error);
    // Token might be expired
    authStore.clearTokens();
    router.push('/login');
  }
};

const loadMyModels = async () => {
  try {
    const response = await api.models.getMyModels(0, 20);
    myModels.value = response.data.content;
  } catch (error) {
    console.error('Failed to load my models:', error);
  }
};

const loadLikedModels = async () => {
  try {
    const response = await api.community.getLikedModels(0, 20);
    likedModels.value = response.data.content;
  } catch (error) {
    console.error('Failed to load liked models:', error);
  } finally {
    loading.value = false;
  }
};

const loadGenerationHistory = async () => {
  try {
    const response = await api.generate.getHistoryList(0, 20);
    // Manually add thumbnailUrl for the template
    generationHistory.value = response.data.content.map(item => ({
      ...item,
      thumbnailUrl: item.generatedImages?.[0]?.s3Url
    }));
  } catch (error) {
    console.error('Failed to load generation history:', error);
  }
};

const downloadImage = async (event: Event, imageUrl: string, historyId: number) => {
  event.stopPropagation(); // Prevent modal from opening
  if (!imageUrl) {
    alert('No image available for download.');
    return;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Network response was not ok.');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `blueming_ai_history_${historyId}.png`;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
    alert(`Download failed: ${error}. This might be a CORS issue. Opening image in a new tab as a fallback.`);
    window.open(imageUrl, '_blank');
  }
};

const loadTrainingHistory = async () => {
  try {
    const response = await api.training.getMyTrainingJobs();
    trainingHistory.value = response.data;
  } catch (error) {
    console.error('Failed to load training history:', error);
  }
};

const startEdit = () => {
  isEditing.value = true;
};

const cancelEdit = () => {
  isEditing.value = false;
  if (user.value) {
    editForm.value = {
      nickname: user.value.nickname,
      profileImageUrl: user.value.profileImageUrl || '',
    };
  }
};

const saveProfile = async () => {
  // 닉네임 검증
  const trimmedNickname = editForm.value.nickname.trim();
  if (trimmedNickname.length < 2 || trimmedNickname.length > 10) {
    alert('닉네임은 2-10자 이내로 입력해주세요.');
    return;
  }

  try {
    const response = await api.user.updateMyProfile({
      nickname: trimmedNickname,
      profileImageUrl: editForm.value.profileImageUrl || undefined,
    });
    user.value = response.data;
    isEditing.value = false;

    // Dispatch custom event to update Navigation
    window.dispatchEvent(new CustomEvent('profile-updated', {
      detail: response.data
    }));
  } catch (error) {
    console.error('Failed to update profile:', error);
    alert('Failed to update profile. Please try again.');
  }
};
</script>

<template>
  <div class="container">
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center" style="min-height: 60vh;">
      <div class="loading"></div>
      <p class="text-lg text-secondary mt-lg">Loading profile...</p>
    </div>

    <!-- Profile Content -->
    <div v-else-if="user">
      <!-- Profile Header Card -->
      <div class="card mb-lg mt-lg">
        <div class="flex items-start gap-lg flex-col-mobile">
          <!-- Avatar -->
          <img
            :src="user.profileImageUrl || 'https://via.placeholder.com/120'"
            alt="Profile"
            class="profile-avatar rounded-full"
            style="border: 3px solid var(--border);"
          />

          <!-- User Info -->
          <div style="flex: 1;">
            <template v-if="!isEditing">
              <h1 class="text-3xl font-bold mb-sm">{{ user.nickname }}</h1>
              <p class="text-secondary mb-md">{{ user.email }}</p>
              <p class="text-sm text-muted mb-md">Member since {{ new Date(user.createdAt).toLocaleDateString() }}</p>

              <!-- Stats -->
              <div class="flex gap-lg">
                <div class="stat-item">
                  <span class="stat-value">{{ myModels.length }}</span>
                  <span class="stat-label">Models</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ likedModels.length }}</span>
                  <span class="stat-label">Favorites</span>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="form-group">
                <label class="label" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Nickname</span>
                  <span class="text-sm text-muted">{{ editForm.nickname.length }}/10</span>
                </label>
                <input v-model="editForm.nickname" type="text" class="input" maxlength="10" />
              </div>
              <div class="form-group">
                <label class="label">Profile Image URL</label>
                <input v-model="editForm.profileImageUrl" type="text" class="input" />
              </div>
            </template>
          </div>

          <!-- Actions -->
          <div class="flex gap-sm">
            <button v-if="!isEditing" class="btn btn-primary" @click="startEdit">
              Edit Profile
            </button>
            <template v-else>
              <button class="btn btn-secondary" @click="cancelEdit">Cancel</button>
              <button class="btn btn-primary" @click="saveProfile">Save</button>
            </template>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container mb-lg">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'models' }"
          @click="activeTab = 'models'"
        >
          My Models
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'favorites' }"
          @click="activeTab = 'favorites'"
        >
          Favorites
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          Generation History
        </button>
      </div>

      <!-- Tab Content -->
      <div>
        <!-- My Models Tab -->
        <div v-if="activeTab === 'models'">
          <h2 class="text-2xl font-bold mb-lg">내 모델</h2>
          <div v-if="myModels.length" class="grid grid-cols-4 gap-lg">
            <div
              v-for="model in myModels"
              :key="model.id"
              @click="openModelDetail(model.id)"
              class="cursor-pointer"
            >
              <ModelCard
                :id="model.id"
                :title="model.title"
                :description="model.description"
                :thumbnailUrl="model.thumbnailUrl"
                :userNickname="model.userNickname"
                :likeCount="model.likeCount"
                :viewCount="model.viewCount"
                :favoriteCount="model.favoriteCount"
              />
            </div>
          </div>
          <div v-else class="card text-center p-xl">
            <p class="text-secondary text-lg mb-md">You haven't created any models yet</p>
            <a href="/training" class="btn btn-primary">Create Your First Model</a>
          </div>
        </div>

        <!-- Favorites Tab -->
        <div v-if="activeTab === 'favorites'">
          <!-- Liked Models Section -->
          <div v-if="likedModels.length > 0" class="mb-xl">
            <h2 class="text-2xl font-bold mb-lg">좋아요한 모델</h2>
            <div class="grid grid-cols-4 gap-lg">
              <div
                v-for="model in likedModels"
                :key="model.id"
                @click="openModelDetail(model.id)"
                class="cursor-pointer"
              >
                <ModelCard
                  :id="model.id"
                  :title="model.title"
                  :description="model.description"
                  :thumbnailUrl="model.thumbnailUrl"
                  :userNickname="model.userNickname"
                  :likeCount="model.likeCount"
                  :viewCount="model.viewCount"
                  :favoriteCount="model.favoriteCount"
                />
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="likedModels.length === 0" class="card text-center p-xl">
            <p class="text-secondary text-lg">좋아요한 모델이 없습니다</p>
          </div>
        </div>

        <!-- History Tab -->
        <div v-if="activeTab === 'history'">
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
          <div v-if="historySubTab === 'generate'">
            <div v-if="generationHistory.length" class="grid grid-cols-4 gap-lg">
              <div v-for="item in generationHistory" :key="item.id" class="card card-clickable p-0 overflow-hidden">
                <div 
                  class="relative aspect-square w-full group bg-bg-hover"
                  @click="openHistoryDetailModal(item.id)"
                >
                  <!-- Image -->
                  <img
                    v-if="item.thumbnailUrl"
                    :src="item.thumbnailUrl"
                    alt="Generated"
                    class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-hover:brightness-75"
                    crossorigin="anonymous"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-muted">
                    <span>No Image</span>
                  </div>

                  <!-- Hover Overlay -->
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-md text-white">
                    <!-- Top Actions -->
                    <div class="flex justify-end gap-sm">
                       <button class="btn btn-secondary btn-sm" @click.stop="downloadImage($event, item.thumbnailUrl, item.id)">Download</button>
                       <button class="btn btn-primary btn-sm" @click.stop="openHistoryDetailModal(item.id)">Details</button>
                    </div>
                    <!-- Bottom Info -->
                    <div class="cursor-pointer" @click="openHistoryDetailModal(item.id)">
                      <h4 class="font-bold truncate">{{ item.modelTitle || 'Unknown Model' }}</h4>
                      <p class="text-sm line-clamp-2" style="color: #e0e0e0;">{{ item.prompt }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="card text-center p-xl">
              <p class="text-secondary text-lg">생성 기록이 없습니다</p>
            </div>
          </div>

          <!-- Training History -->
          <div v-if="historySubTab === 'training'">
            <div v-if="trainingHistory.length" class="grid grid-cols-1 gap-md">
              <div v-for="job in trainingHistory" :key="job.id" class="card p-lg">
                <div class="flex items-center justify-between mb-md">
                  <div>
                    <h3 class="text-lg font-bold">Training Job #{{ job.id }}</h3>
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
                <div v-if="job.status === 'FAILED' && job.errorMessage" class="p-sm rounded text-sm text-error" style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--error);">
                  {{ job.errorMessage }}
                </div>
              </div>
            </div>
            <div v-else class="card text-center p-xl">
              <p class="text-secondary text-lg">학습 기록이 없습니다</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ModelDetailModal 
    :show="showDetailModal" 
    :model-id="selectedModelId" 
    @close="closeModelDetail"
    @model-update="refreshAllModels" 
  />
  <GenerateHistoryDetailModal
    :show="showHistoryDetailModal"
    :history-id="selectedHistoryId"
    @close="closeHistoryDetailModal"
    @deleted="handleHistoryDeleted"
  />
</template>

<style scoped>
/* Profile-specific styles - using main.css utility classes where possible */
.profile-avatar {
  width: 120px;
  height: 120px;
}

.tabs-container {
  display: flex;
  gap: var(--space-sm);
  border-bottom: 2px solid var(--border);
}

.tab-btn {
  padding: var(--space-md) var(--space-lg);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--text-primary);
  border-bottom-color: var(--primary);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--text-muted);
}

/* History Sub-tabs */
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

/* Hover effect utility */
.hover\:translate-y-\[-4px\]:hover {
  transform: translateY(-4px);
}

.group:hover .group-hover\:brightness-75 {
  filter: brightness(0.75);
}

@media (max-width: 768px) {
  .tabs-container {
    overflow-x: auto;
  }

  .tab-btn {
    white-space: nowrap;
    padding: var(--space-md) var(--space-xs);
  }
}
</style>

