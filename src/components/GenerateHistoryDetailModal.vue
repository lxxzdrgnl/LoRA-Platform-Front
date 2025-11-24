<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '../services/api';

const props = defineProps<{
  show: boolean;
  historyId: number | null;
}>();

const emit = defineEmits(['close', 'deleted']);

const loading = ref(true);
const error = ref('');
const history = ref<any>(null);

watch(() => props.historyId, async (newId) => {
  if (newId) {
    await fetchHistoryDetails(newId);
  }
});

const fetchHistoryDetails = async (id: number) => {
  try {
    loading.value = true;
    const response = await api.generate.getHistoryDetail(id);
    history.value = response.data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load history details.';
  } finally {
    loading.value = false;
  }
};

const deleteHistory = async () => {
  if (!props.historyId || !confirm('Are you sure you want to delete this generation record? This action cannot be undone.')) return;
  try {
    await api.generate.deleteHistory(props.historyId);
    emit('deleted', props.historyId);
  } catch (err) {
    console.error('Failed to delete history:', err);
    alert('Failed to delete history. Please try again.');
  }
};

const closeModal = () => {
  emit('close');
  // Reset state when closing
  history.value = null;
  error.value = '';
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        // Optional: show a small toast or confirmation message
    });
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-lg" @click="closeModal">
    <div class="card w-full max-w-4xl max-h-[90vh] flex flex-col" @click.stop>
      <button @click="closeModal" class="absolute -top-4 -right-4 btn btn-icon btn-secondary rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="overflow-auto hide-scrollbar p-sm">
        <div v-if="loading" class="flex justify-center p-xl">
            <div class="loading"></div>
        </div>
        <div v-else-if="error" class="text-center p-xl text-error">{{ error }}</div>
        <div v-else-if="history" class="grid grid-cols-1 md:grid-cols-5 gap-xl">
            <!-- Left Column: Images -->
            <div class="md:col-span-3 grid grid-cols-2 gap-md">
                 <div v-for="image in history.generatedImages" :key="image.id" class="aspect-square bg-card rounded-lg overflow-hidden relative group">
                    <img :src="image.s3Url" alt="Generated image" class="img-cover"/>
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <a :href="image.s3Url" download class="btn btn-primary btn-sm" @click.stop>
                            Download
                        </a>
                    </div>
                 </div>
            </div>

            <!-- Right Column: Details -->
            <div class="md:col-span-2 flex flex-col">
                <h2 class="text-2xl font-bold mb-md">{{ history.modelTitle }}</h2>

                <div class="mb-lg">
                    <h3 class="label">Status</h3>
                    <p class="badge" :class="{
                        'badge-success': history.status === 'SUCCESS',
                        'badge-error': history.status === 'FAILED',
                        'badge-warning': ['PENDING', 'GENERATING'].includes(history.status)
                    }">{{ history.status }}</p>
                </div>

                <div class="mb-lg">
                    <label class="label">Positive Prompt</label>
                    <div class="bg-card border border-border rounded-md p-md flex justify-between items-start gap-sm">
                        <p class="text-sm text-secondary flex-1 break-all">{{ history.prompt }}</p>
                        <button class="btn btn-ghost btn-sm" @click="copyToClipboard(history.prompt)">Copy</button>
                    </div>
                </div>

                <div class="mb-lg">
                    <label class="label">Negative Prompt</label>
                    <div class="bg-card border border-border rounded-md p-md flex justify-between items-start gap-sm">
                        <p class="text-sm text-secondary flex-1 break-all">{{ history.negativePrompt }}</p>
                        <button class="btn btn-ghost btn-sm" @click="copyToClipboard(history.negativePrompt)">Copy</button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-md">
                    <div class="mb-lg">
                        <label class="label">Steps</label>
                        <p class="font-medium text-primary">{{ history.steps }}</p>
                    </div>
                    <div class="mb-lg">
                        <label class="label">Guidance Scale</label>
                        <p class="font-medium text-primary">{{ history.guidanceScale }}</p>
                    </div>
                     <div class="mb-lg">
                        <label class="label">Seed</label>
                        <p class="font-medium text-primary">{{ history.seed }}</p>
                    </div>
                </div>

                <div class="mt-auto pt-lg">
                    <button class="btn w-full bg-red-500/10 text-error hover:bg-red-500/20" @click="deleteHistory">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Delete Generation
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.break-all {
    word-break: break-all;
}
.hover\:bg-red-500\/20:hover {
    background-color: rgba(239, 68, 68, 0.2);
}
</style>
