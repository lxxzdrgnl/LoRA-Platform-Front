<script setup lang="ts">
import { ref, watch } from 'vue';
import type { UserResponse } from '../../services/api';

interface Props {
  user: UserResponse;
  myModelsCount: number;
  likedModelsCount: number;
}

interface Emits {
  (e: 'update', data: { nickname: string; profileImageUrl?: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isEditing = ref(false);
const editForm = ref({
  nickname: props.user.nickname,
  profileImageUrl: props.user.profileImageUrl || '',
});

// Watch for user prop changes
watch(() => props.user, (newUser) => {
  if (!isEditing.value) {
    editForm.value = {
      nickname: newUser.nickname,
      profileImageUrl: newUser.profileImageUrl || '',
    };
  }
}, { deep: true });

const startEdit = () => {
  isEditing.value = true;
};

const cancelEdit = () => {
  isEditing.value = false;
  editForm.value = {
    nickname: props.user.nickname,
    profileImageUrl: props.user.profileImageUrl || '',
  };
};

const saveProfile = () => {
  const trimmedNickname = editForm.value.nickname.trim();
  if (trimmedNickname.length < 2 || trimmedNickname.length > 10) {
    alert('닉네임은 2-10자 이내로 입력해주세요.');
    return;
  }

  emit('update', {
    nickname: trimmedNickname,
    profileImageUrl: editForm.value.profileImageUrl || undefined,
  });
  isEditing.value = false;
};
</script>

<template>
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
              <span class="stat-value">{{ myModelsCount }}</span>
              <span class="stat-label">Models</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ likedModelsCount }}</span>
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
</template>

<style scoped>
.profile-avatar {
  width: 120px;
  height: 120px;
  object-fit: cover;
  object-position: center;
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
</style>
