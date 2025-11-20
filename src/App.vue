<script setup lang="ts">
import Navigation from './components/Navigation.vue';
import { useTheme } from './composables/useTheme';

useTheme();
</script>

<template>
  <div class="app">
    <Navigation />

    <main class="main-content">
      <RouterView />
    </main>

    <footer class="footer">
      <div class="footer-centered-content">
        <p>&copy; 2025 Blueming AI. All rights reserved.</p>
        <p class="footer-contact-info">
          <span>Contact:</span>
          <a href="mailto:pung4905@naver.com" class="footer-link">pung4905@naver.com</a>
        </p>
        <div class="footer-social">
          <a href="https://www.instagram.com/lxxzdrgnl" target="_blank" rel="noopener noreferrer" class="social-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </a>
          <a href="https://github.com/lxxzdrgnl" target="_blank" rel="noopener noreferrer" class="social-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
}

.footer {
  padding: var(--space-md) var(--space-lg);
  color: var(--text-muted);
  font-size: 14px;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
  margin-top: var(--space-xl);
}

.footer-centered-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.footer-centered-content p {
  margin: 0;
  padding: var(--space-xs) 0;
}

.footer-contact-info {
  margin-bottom: var(--space-sm);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.footer-link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: var(--text-primary);
}

.footer-social {
  display: flex;
  gap: var(--space-lg);
  margin-top: var(--space-md);
}

.social-link {
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.social-link:hover {
  color: var(--text-primary);
}
</style>
