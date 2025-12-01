<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  // URL Fragment에서 토큰 정보 추출
  const hash = window.location.hash.substring(1); // # 제거
  const params = new URLSearchParams(hash);

  console.log('AuthCallback - hash:', hash);
  console.log('AuthCallback - params:', params.toString());

  // 언더스코어(_)와 카멜케이스 모두 지원
  const accessToken = params.get('access_token') || params.get('accessToken');
  const refreshToken = params.get('refresh_token') || params.get('refreshToken');
  const userId = params.get('user_id') || params.get('userId');
  const email = params.get('email');
  const name = params.get('name');
  const nickname = params.get('nickname');
  const profileImageUrl = params.get('profile_image_url') || params.get('profileImageUrl');
  const role = params.get('role');
  const createdAt = params.get('created_at') || params.get('createdAt');

  console.log('AuthCallback - accessToken:', accessToken ? 'exists' : 'missing');
  console.log('AuthCallback - refreshToken:', refreshToken ? 'exists' : 'missing');

  if (accessToken && refreshToken) {
    // 토큰 저장
    authStore.setTokens(accessToken, refreshToken);
    console.log('AuthCallback - tokens saved to localStorage');

    // 사용자 정보 저장
    if (userId && email && name && nickname) {
      const userData = {
        id: parseInt(userId),
        email: decodeURIComponent(email),
        name: decodeURIComponent(name),
        nickname: decodeURIComponent(nickname),
        profileImageUrl: profileImageUrl ? decodeURIComponent(profileImageUrl) : '',
        role: role || 'USER',
        createdAt: createdAt || new Date().toISOString(),
      };
      authStore.setUser(userData);
      console.log('AuthCallback - user data saved:', userData);
    }

    // 홈으로 리다이렉트 (페이지 새로고침으로 Navigation 상태 갱신)
    console.log('AuthCallback - redirecting to /');
    window.location.href = '/';
  } else {
    // 로그인 실패 - 다시 로그인 페이지로
    console.error('OAuth callback failed: No tokens received');
    console.error('URL:', window.location.href);
    router.push('/login');
  }
});
</script>

<template>
  <div class="auth-callback">
    <div class="loading-container">
      <div class="spinner"></div>
      <p class="text-lg text-secondary mt-lg">Completing login...</p>
    </div>
  </div>
</template>

<style scoped>
.auth-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-dark);
}

.loading-container {
  text-align: center;
}

.spinner {
  width: 48px;
  height: 48px;
  margin: 0 auto;
  border: 4px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
