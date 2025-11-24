<script setup lang="ts">
import ModelCard from '../models/ModelCard.vue';
import type { LoraModel } from '../../services/api';

interface Props {
  models: LoraModel[];
  loading?: boolean;
}

interface Emits {
  (e: 'openDetail', modelId: number): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const openModelDetail = (modelId: number) => {
  emit('openDetail', modelId);
};
</script>

<template>
  <div>
    <h2 class="text-2xl font-bold mb-lg">내 모델</h2>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center p-xl">
      <div class="loading"></div>
    </div>

    <!-- Models Grid -->
    <div v-else-if="models.length" class="grid grid-cols-4 gap-lg">
      <div
        v-for="model in models"
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

    <!-- Empty State -->
    <div v-else class="card text-center p-xl">
      <p class="text-secondary text-lg mb-md">You haven't created any models yet</p>
      <a href="/training" class="btn btn-primary">Create Your First Model</a>
    </div>
  </div>
</template>
