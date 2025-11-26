<template>
  <div class="model-detail-page">
    <div class="independent-scroll-container">
      <!-- Left Column -->
      <div class="scrollable-column">
        <!-- Title -->
        <div class="skeleton-box title-skeleton mb-md"></div>

        <!-- Sample Images Section -->
        <section class="samples-section mb-lg">
          <div class="flex items-center justify-between mb-md">
            <div class="skeleton-box h-8 w-40"></div>
          </div>
          <div class="grid grid-cols-3 gap-lg">
            <div v-for="i in 6" :key="i" class="sample-item skeleton-box"></div>
          </div>
        </section>

        <!-- Model Info -->
        <div class="model-info mb-lg">
          <!-- Description -->
          <div class="skeleton-box h-6 w-full mb-sm"></div>
          <div class="skeleton-box h-6 w-4/5 mb-md"></div>

          <!-- User nickname -->
          <div class="flex items-center gap-md mb-lg">
            <div class="skeleton-box h-6 w-32"></div>
          </div>

          <!-- Tags -->
          <div class="flex flex-wrap gap-sm items-center mb-lg">
            <div class="skeleton-box tag-skeleton"></div>
            <div class="skeleton-box tag-skeleton"></div>
            <div class="skeleton-box tag-skeleton"></div>
          </div>

          <!-- Buttons -->
          <div class="flex gap-sm">
            <div class="skeleton-box h-10 w-20"></div>
            <div class="skeleton-box h-10 w-56"></div>
          </div>
        </div>

        <!-- Prompts Section -->
        <section class="prompts-section mb-lg">
          <div class="flex items-center justify-between mb-lg">
            <div class="skeleton-box h-8 w-48"></div>
          </div>

          <div class="grid grid-cols-1 gap-lg">
            <div v-for="i in 2" :key="i" class="card">
              <div class="skeleton-box h-6 w-1/3 mb-md"></div>
              <div class="prompt-box mb-md">
                <div class="skeleton-box h-4 w-32 mb-sm"></div>
                <div class="skeleton-box h-16 w-full"></div>
              </div>
              <div class="prompt-box">
                <div class="skeleton-box h-4 w-32 mb-sm"></div>
                <div class="skeleton-box h-16 w-full"></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Right Column - Comments -->
      <section class="comments-section scrollable-column">
        <div class="skeleton-box h-8 w-32 mb-lg"></div>

        <!-- Comment Input -->
        <div class="card mb-lg">
          <div class="skeleton-box h-20 w-full mb-md"></div>
          <div class="skeleton-box h-10 w-32"></div>
        </div>

        <!-- Comment List -->
        <div class="comments-list flex flex-col gap-md">
          <div v-for="i in 3" :key="i" class="card-sm">
            <div class="flex items-start gap-md">
              <div class="skeleton-box avatar"></div>
              <div class="flex-1">
                <div class="flex items-center gap-sm mb-xs">
                  <div class="skeleton-box h-5 w-24"></div>
                  <div class="skeleton-box h-3 w-20"></div>
                </div>
                <div class="skeleton-box h-12 w-full mb-sm"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.skeleton-box {
  background: linear-gradient(
    90deg,
    var(--bg-hover) 0%,
    var(--bg-card) 50%,
    var(--bg-hover) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-md);
  animation: shimmer 2s ease-in-out infinite;
}

.title-skeleton {
  height: 2.5rem;
  width: 60%;
  border-radius: var(--radius-lg);
}

.tag-skeleton {
  height: 1.75rem;
  width: 4rem;
  border-radius: var(--radius-full);
}

.prompt-box {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.h-3 { height: 0.75rem; }
.h-4 { height: 1rem; }
.h-5 { height: 1.25rem; }
.h-6 { height: 1.5rem; }
.h-8 { height: 2rem; }
.h-10 { height: 2.5rem; }
.h-12 { height: 3rem; }
.h-16 { height: 4rem; }
.h-20 { height: 5rem; }

.w-full { width: 100%; }
.w-20 { width: 5rem; }
.w-24 { width: 6rem; }
.w-32 { width: 8rem; }
.w-40 { width: 10rem; }
.w-48 { width: 12rem; }
.w-56 { width: 14rem; }
.w-1\/3 { width: 33.333%; }
.w-4\/5 { width: 80%; }

.mb-xs { margin-bottom: var(--space-xs); }
.mb-sm { margin-bottom: var(--space-sm); }
.mb-md { margin-bottom: var(--space-md); }
.mb-lg { margin-bottom: var(--space-lg); }

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sample-item {
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
}

.independent-scroll-container {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-lg);
}

.scrollable-column {
  padding-right: var(--space-md);
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>