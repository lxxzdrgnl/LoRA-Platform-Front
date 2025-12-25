<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { api } from '../services/api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);
const errorMessage = ref('');

const handleRegister = async () => {
  if (!email.value || !password.value || !confirmPassword.value) {
    errorMessage.value = 'All fields are required';
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    // Firebase 회원가입
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);

    // ID Token 획득
    const idToken = await userCredential.user.getIdToken();

    // Spring Boot로 전송하여 JWT 받기
    const response = await api.auth.firebaseLogin(idToken);
    const { accessToken, refreshToken, userId, email: userEmail, nickname, profileImageUrl } = response.data;

    // 토큰 저장
    authStore.setTokens(accessToken, refreshToken);
    authStore.setUser({ id: userId, email: userEmail, nickname, profileImageUrl, name: nickname, role: 'USER', createdAt: new Date().toISOString() });

    // 홈으로 리다이렉트
    router.push('/');
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error.code === 'auth/email-already-in-use') {
      errorMessage.value = 'This email is already registered';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage.value = 'Invalid email address';
    } else if (error.code === 'auth/weak-password') {
      errorMessage.value = 'Password is too weak';
    } else if (error.message?.includes('EMAIL_ALREADY_EXISTS')) {
      errorMessage.value = 'This email is already registered with another login method (Google)';
    } else {
      errorMessage.value = error.message || 'Registration failed';
    }
  } finally {
    isLoading.value = false;
  }
};

const handleGoogleSignup = () => {
  // 기존 OAuth2 방식 사용 (Spring Security가 처리)
  api.auth.googleLogin();
};
</script>

<template>
  <div class="register-page">
    <div class="register-container">
      <div class="register-card card">
        <!-- Logo -->
        <div class="text-center mb-xl">
          <h1 class="text-4xl font-bold gradient-text mb-md">Blueming AI</h1>
          <p class="text-lg text-secondary">Create your account</p>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="error-message mb-md">
          {{ errorMessage }}
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="register-form">
          <div class="form-group">
            <label class="label">Email</label>
            <input
              type="email"
              v-model="email"
              placeholder="your@email.com"
              class="input"
              :disabled="isLoading"
              required
            />
          </div>

          <div class="form-group">
            <label class="label">Password</label>
            <input
              type="password"
              v-model="password"
              placeholder="Minimum 6 characters"
              class="input"
              :disabled="isLoading"
              required
            />
          </div>

          <div class="form-group">
            <label class="label">Confirm Password</label>
            <input
              type="password"
              v-model="confirmPassword"
              placeholder="Confirm your password"
              class="input"
              :disabled="isLoading"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
            <span v-if="isLoading">Creating Account...</span>
            <span v-else>Sign Up</span>
          </button>
        </form>

        <!-- Divider -->
        <div class="divider-container">
          <div class="divider-line"></div>
          <span class="divider-text">or</span>
          <div class="divider-line"></div>
        </div>

        <!-- Google Sign Up -->
        <button class="btn-google" @click="handleGoogleSignup" :disabled="isLoading">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </button>

        <!-- Login Link -->
        <p class="text-center mt-lg text-secondary">
          Already have an account?
          <router-link to="/login" class="text-primary font-semibold">Log in</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background: var(--bg-dark);
}

.register-container {
  width: 100%;
  max-width: 480px;
}

.register-card {
  padding: var(--space-2xl);
}

.register-form {
  margin-bottom: var(--space-lg);
}

.error-message {
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: 14px;
  text-align: center;
}

.divider-container {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin: var(--space-lg) 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.divider-text {
  color: var(--text-muted);
  font-size: 14px;
}

.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  width: 100%;
  padding: 16px 24px;
  background: white;
  color: #1f1f1f;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-google:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-google:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .register-card {
    padding: var(--space-xl);
  }
}
</style>
