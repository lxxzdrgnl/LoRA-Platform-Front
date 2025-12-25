<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import JSZip from 'jszip';
import { api } from '../../services/api';

const props = defineProps<{
  show: boolean;
  historyId: number | null;
}>();

const emit = defineEmits(['close', 'deleted']);

const loading = ref(true);
const error = ref('');
const history = ref<any>(null);
const isZipping = ref(false);

// SSE 관련
let eventSource: EventSource | null = null;
const currentStep = ref(0);
const totalSteps = ref(0);
const statusMessage = ref('');

// 모달이 열릴 때/닫힐 때 처리
watch(() => props.show, (newVal) => {
  if (!newVal) {
    // 모달이 닫힐 때 SSE 종료
    disconnectSSE();
  }
});

watch(() => props.historyId, async (newId) => {
  if (newId) {
    // SSE 먼저 종료
    disconnectSSE();

    // 히스토리 상세 가져오기
    await fetchHistoryDetails(newId);

    // 진행 중이면 SSE 연결
    if (history.value && ['PENDING', 'GENERATING'].includes(history.value.status)) {
      connectSSE(newId);
    }
  }
});

const fetchHistoryDetails = async (id: number) => {
  try {
    loading.value = true;
    error.value = '';
    const response = await api.generate.getHistoryDetail(id);
    history.value = response.data;

    // 진행률 초기화
    if (history.value.status === 'GENERATING') {
      currentStep.value = history.value.currentStep || 0;
      totalSteps.value = history.value.totalSteps || 0;
      statusMessage.value = history.value.currentStep
        ? `Generating... (${history.value.currentStep}/${history.value.totalSteps})`
        : '모델 불러오는 중...';
    }
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
  history.value = null; // Reset on close
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Maybe show a toast message here
}

const downloadImage = async (imageUrl: string, historyId: number, imageId: number) => {
  try {
    const freshUrl = `${imageUrl}?time=${new Date().getTime()}`;
    const response = await fetch(freshUrl, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) throw new Error('Network response was not ok.');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blueming_ai_history_${historyId}_${imageId}.png`;
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

const downloadAllAsZip = async () => {
    if (!history.value || !history.value.generatedImages || history.value.generatedImages.length === 0) return;

    isZipping.value = true;
    try {
        const zip = new JSZip();

        const imagePromises = history.value.generatedImages.map(async (image: any, index: number) => {
            const freshUrl = `${image.s3Url}?time=${new Date().getTime()}`;
            const response = await fetch(freshUrl, {
                method: 'GET',
                mode: 'cors',
            });

            if (!response.ok) {
                console.error(`Failed to fetch image ${index + 1}`);
                return;
            }
            const blob = await response.blob();
            zip.file(`image_${index + 1}.png`, blob);
        });

        await Promise.all(imagePromises);

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `blueming_ai_history_${history.value.id}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error('Failed to create zip file:', error);
        alert(`Failed to create zip file: ${error}. This could be a CORS issue.`);
    } finally {
        isZipping.value = false;
    }
};

// SSE 연결
const connectSSE = (historyId: number) => {
  if (eventSource) {
    eventSource.close();
  }

  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://blueming-ai-env-1-env.eba-fdwcr2jd.ap-northeast-2.elasticbeanstalk.com').trim().replace(/\/+$/, '');

  // JWT 토큰을 URL 파라미터로 추가
  const token = localStorage.getItem('accessToken');
  const sseUrl = token
    ? `${apiBase}/api/generate/stream?token=${encodeURIComponent(token)}`
    : `${apiBase}/api/generate/stream`;

  console.log(`🔌 SSE 연결 시도 (History Detail): historyId=${historyId}`);

  try {
    eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onopen = () => {
      console.log('✅ SSE 연결 성공 (History Detail)');
    };

    // 연결 성공 이벤트
    eventSource.addEventListener('connected', (event) => {
      console.log('✅ SSE connection confirmed (History Detail):', event.data);
    });

    // 이미지 생성 진행률 이벤트
    eventSource.addEventListener('generation_progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📦 SSE 진행률 (History Detail):', data);

        // historyId 필터링 (내 작업만 처리)
        if (data.historyId !== historyId) {
          console.log('⏭️ 다른 작업의 이벤트 무시:', data.historyId);
          return;
        }

        if (data.status === 'SUCCESS') {
          console.log('✅ 생성 완료! (History Detail)', data);
          statusMessage.value = 'Generation completed!';

          // 히스토리 새로고침
          fetchHistoryDetails(historyId);

          disconnectSSE();
        } else if (data.status === 'FAILED') {
          console.error('❌ 생성 실패 (History Detail):', data.message);
          statusMessage.value = data.message || 'Generation failed';

          // 히스토리 새로고침
          fetchHistoryDetails(historyId);

          disconnectSSE();
        } else if (data.status === 'GENERATING') {
          // 진행률 업데이트
          if (data.currentStep !== undefined && data.totalSteps !== undefined) {
            if (!currentStep.value || data.currentStep >= currentStep.value) {
              currentStep.value = data.currentStep;
              totalSteps.value = data.totalSteps;
              statusMessage.value = `Generating... (${data.currentStep}/${data.totalSteps})`;

              // history.value 실시간 업데이트
              if (history.value) {
                history.value.currentStep = data.currentStep;
                history.value.totalSteps = data.totalSteps;
              }

              console.log(`📊 진행률 (History Detail): ${data.currentStep}/${data.totalSteps}`);
            }
          } else {
            statusMessage.value = 'Generating...';
          }
        }
      } catch (err) {
        console.error('❌ SSE 메시지 파싱 실패 (History Detail):', err, event.data);
      }
    });

    eventSource.onerror = (event) => {
      console.error('❌ SSE 에러 (History Detail):', event);
      // SSE는 자동 재연결 - 에러 로그만 출력
    };

  } catch (err) {
    console.error('❌ SSE 생성 실패 (History Detail):', err);
  }
};

const disconnectSSE = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    console.log('⏹️ SSE 종료 (History Detail)');
  }
};

onUnmounted(() => {
  // 컴포넌트 언마운트 시 SSE 종료
  disconnectSSE();
});
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h1 class="text-3xl font-bold gradient-text">Generation Details</h1>
        <button class="modal-close" @click="closeModal">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body-content hide-scrollbar">
        <div v-if="loading" class="flex justify-center p-xl">
            <div class="loading"></div>
        </div>
        <div v-else-if="error" class="card text-center p-xl text-error bg-red-500/10">
            {{ error }}
        </div>
                <div v-else-if="history" class="grid grid-cols-2 gap-xl">
                    <!-- Left: Generated Images -->
                    <div class="card">
                        <div class="flex justify-between items-center mb-lg">
                            <h2 class="text-2xl font-bold gradient-text">Result Images</h2>
                            <button v-if="history.generatedImages && history.generatedImages.length > 1" class="btn btn-secondary btn-sm" @click="downloadAllAsZip" :disabled="isZipping">
                                <span v-if="isZipping">Zipping...</span>
                                <span v-else>Download All (.zip)</span>
                            </button>
                        </div>
                        <div class="images-grid" :class="{ 'single-image': history.generatedImages.length === 1 }">
                            <div v-for="image in history.generatedImages" :key="image.id" class="image-item">
                                <img :src="image.s3Url" alt="Generated image" class="img-cover"/>
                                <div class="content-overlay">
                                    <div class="overlay-top">
                                    </div>
                                    <div class="overlay-bottom">
                                        <button class="btn btn-secondary btn-sm w-full" @click.stop="downloadImage(image.s3Url, history.id, image.id)">
                                            Download
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
        
                    <!-- Right: Details -->
                    <div class="card">
                        <h2 class="text-2xl font-bold mb-lg gradient-text">Parameters</h2>
                        <div class="form-group"><label class="label">Model Used</label><p class="font-medium text-primary">{{ history.modelTitle }}</p></div>
                        <div class="form-group"><label class="label">Status</label><p class="badge" :class="{'badge-success': history.status === 'SUCCESS', 'badge-error': history.status === 'FAILED', 'badge-warning': ['PENDING', 'GENERATING'].includes(history.status)}">{{ history.status }}</p></div>
                        <div class="form-group"><label class="label">Positive Prompt</label><div class="prompt-box"><p>{{ history.prompt }}</p><button class="btn btn-ghost btn-sm" @click="copyToClipboard(history.prompt)">Copy</button></div></div>
                        <div class="form-group"><label class="label">Negative Prompt</label><div class="prompt-box"><p>{{ history.negativePrompt }}</p><button class="btn btn-ghost btn-sm" @click="copyToClipboard(history.negativePrompt)">Copy</button></div></div>
                        <div class="grid grid-cols-3 gap-md">
                            <div class="form-group"><label class="label">Steps</label><p class="font-medium text-primary">{{ history.steps }}</p></div>
                            <div class="form-group"><label class="label">Guidance</label><p class="font-medium text-primary">{{ history.guidanceScale }}</p></div>
                            <div class="form-group"><label class="label">Seed</label><p class="font-medium text-primary">{{ history.seed }}</p></div>
                        </div>
                        <div class="mt-auto pt-lg"><button class="btn w-full text-error" @click="deleteHistory" style="background: var(--error-light, rgba(239, 68, 68, 0.1));">Delete Generation</button></div>
                    </div>
                </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
/* Scoped styles from GenerateModal for consistency */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-lg);
}

.modal-content {
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-close {
  padding: var(--space-sm);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body-content {
  padding: var(--space-xl);
  overflow-y: auto;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
  gap: var(--space-lg);
}

.images-grid.single-image .image-item {
    grid-column: span 2;
    min-height: 400px;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-hover);
}

.image-item .img-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  /* Prevent long-press context menu on mobile */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.image-item:hover .img-cover {
  transform: scale(1.05);
}

.content-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-md);
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(0, 0, 0, 0.8) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  color: white;
  z-index: 2;
}

.image-item:hover .content-overlay {
  opacity: 1;
}

/* Mobile: Always show overlay on touch devices */
@media (hover: none) and (pointer: coarse) {
  .content-overlay {
    opacity: 1;
  }
}

.overlay-top {
  display: flex;
  gap: var(--space-sm);
}

.overlay-bottom {
  display: flex;
  flex-direction: column;
}

/* Specific styles for this modal */
.prompt-box {
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  font-size: 14px;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-sm);
  word-break: break-all;
}

.prompt-box p {
    flex: 1;
}

@media (max-width: 1024px) {
  .grid-cols-2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: var(--space-sm);
  }

  .modal-body-content {
    padding: var(--space-md);
  }

  .images-grid {
    grid-template-columns: 1fr !important; /* Force single column for images on mobile */
    gap: var(--space-md);
  }

  .images-grid.single-image .image-item {
    grid-column: span 1; /* Ensure single image also takes one column */
    min-height: auto; /* Reset min-height for mobile */
  }

  .image-item {
    min-height: 250px; /* Ensure minimum height on mobile */
  }

  .grid-cols-3 {
    grid-template-columns: 1fr !important; /* Force single column for parameter grid */
  }
}
</style>
