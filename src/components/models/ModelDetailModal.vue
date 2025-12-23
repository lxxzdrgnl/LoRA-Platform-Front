<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../services/api';
import ModelDetailSkeleton from './ModelDetailSkeleton.vue';

const authStore = useAuthStore();

const props = defineProps<{ 
  show: boolean;
  modelId: number | null;
}>();

const emit = defineEmits(['close', 'open-generate', 'model-update']);

const loading = ref(true);
const error = ref('');
const isEditingModel = ref(false);
const currentUser = ref<any>(null);

const model = ref<any>(null);
const comments = ref<any[]>([]);

const newComment = ref('');
const availableTags = ref<any[]>([]);
const newTagInput = ref('');
const editingPromptId = ref<number | null>(null);
const isEditingTags = ref(false);
const tagsInput = ref('');
const tagEditingError = ref('');
const newPrompt = ref({
  title: '',
  prompt: '',
  negativePrompt: '',
  description: ''
});

const copiedPromptId = ref<number | null>(null);

// Model info editing state
const editedModelInfo = ref({
  title: '',
  description: ''
});

// Sample editing state
const isEditingSamples = ref(false);
const availableImages = ref<any[]>([]);
const currentSamples = ref<any[]>([]);
const draggedSampleIndex = ref<number | null>(null);

const isOwner = computed(() => {
  // 테스트 유저(100)는 모든 모델을 편집할 수 있음
  if (currentUser.value && currentUser.value.id === 100) {
    return true;
  }
  return currentUser.value && model.value && model.value.userId === currentUser.value.id;
});

const isTestUser = computed(() => {
  return currentUser.value && currentUser.value.id === 100;
});

const canEditSamples = computed(() => {
  return isOwner.value || isTestUser.value;
});

// 테스트 유저 권한 체크 헬퍼 함수
const checkTestUserPermission = (action: string): boolean => {
  if (isTestUser.value) {
    alert(`테스트 유저는 ${action}을(를) 수정할 수 없습니다. (읽기 전용 모드)`);
    return false;
  }
  return true;
};

watch(() => props.modelId, async (newId) => {
  if (newId) {
    await loadCurrentUser();
    await fetchModelDetails(newId);
    await fetchComments(newId);
  }
});

const loadCurrentUser = async () => {
  if (!authStore.isAuthenticated) return;
  try {
    const response = await api.user.getMyProfile();
    currentUser.value = response.data;
  } catch (err) {
    console.error('Failed to load current user:', err);
  }
};

const fetchModelDetails = async (id: number) => {
  try {
    loading.value = true;
    const response = await api.models.getModelDetail(id);
    model.value = response.data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load model';
  } finally {
    loading.value = false;
  }
};

const fetchComments = async (id: number) => {
  try {
    const response = await api.community.getComments(id, 0, 20);
    // 테스트 유저(100)가 작성한 댓글 필터링
    comments.value = response.data.content.filter((comment: any) => comment.userId !== 100);
  } catch (err) {
    console.error('Failed to fetch comments:', err);
  }
};

const toggleLike = async () => {
  if (!authStore.requireAuth()) return;

  if (!props.modelId) return;
  try {
    await api.community.toggleLike(props.modelId);
    model.value.isLiked = !model.value.isLiked;
    emit('model-update', { 
      id: props.modelId, 
      isLiked: model.value.isLiked, 
      likeCount: model.value.likeCount 
    });
  } catch (err) {
    console.error('Failed to toggle like:', err);
  }
};

const submitComment = async () => {
  if (!authStore.requireAuth()) return;

  if (!newComment.value.trim() || !props.modelId) return;
  try {
    const response = await api.community.createComment(props.modelId, newComment.value);
    comments.value.unshift(response.data);
    newComment.value = '';
  } catch (err) {
    console.error('Failed to create comment:', err);
  }
};

const toggleCommentLike = async (commentId: number) => {
  if (!authStore.requireAuth()) return;

  if (!props.modelId) return;
  try {
    const response = await api.community.toggleCommentLike(props.modelId, commentId);
    const comment = comments.value.find(c => c.id === commentId);
    if (comment) {
      comment.isLiked = response.data.isLiked;
      comment.likeCount += response.data.isLiked ? 1 : -1;
    }
  } catch (err) {
    console.error('Failed to toggle comment like:', err);
  }
};

const copyPrompt = (promptId: number, text: string) => {
  if (!navigator.clipboard) {
    console.error('Clipboard API not available. This feature works only in secure contexts (HTTPS or localhost).');
    alert('Clipboard API not available. Please use a secure connection (HTTPS) or localhost.');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    copiedPromptId.value = promptId;
    setTimeout(() => {
      copiedPromptId.value = null;
    }, 1500); // Revert back after 1.5 seconds
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    alert('Failed to copy text. Please check browser permissions.');
  });
};

const openGenerateModal = () => {
  if (props.modelId) {
    emit('open-generate', props.modelId);
  }
};

const closeModal = () => {
  // Reset all editing states
  isEditingSamples.value = false;
  isEditingTags.value = false;
  isEditingModel.value = false;
  editingPromptId.value = null;

  // Reset editing data
  resetNewPrompt();
  tagsInput.value = '';
  tagEditingError.value = '';
  currentSamples.value = [];
  availableImages.value = [];
  draggedSampleIndex.value = null;

  // Reset model data and state
  model.value = null;
  comments.value = [];
  loading.value = true;
  error.value = '';

  emit('close');
};

const resetNewPrompt = () => {
  newPrompt.value = {
    title: '',
    prompt: '',
    negativePrompt: '',
    description: ''
  };
};

const addNewPrompt = async () => {
  if (!newPrompt.value.title || !newPrompt.value.prompt || !props.modelId) return;
  if (!checkTestUserPermission('프롬프트')) return;
  try {
    await api.prompts.createPrompt(props.modelId, newPrompt.value);
    await fetchModelDetails(props.modelId);
    resetNewPrompt();
  } catch (err) {
    console.error('Failed to create prompt:', err);
  }
};

const startEditPrompt = (prompt: any) => {
  editingPromptId.value = prompt.id;
  newPrompt.value = { ...prompt };
};

const savePromptEdit = async (promptId: number) => {
  if (!props.modelId) return;
  if (!checkTestUserPermission('프롬프트')) return;
  try {
    await api.prompts.updatePrompt(props.modelId, promptId, newPrompt.value);
    await fetchModelDetails(props.modelId);
    editingPromptId.value = null;
    resetNewPrompt();
  } catch (err) {
    console.error('Failed to update prompt:', err);
  }
};

const deletePrompt = async (promptId: number) => {
  if (!props.modelId) return;
  if (!checkTestUserPermission('프롬프트')) return;
  if (!confirm('Are you sure you want to delete this prompt?')) return;
  try {
    await api.prompts.deletePrompt(props.modelId, promptId);
    await fetchModelDetails(props.modelId);
  } catch (err) {
    console.error('Failed to delete prompt:', err);
  }
};

const deleteComment = async (commentId: number) => {
  if (!props.modelId || !confirm('Are you sure you want to delete this comment?')) return;
  try {
    await api.community.deleteComment(props.modelId, commentId);
    comments.value = comments.value.filter(c => c.id !== commentId);
  } catch (err) {
    console.error('Failed to delete comment:', err);
  }
};

const startEditTags = () => {
  if (!model.value) return;
  tagEditingError.value = '';
  tagsInput.value = model.value.tags.map((tag: any) => tag.name).join(', ');
  isEditingTags.value = true;
};

const cancelEditTags = () => {
  isEditingTags.value = false;
};

const saveTags = async () => {
  if (!props.modelId) return;
  if (!checkTestUserPermission('태그')) return;
  tagEditingError.value = '';

  const newTagNames = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  const oldTagNames = model.value.tags.map((t: any) => t.name);

  const tagsToAdd = newTagNames.filter(t => !oldTagNames.includes(t));
  const tagsToRemove = model.value.tags.filter((t: any) => !newTagNames.includes(t.name));

  if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
    isEditingTags.value = false;
    return;
  }

  try {
    await Promise.all([
      ...tagsToAdd.map(tagName => api.tags.addTagToModel(props.modelId!, tagName)),
      ...tagsToRemove.map((tag: any) => api.tags.removeTagFromModel(props.modelId!, tag.id))
    ]);

    await fetchModelDetails(props.modelId);
    isEditingTags.value = false;
    emit('model-update');
  } catch (err) {
    console.error('Failed to update tags', err);
    tagEditingError.value = err instanceof Error ? err.message : 'An unknown error occurred while saving tags.';
  }
};

// Sample editing functions
const startEditSamples = async () => {
  if (!props.modelId || !model.value) return;

  // 테스트 유저는 샘플 이미지만 사용 (보안상 모든 생성 이미지를 노출하지 않음)
  if (isTestUser.value) {
    availableImages.value = model.value.samples.map((sample: any) => ({
      id: sample.generatedImageId,
      s3Url: sample.imageUrl,
      displayOrder: sample.displayOrder,
      isPrimary: sample.isPrimary
    }));

    // Copy current samples
    currentSamples.value = [...model.value.samples];

    isEditingSamples.value = true;
    return;
  }

  // 일반 유저: 모든 생성 이미지 로드
  try {
    const response = await api.models.getGeneratedImages(props.modelId);
    availableImages.value = response.data;

    // Copy current samples
    currentSamples.value = [...model.value.samples];

    isEditingSamples.value = true;
  } catch (err) {
    console.error('Failed to load generated images:', err);
    alert('Failed to load generated images. Make sure you have generated images with this model.');
  }
};

const cancelEditSamples = () => {
  isEditingSamples.value = false;
  availableImages.value = [];
  currentSamples.value = [];
};

const isSampleSelected = (imageId: number) => {
  return currentSamples.value.some(s => s.generatedImageId === imageId);
};

const toggleImageSelection = (image: any) => {
  if (!props.modelId) return;

  const existingSampleIndex = currentSamples.value.findIndex(s => s.generatedImageId === image.id);

  if (existingSampleIndex >= 0) {
    // Remove from local state only
    currentSamples.value.splice(existingSampleIndex, 1);
  } else {
    // Add to local state only (with temporary id)
    currentSamples.value.push({
      id: null, // Temporary - will be created on save
      generatedImageId: image.id,
      imageUrl: image.s3Url,
      isPrimary: false
    });
  }
};

const saveSamples = async () => {
  if (!props.modelId) return;
  if (!checkTestUserPermission('샘플')) return;

  // Validate: Public models must have at least 1 sample
  if (model.value?.isPublic && currentSamples.value.length === 0) {
    alert('공개 모델은 최소 1개 이상의 샘플 이미지가 필요합니다. 샘플을 추가하거나 모델을 비공개로 전환해주세요.');
    return;
  }

  try {
    const originalSamples = model.value?.samples || [];

    // Find samples to remove (in original but not in current)
    const samplesToRemove = originalSamples.filter(
      (original: any) => !currentSamples.value.some(current => current.generatedImageId === original.generatedImageId)
    );

    // Find samples to add (in current but not in original, or has null id)
    const samplesToAdd = currentSamples.value.filter(
      current => current.id === null || !originalSamples.some((original: any) => original.generatedImageId === current.generatedImageId)
    );

    // Remove samples
    for (const sample of samplesToRemove) {
      await api.models.deleteSample(props.modelId, sample.id);
    }

    // Add samples and get their IDs
    const addedSampleIds: number[] = [];
    for (const sample of samplesToAdd) {
      const response = await api.models.addSample(props.modelId, sample.generatedImageId);
      addedSampleIds.push(response.data.id);
      // Update local sample with real ID
      sample.id = response.data.id;
    }

    // Update order only if there are samples
    if (currentSamples.value.length > 0) {
      const sampleIds = currentSamples.value.map(s => s.id).filter(id => id !== null);
      await api.models.updateSampleOrder(props.modelId, sampleIds);

      // Set first sample as primary (thumbnail)
      if (sampleIds.length > 0) {
        await api.models.setPrimarySample(props.modelId, sampleIds[0]);
      }
    }

    // Reload model details
    await fetchModelDetails(props.modelId);

    isEditingSamples.value = false;
    availableImages.value = [];
    currentSamples.value = [];
    emit('model-update');
  } catch (err) {
    console.error('Failed to save samples:', err);
    alert('Failed to save samples');
  }
};

// Drag and drop handlers
const handleDragStart = (index: number) => {
  draggedSampleIndex.value = index;
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
};

const handleDrop = (targetIndex: number) => {
  if (draggedSampleIndex.value === null) return;

  const draggedItem = currentSamples.value[draggedSampleIndex.value];
  currentSamples.value.splice(draggedSampleIndex.value, 1);
  currentSamples.value.splice(targetIndex, 0, draggedItem);

  draggedSampleIndex.value = null;
};

// Move sample up or down
const moveSampleUp = (index: number) => {
  if (index === 0) return;

  // Swap with previous item
  const temp = currentSamples.value[index];
  currentSamples.value[index] = currentSamples.value[index - 1];
  currentSamples.value[index - 1] = temp;
};

const moveSampleDown = (index: number) => {
  if (index === currentSamples.value.length - 1) return;

  // Swap with next item
  const temp = currentSamples.value[index];
  currentSamples.value[index] = currentSamples.value[index + 1];
  currentSamples.value[index + 1] = temp;
};

// Visibility toggle
const toggleVisibility = async () => {
  if (!props.modelId || !model.value) return;
  if (!checkTestUserPermission('공개 여부')) return;

  const newVisibility = !model.value.isPublic;

  // If trying to make public, check if there are samples
  if (newVisibility && (!model.value.samples || model.value.samples.length === 0)) {
    alert('샘플 이미지를 먼저 선택해주세요. 샘플 이미지가 있어야 모델을 공개할 수 있습니다.');
    return;
  }

  try {
    await api.models.updateModel(props.modelId, {
      isPublic: newVisibility
    });

    // Update local state
    model.value.isPublic = newVisibility;

    emit('model-update');

    alert(newVisibility ? '모델이 공개되었습니다!' : '모델이 비공개로 변경되었습니다.');
  } catch (err) {
    console.error('Failed to update visibility:', err);
    alert('공개 상태 변경에 실패했습니다.');
  }
};

const deleteModel = async () => {
  if (!props.modelId || !model.value) return;
  if (!checkTestUserPermission('모델')) return;

  const confirmMessage = `정말로 "${model.value.title}" 모델을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 관련 데이터(샘플, 프롬프트, 댓글 등)가 함께 삭제됩니다.`;

  if (!confirm(confirmMessage)) return;

  // Double confirmation for safety
  if (!confirm('정말로 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.')) return;

  try {
    await api.models.deleteModel(props.modelId);
    alert('모델이 성공적으로 삭제되었습니다.');
    emit('model-update');
    closeModal();
  } catch (err) {
    console.error('Failed to delete model:', err);
    alert('모델 삭제에 실패했습니다.');
  }
};

const startEditMode = () => {
  // 현재 모델 정보 복사
  if (model.value) {
    editedModelInfo.value.title = model.value.title;
    editedModelInfo.value.description = model.value.description;
  }
  isEditingModel.value = true;
};

const saveModelInfo = async () => {
  if (!props.modelId || !model.value) return;
  if (!checkTestUserPermission('모델 정보')) return;

  try {
    await api.models.updateModel(props.modelId, {
      title: editedModelInfo.value.title,
      description: editedModelInfo.value.description,
      isPublic: model.value.isPublic
    });

    // 로컬 상태 업데이트
    model.value.title = editedModelInfo.value.title;
    model.value.description = editedModelInfo.value.description;

    emit('model-update');
  } catch (err) {
    console.error('Failed to save model info:', err);
    alert('모델 정보 저장에 실패했습니다.');
  }
};

const handleCompleteEdit = async () => {
  // Save model info if changed
  if (editedModelInfo.value.title !== model.value.title ||
      editedModelInfo.value.description !== model.value.description) {
    await saveModelInfo();
  }

  // If in sample editing mode, save samples first
  if (isEditingSamples.value) {
    await saveSamples();
  }
  // Exit edit mode
  isEditingModel.value = false;
  isEditingSamples.value = false;
};
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <button @click="closeModal" class="btn-close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="modal-body-content hide-scrollbar">
        <ModelDetailSkeleton v-if="loading" />
        <div v-else-if="error" class="text-center p-xl text-error">{{ error }}</div>
        <div v-else-if="model" class="model-detail-page">
          <div class="independent-scroll-container">
            <div class="scrollable-column">
              <!-- Model Title (Editable in Edit Mode) -->
              <h1 v-if="!isEditingModel" class="text-4xl font-bold mb-md">{{ model.title }}</h1>
              <div v-else class="mb-md">
                <label class="text-sm font-semibold text-muted mb-xs">Model Name</label>
                <input
                  v-model="editedModelInfo.title"
                  type="text"
                  class="input-field"
                  placeholder="Enter model name"
                  style="width: 100%; padding: 0.75rem; font-size: 1.5rem; font-weight: bold; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary);"
                />
              </div>

              <!-- Sample Images -->
              <section class="samples-section mb-lg">
                <div class="flex items-center justify-between mb-md">
                  <h2 class="text-2xl font-bold">Sample Images</h2>
                  <button v-if="isOwner && !isEditingModel" @click="startEditMode" class="btn btn-sm btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                    Edit Mode
                  </button>
                  <button v-if="isOwner && isEditingModel" @click="handleCompleteEdit" class="btn btn-sm btn-secondary">
                    완료
                  </button>
                </div>

                <!-- Normal Mode -->
                <div v-if="!isEditingSamples">
                  <div v-if="model.samples && model.samples.length > 0" class="grid grid-cols-3 gap-lg hide-scrollbar">
                    <div v-for="sample in model.samples" :key="sample.id" class="sample-item">
                      <img :src="sample.imageUrl" alt="Sample" class="img-cover rounded-lg" />
                    </div>
                  </div>
                  <div v-else class="grid grid-cols-3 gap-lg hide-scrollbar">
                    <div class="sample-item">
                      <div class="placeholder-thumbnail">
                        <span>No Image</span>
                      </div>
                    </div>
                  </div>
                  <button v-if="canEditSamples && isEditingModel" @click="startEditSamples" class="btn btn-sm btn-primary mt-md w-full">
                    Edit Samples
                  </button>
                </div>

                <!-- Edit Mode -->
                <div v-else class="sample-edit-container">
                  <!-- Current Samples (Draggable) -->
                  <div class="mb-lg">
                    <h3 class="text-lg font-semibold mb-md">Current Samples (Drag to reorder - first image is the thumbnail)</h3>
                    <div v-if="currentSamples.length === 0" class="text-center p-lg text-muted">
                      No samples selected. Select images from below.
                    </div>
                    <div v-else class="current-samples-grid">
                      <div
                        v-for="(sample, index) in currentSamples"
                        :key="sample.id"
                        class="sample-item-draggable"
                        :class="{ 'sample-primary': index === 0 }"
                        draggable="true"
                        @dragstart="handleDragStart(index)"
                        @dragover="handleDragOver"
                        @drop="handleDrop(index)"
                      >
                        <img :src="sample.imageUrl" alt="Sample" class="img-cover rounded-lg" />
                        <div v-if="index === 0" class="badge badge-primary primary-badge">Thumbnail</div>
                        <div class="sample-order-badge">{{ index + 1 }}</div>
                        <!-- Move buttons for mobile -->
                        <div class="sample-move-buttons">
                          <button
                            v-if="index > 0"
                            @click="moveSampleUp(index)"
                            class="btn-move btn-move-up"
                            title="Move up"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                          </button>
                          <button
                            v-if="index < currentSamples.length - 1"
                            @click="moveSampleDown(index)"
                            class="btn-move btn-move-down"
                            title="Move down"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Available Images (Selectable) -->
                  <div class="mb-lg">
                    <h3 class="text-lg font-semibold mb-md">Generated Images (Click to add/remove)</h3>
                    <div v-if="availableImages.length === 0" class="text-center p-lg text-muted">
                      No generated images found. Generate images with this model first.
                    </div>
                    <div v-else class="available-images-grid hide-scrollbar">
                      <div
                        v-for="image in availableImages"
                        :key="image.id"
                        class="available-image-item"
                        :class="{ 'selected': isSampleSelected(image.id) }"
                        @click="toggleImageSelection(image)"
                      >
                        <img :src="image.s3Url" alt="Generated" class="img-cover rounded" />
                        <div v-if="isSampleSelected(image.id)" class="checkmark">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex gap-sm">
                    <button @click="saveSamples" class="btn btn-primary">Save</button>
                    <button @click="cancelEditSamples" class="btn btn-secondary">Cancel</button>
                  </div>
                </div>
              </section>

              <!-- Model Info -->
              <div class="model-info mb-lg">
                <!-- Model Description (Editable in Edit Mode) -->
                <p v-if="!isEditingModel" class="text-lg text-secondary mb-md">{{ model.description }}</p>
                <div v-else class="mb-md">
                  <label class="text-sm font-semibold text-muted mb-xs">Details</label>
                  <textarea
                    v-model="editedModelInfo.description"
                    class="input-field description-textarea"
                    placeholder="Enter model description"
                    rows="3"
                  ></textarea>
                </div>
                <div class="flex items-center justify-between mb-lg">
                  <p class="font-semibold">{{ model.userNickname }}</p>
                  <div v-if="isOwner && !isEditingModel" class="flex items-center gap-xs">
                    <svg v-if="model.isPublic" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-success">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                    <span class="text-sm font-semibold" :class="model.isPublic ? 'text-success' : 'text-muted'">
                      {{ model.isPublic ? 'Public' : 'Private' }}
                    </span>
                  </div>
                </div>

                <!-- Visibility Status and Toggle -->
                <div v-if="isOwner && isEditingModel" class="visibility-section mb-lg">
                  <div class="flex items-center justify-between p-md rounded-lg" style="background: var(--bg-hover); border: 1px solid var(--border);">
                    <div class="flex items-center gap-md">
                      <div class="visibility-icon">
                        <svg v-if="model.isPublic" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-success">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      </div>
                      <div>
                        <p class="font-semibold">{{ model.isPublic ? 'Public' : 'Private' }}</p>
                        <p class="text-sm text-muted">
                          {{ model.isPublic ? 'Visible to everyone' : 'Only visible to you' }}
                        </p>
                      </div>
                    </div>
                    <div class="flex gap-sm">
                      <button
                        @click="deleteModel"
                        class="btn btn-sm btn-secondary text-error"
                        style="border-color: var(--error, #ef4444);"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete
                      </button>
                      <button
                        @click="toggleVisibility"
                        class="btn btn-sm"
                        :class="model.isPublic ? 'btn-secondary' : 'btn-primary'"
                      >
                        {{ model.isPublic ? 'Make Private' : 'Make Public' }}
                      </button>
                    </div>
                  </div>
                  <p v-if="!model.isPublic && (!model.samples || model.samples.length === 0)" class="text-sm text-warning mt-sm">
                    ⚠️ 샘플 이미지를 추가해야 모델을 공개할 수 있습니다
                  </p>
                </div>
                <div class="flex flex-wrap gap-sm items-center mb-lg">
                  <template v-if="isEditingTags">
                    <div class="w-full">
                      <label class="label">Tags (comma-separated)</label>
                      <input v-model="tagsInput" type="text" placeholder="e.g. style, character, concept" class="input w-full mt-xs" />
                      <div v-if="tagEditingError" class="text-error text-sm mt-sm">{{ tagEditingError }}</div>
                      <div class="flex gap-sm mt-sm">
                        <button @click="saveTags" class="btn btn-primary btn-sm">Save</button>
                        <button @click="cancelEditTags" class="btn btn-secondary btn-sm">Cancel</button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <span v-for="tag in model.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
                    <button v-if="isOwner && isEditingModel" @click="startEditTags" class="btn btn-ghost btn-icon btn-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                  </template>
                </div>
                <div class="flex gap-sm action-buttons">
                  <button class="btn btn-icon like-button" @click="toggleLike" :class="model.isLiked ? 'btn-primary' : 'btn-secondary'">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" :fill="model.isLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" class="heart-icon">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    {{ model.likeCount }}
                  </button>
                  <button class="btn btn-primary generate-button" @click="openGenerateModal">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="generate-icon">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Generate with this model
                  </button>
                </div>
              </div>

              <!-- Prompts -->
              <section class="prompts-section mb-lg">
                <div class="flex items-center justify-between mb-lg">
                  <h2 class="text-2xl font-bold gradient-text">Prompt Examples</h2>
                  <button v-if="isOwner && isEditingModel && editingPromptId === null" @click="editingPromptId = -1" class="btn btn-sm btn-primary">
                    Add New Prompt
                  </button>
                </div>

                <div v-if="editingPromptId !== null" class="card mb-lg">
                  <h3 class="font-semibold mb-md">{{ editingPromptId === -1 ? 'New Prompt' : 'Edit Prompt' }}</h3>
                  <div class="form-group mb-md">
                    <label class="label">Title</label>
                    <input v-model="newPrompt.title" type="text" class="input" placeholder="Prompt title" />
                  </div>
                  <div class="form-group mb-md">
                    <label class="label">Positive Prompt</label>
                    <textarea v-model="newPrompt.prompt" class="textarea" rows="3" placeholder="Positive prompt"></textarea>
                  </div>
                  <div class="form-group mb-md">
                    <label class="label">Negative Prompt</label>
                    <textarea v-model="newPrompt.negativePrompt" class="textarea" rows="3" placeholder="Negative prompt"></textarea>
                  </div>
                  <div class="form-group mb-md">
                    <label class="label">Description (optional)</label>
                    <input v-model="newPrompt.description" type="text" class="input" placeholder="Prompt description" />
                  </div>
                  <div class="flex gap-sm">
                    <button @click="editingPromptId === -1 ? addNewPrompt() : savePromptEdit(editingPromptId)" class="btn btn-primary">
                      {{ editingPromptId === -1 ? 'Add' : 'Save' }}
                    </button>
                    <button @click="editingPromptId = null; resetNewPrompt();" class="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-lg">
                  <div v-for="prompt in model.prompts" :key="prompt.id" class="card">
                    <div class="flex items-center justify-between mb-md">
                      <h3 class="font-semibold">{{ prompt.title }}</h3>
                      <div v-if="isOwner && isEditingModel" class="flex gap-sm">
                        <button @click="startEditPrompt(prompt)" class="btn btn-ghost btn-sm">Edit</button>
                        <button @click="deletePrompt(prompt.id)" class="btn btn-ghost btn-sm text-error">Delete</button>
                      </div>
                    </div>
                    <div class="prompt-box mb-md">
                      <div class="flex items-center justify-between mb-sm">
                        <span class="text-sm text-secondary">Positive Prompt</span>
                        <button class="btn btn-ghost btn-sm" @click="copyPrompt(prompt.id, prompt.prompt)">{{ copiedPromptId === prompt.id ? 'Copied!' : 'Copy' }}</button>
                      </div>
                      <p class="prompt-text">{{ prompt.prompt }}</p>
                    </div>
                    <div class="prompt-box">
                      <div class="flex items-center justify-between mb-sm">
                        <span class="text-sm text-secondary">Negative Prompt</span>
                        <button class="btn btn-ghost btn-sm" @click="copyPrompt(prompt.id, prompt.negativePrompt)">{{ copiedPromptId === prompt.id ? 'Copied!' : 'Copy' }}</button>
                      </div>
                      <p class="prompt-text">{{ prompt.negativePrompt }}</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <!-- Comments -->
            <section class="comments-section scrollable-column">
              <h2 class="text-2xl font-bold mb-lg gradient-text">Comments</h2>
              <div class="card mb-lg">
                <textarea v-model="newComment" class="textarea mb-md" placeholder="Write a comment..." rows="3"></textarea>
                <button class="btn btn-primary" @click="submitComment">Post Comment</button>
              </div>
              <div class="comments-list flex flex-col gap-md">
                <div v-for="comment in comments" :key="comment.id" class="card-sm">
                  <div class="flex items-start gap-md">
                    <img :src="comment.userProfileImageUrl || 'https://via.placeholder.com/40'" alt="User" class="avatar" />
                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-xs">
                        <div class="flex items-center gap-sm">
                          <span class="font-semibold">{{ comment.userNickname }}</span>
                          <span class="text-xs text-muted">{{ new Date(comment.createdAt).toLocaleDateString() }}</span>
                        </div>
                        <button v-if="currentUser && comment.userNickname === currentUser.nickname" @click="deleteComment(comment.id)" class="btn btn-ghost btn-sm text-error">Delete</button>
                      </div>
                      <div class="flex items-start justify-between">
                        <p class="text-secondary mb-sm flex-1">{{ comment.content }}</p>
                        <button
                          class="btn btn-ghost btn-sm"
                          :class="{ 'text-error': comment.isLiked }"
                          @click="toggleCommentLike(comment.id)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" :fill="comment.isLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                          {{ comment.likeCount }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  z-index: 1010;
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
  position: relative;
}

.modal-body-content {
  padding: var(--space-lg);
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}

.independent-scroll-container {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-lg);
  width: 100%;
  box-sizing: border-box;
}

.scrollable-column {
  padding-right: var(--space-md);
  min-width: 0;
  box-sizing: border-box;
}

.sample-item {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.sample-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter 0.3s ease, opacity 0.3s ease;
}

.sample-item img:hover {
  filter: brightness(1.15);
  opacity: 0.9;
}

.placeholder-thumbnail {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-hover);
  color: var(--text-muted);
  font-size: 14px;
  border-radius: var(--radius-lg);
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: var(--space-xs);
  }
  .modal-content {
    border-radius: var(--radius-md);
    max-height: 95vh;
  }
  .modal-body-content {
    padding: var(--space-lg);
  }
  .independent-scroll-container {
    grid-template-columns: 1fr;
    gap: var(--space-md);
  }
  .scrollable-column {
    padding-right: 0;
  }
  /* Prevent text overflow */
  .model-detail-page {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .model-detail-page * {
    max-width: 100%;
    box-sizing: border-box;
  }
  /* Change image grid to a horizontal scroll container on mobile */
  .samples-section .grid-cols-3 {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: var(--space-md);
  }

  .samples-section .sample-item {
    flex: 0 0 70%;
    max-width: 280px;
    scroll-snap-align: start;
  }

  /* Make action buttons fill width on mobile */
  .action-buttons {
    width: 100%;
  }

  .action-buttons .btn {
    flex: 1;
    padding: var(--space-md) var(--space-lg);
    font-size: 16px;
  }

  .action-buttons .btn-icon {
    min-width: 80px;
  }

  /* Adjust available images grid on mobile */
  .available-images-grid {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: var(--space-sm) !important;
    max-height: 400px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* iOS smooth scrolling */
  }

  .current-samples-grid {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: var(--space-sm) !important;
    max-height: 500px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* iOS smooth scrolling */
  }

  .available-image-item,
  .sample-item-draggable {
    width: 100%;
    height: auto;
  }

  .available-image-item img,
  .sample-item-draggable img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.btn-close {
  position: absolute;
  top: var(--space-lg);
  right: var(--space-lg);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-sm);
  z-index: 10;
  transition: color 0.2s ease;
}
.btn-close:hover {
  color: var(--text-primary);
}

/* ========== Sample Editing Styles ========== */
.sample-edit-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.current-samples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-md);
  max-height: 500px;
  overflow-y: auto;
  padding: var(--space-xs);
}

@media (min-width: 768px) {
  .current-samples-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

.sample-item-draggable {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 2px solid var(--border);
  transition: all 0.3s ease;
  cursor: move;
}

.sample-item-draggable:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.sample-item-draggable.sample-primary {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.sample-order-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.primary-badge {
  position: absolute;
  top: 8px;
  left: 8px;
}

.available-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-sm);
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-xs);
}

@media (min-width: 768px) {
  .available-images-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}

.available-image-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 2px solid var(--border);
  cursor: pointer;
  transition: all 0.2s ease;
}

.available-image-item:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.available-image-item.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.available-image-item .checkmark {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--primary);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
}

.cursor-move {
  cursor: move;
}

/* Sample move buttons */
.sample-move-buttons {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: none;
  gap: 4px;
  z-index: 10;
}

.btn-move {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px;
  cursor: pointer;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-move:hover {
  background: var(--primary);
  border-color: var(--primary);
}

.btn-move:active {
  transform: scale(0.95);
}

/* Desktop: show buttons on hover */
.sample-item-draggable:hover .sample-move-buttons {
  display: flex;
}

/* Mobile: always show buttons */
@media (max-width: 768px) {
  .sample-move-buttons {
    display: flex !important;
  }

  .sample-item-draggable {
    cursor: default;
  }
}

/* ========== Visibility Section Styles ========== */
.visibility-section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.visibility-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-success {
  color: var(--success, #10b981);
}

.text-warning {
  color: var(--warning, #f59e0b);
}

/* Description textarea styles */
.description-textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  resize: vertical;
  min-height: 100px;
  font-size: 14px;
}

/* Icon sizes */
.heart-icon,
.generate-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Mobile responsive for visibility section */
@media (max-width: 768px) {
  .visibility-section > div {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .visibility-section .btn {
    flex: 1;
    min-width: auto;
  }

  /* Larger font size for description textarea on mobile */
  .description-textarea {
    font-size: 16px !important;
    padding: 0.75rem !important;
    min-height: 120px !important;
  }

  /* Larger icons on mobile */
  .heart-icon {
    width: 20px !important;
    height: 20px !important;
  }

  .generate-icon {
    width: 28px !important;
    height: 28px !important;
  }

  /* Adjust button for better visibility */
  .like-button {
    font-size: 16px !important;
    font-weight: 600 !important;
  }

  .generate-button {
    font-size: 15px !important;
    padding: var(--space-md) var(--space-md) !important;
  }

  .generate-icon {
    width: 21px !important;
    height: 21px !important;
  }
}
</style>
