<script setup lang="ts">
import type { GenerationHistoryResponse } from '../../services/api';

interface Props {
  history: GenerationHistoryResponse[];
  loading?: boolean;
}

interface Emits {
  (e: 'openDetail', historyId: number): void;
  (e: 'download', event: Event, imageUrl: string, historyId: number): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const openHistoryDetailModal = (historyId: number) => {
  emit('openDetail', historyId);
};

const downloadImage = (event: Event, imageUrl: string, historyId: number) => {
  emit('download', event, imageUrl, historyId);
};
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center p-xl">
      <div class="loading"></div>
    </div>

    <!-- History Grid -->
    <div v-else-if="history.length" class="grid grid-cols-4 gap-lg">
      <div v-for="item in history" :key="item.id" class="card card-clickable p-0 overflow-hidden">
        <div
          class="relative aspect-square w-full group rounded-lg"
          @click="openHistoryDetailModal(item.id)"
        >
          <!-- Image -->
          <img
            v-if="item.generatedImages?.[0]?.s3Url"
            :src="item.generatedImages[0].s3Url"
            alt="Generated"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-hover:brightness-75"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-muted">
            <span>No Image</span>
          </div>

          <!-- Hover Overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-md text-white">
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
              <p class="text-sm line-clamp-2 text-secondary">{{ item.prompt }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="card text-center p-xl">
      <p class="text-secondary text-lg">생성 기록이 없습니다</p>
    </div>
  </div>
</template>
