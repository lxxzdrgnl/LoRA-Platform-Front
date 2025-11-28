<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import type { GenerationHistoryResponse, AvailableModelResponse } from '../../services/api';

interface Props {
  history: GenerationHistoryResponse[];
  availableModels: AvailableModelResponse[];
  loading?: boolean;
  hasMore?: boolean;
}

interface Emits {
  (e: 'openDetail', historyId: number): void;
  (e: 'download', event: Event, imageUrl: string, historyId: number): void;
  (e: 'loadMore'): void;
  (e: 'filterChange', modelId: number | null): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedModelId = ref<number | null>(null);
const loadMoreTrigger = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

// Emit filter change when selectedModelId changes
watch(selectedModelId, (newModelId) => {
  emit('filterChange', newModelId);
});

// Setup Intersection Observer for infinite scroll
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting && props.hasMore && !props.loading) {
        console.log('🔄 Infinite scroll triggered - loading more');
        loadMore();
      }
    },
    {
      rootMargin: '200px', // Start loading 200px before reaching the trigger
      threshold: 0.1
    }
  );

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value);
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});

const openHistoryDetailModal = (historyId: number) => {
  emit('openDetail', historyId);
};

const downloadImage = (event: Event, imageUrl: string, historyId: number) => {
  emit('download', event, imageUrl, historyId);
};

const loadMore = () => {
  emit('loadMore');
};
</script>

<template>
  <div>
    <!-- Model Filter -->
    <div v-if="availableModels.length > 0" class="filter-container mb-lg">
      <label class="filter-label">모델 필터:</label>
      <select v-model="selectedModelId" class="filter-select">
        <option :value="null">전체 모델</option>
        <option v-for="model in availableModels" :key="model.id" :value="model.id">
          {{ model.title }}
        </option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading && history.length === 0" class="flex justify-center p-xl">
      <div class="loading"></div>
    </div>

    <!-- History Grid -->
    <div v-else-if="history.length" class="grid grid-cols-4 gap-lg">
      <div v-for="item in history" :key="item.id" class="history-card card card-clickable">
        <div
          class="history-thumbnail relative w-full group rounded-lg"
          @click="openHistoryDetailModal(item.id)"
        >
          <!-- Image -->
          <img
            v-if="item.generatedImages?.[0]?.s3Url"
            :src="item.generatedImages[0].s3Url"
            alt="Generated"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-muted">
            <span>No Image</span>
          </div>

          <!-- Hover Overlay -->
          <div class="history-overlay">
            <!-- Top Actions -->
            <div class="flex justify-end gap-sm">
              <button
                v-if="item.generatedImages?.[0]?.s3Url"
                class="btn btn-secondary btn-sm"
                @click.stop="downloadImage($event, item.generatedImages[0].s3Url, item.id)"
              >
                Download
              </button>
              <button
                class="btn btn-primary btn-sm"
                @click.stop="openHistoryDetailModal(item.id)"
              >
                Details
              </button>
            </div>
            <!-- Bottom Info -->
            <div class="cursor-pointer" @click="openHistoryDetailModal(item.id)">
              <h4 class="font-bold truncate">{{ item.modelTitle || 'Unknown Model' }}</h4>
              <p class="text-sm line-clamp-2 prompt-text">{{ item.prompt }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Infinite Scroll Trigger -->
    <div ref="loadMoreTrigger" class="load-more-trigger"></div>

    <!-- Loading More State -->
    <div v-if="loading && history.length > 0" class="flex justify-center p-lg">
      <div class="loading"></div>
      <p class="text-sm text-secondary ml-md">더 많은 항목을 불러오는 중...</p>
    </div>

    <!-- End of List Message -->
    <div v-if="!hasMore && history.length > 0" class="end-message">
      <p class="text-sm text-secondary">모든 항목을 불러왔습니다</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="history.length === 0 && !loading" class="card text-center p-xl">
      <p class="text-secondary text-lg">
        {{ selectedModelId ? '선택한 모델의 생성 기록이 없습니다' : '생성 기록이 없습니다' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.filter-container {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.filter-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.filter-select {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
}

.filter-select:hover {
  border-color: var(--primary);
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
}

.load-more-trigger {
  height: 1px;
  width: 100%;
  margin-top: var(--space-lg);
}

.end-message {
  text-align: center;
  margin-top: var(--space-lg);
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  color: var(--text-secondary);
}

.info-message {
  text-align: center;
  margin-top: var(--space-lg);
  padding: var(--space-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.history-card {
  overflow: hidden;
  padding: 0; /* Override default card padding */
  border-radius: var(--radius-lg); /* Ensure card has rounding */
}

.history-thumbnail {
  /* This div already has relative, w-full, group, rounded-lg from template */
  /* Ensure overflow hidden for image corners */
  overflow: hidden;
  width: 100%;
  background: transparent;
  aspect-ratio: 1; /* Default to square, like ModelCard */
  height: auto;
}

.history-thumbnail > div:not(.history-overlay) {
  width: 100%;
  height: 100%;
  background: var(--bg-hover);
}

/* Image transitions */
.history-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center !important;
  transition: transform 0.3s ease;
}

.history-card:hover .history-thumbnail img {
  transform: scale(1.05);
}

/* Overlay styling */
.history-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-sm);
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(0, 0, 0, 0.8) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  color: white;
  z-index: 2;
}

.history-card:hover .history-overlay {
  opacity: 1;
}

.prompt-text {
  color: #e0e0e0; /* A whitish-gray, matching ModelCard */
}

/* Prevent long-press context menu on mobile */
.history-thumbnail img {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Mobile responsiveness */
@media (max-width: 1024px) {
  .grid-cols-4 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 767px) {
  .history-thumbnail {
    aspect-ratio: 419 / 330;
  }
  .grid-cols-4 {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
  }
}

@media (max-width: 480px) {
  .grid-cols-4 {
    grid-template-columns: 1fr;
  }
}

/* Mobile: Make overlay appear on tap and make buttons touch-friendly */
@media (hover: none) and (pointer: coarse) {
  /* Show overlay when card is tapped */
  .history-card:active .history-overlay {
    opacity: 0.9;
  }

  /* Make buttons more touch-friendly */
  .btn-sm {
    min-height: 44px;
    padding: var(--space-sm) var(--space-md);
  }
}
</style>
