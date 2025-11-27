<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useProfile } from '../composables/useProfile';
import { useModels } from '../composables/useModels';
import { useHistory } from '../composables/useHistory';

import ProfileHeader from '../components/profile/ProfileHeader.vue';
import MyModelsTab from '../components/profile/MyModelsTab.vue';
import FavoritesTab from '../components/profile/FavoritesTab.vue';
import HistoryTab from '../components/profile/HistoryTab.vue';
import ModelDetailModal from '../components/models/ModelDetailModal.vue';
import GenerateHistoryDetailModal from '../components/generate/GenerateHistoryDetailModal.vue';
import GenerateModal from '../components/generate/GenerateModal.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Composables
const { user, loading: profileLoading, loadUserProfile, updateProfile } = useProfile();
const { myModels, likedModels, loading: modelsLoading, loadMyModels, loadLikedModels, refreshAllModels } = useModels();
const { generationHistory, trainingHistory, availableModels, loading: historyLoading, hasMore, loadGenerationHistory, loadMoreHistory, loadAvailableModels, loadTrainingHistory, deleteGenerationHistory, downloadImage } = useHistory();

// Modal state
const showDetailModal = ref(false);
const selectedModelId = ref<number | null>(null);
const showHistoryDetailModal = ref(false);
const selectedHistoryId = ref<number | null>(null);
const showGenerateModal = ref(false);

// Tab state
const getInitialTab = () => {
  if (route.path === '/my-models') return 'models';
  if (route.path === '/favorites') return 'favorites';
  if (route.path === '/generate-history') return 'history';
  return 'models';
};

const activeTab = ref<'models' | 'favorites' | 'history'>(getInitialTab());
const loading = ref(true);

// Watch for route changes
watch(
  () => route.fullPath,
  () => {
    activeTab.value = getInitialTab();
  }
);

// Lifecycle
onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login');
    return;
  }

  try {
    await Promise.all([
      loadUserProfile(),
      loadMyModels(),
      loadLikedModels(),
      loadGenerationHistory(0, 20),
      loadAvailableModels(),
      loadTrainingHistory(),
    ]);
  } catch (error) {
    console.error('Failed to load profile data:', error);
  } finally {
    loading.value = false;
  }
});

// Modal handlers
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
  deleteGenerationHistory(historyId);
  closeHistoryDetailModal();
};

const openGenerateModal = (modelId: number | null = null) => {
  selectedModelId.value = modelId;
  showGenerateModal.value = true;
};

const closeGenerateModal = () => {
  showGenerateModal.value = false;
  selectedModelId.value = null;
};

const handleOpenGenerate = (modelId: number) => {
  closeModelDetail();
  setTimeout(() => {
    openGenerateModal(modelId);
  }, 150);
};

// Profile update handler
const handleProfileUpdate = async (data: { nickname: string; profileImageUrl?: string }) => {
  await updateProfile(data);
};

// Download handler
const handleDownloadImage = async (event: Event, imageUrl: string, historyId: number) => {
  event.stopPropagation();
  await downloadImage(imageUrl, historyId);
};

// Filter change handler
const handleFilterChange = async (modelId: number | null) => {
  await loadGenerationHistory(0, 20, false, modelId ?? undefined);
};

// Load more handler with filter
const handleLoadMore = async (modelId: number | null) => {
  await loadMoreHistory(20, modelId ?? undefined);
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
      <!-- Profile Header -->
      <ProfileHeader
        :user="user"
        :my-models-count="myModels.length"
        :liked-models-count="likedModels.length"
        @update="handleProfileUpdate"
      />

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
        <MyModelsTab
          v-if="activeTab === 'models'"
          :models="myModels"
          :loading="modelsLoading"
          @open-detail="openModelDetail"
        />

        <!-- Favorites Tab -->
        <FavoritesTab
          v-if="activeTab === 'favorites'"
          :models="likedModels"
          :loading="modelsLoading"
          @open-detail="openModelDetail"
        />

        <!-- History Tab -->
        <HistoryTab
          v-if="activeTab === 'history'"
          :generation-history="generationHistory"
          :training-history="trainingHistory"
          :available-models="availableModels"
          :loading="historyLoading"
          :has-more="hasMore"
          @open-generation-detail="openHistoryDetailModal"
          @download-image="handleDownloadImage"
          @load-more="handleLoadMore"
          @filter-change="handleFilterChange"
        />
      </div>
    </div>
  </div>

  <!-- Modals -->
  <ModelDetailModal
    :show="showDetailModal"
    :model-id="selectedModelId"
    @close="closeModelDetail"
    @model-update="refreshAllModels"
    @open-generate="handleOpenGenerate"
  />
  <GenerateHistoryDetailModal
    :show="showHistoryDetailModal"
    :history-id="selectedHistoryId"
    @close="closeHistoryDetailModal"
    @deleted="handleHistoryDeleted"
  />
  <GenerateModal :show="showGenerateModal" :initial-model-id="selectedModelId" @close="closeGenerateModal" />
</template>

<style scoped>
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
