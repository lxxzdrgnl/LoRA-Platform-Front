<script setup lang="ts">
import { ref, watch } from 'vue';
import ModelCard from '../components/models/ModelCard.vue';
import { api, type LoraModel, type SearchUserResponse, type SearchAllResponse } from '../services/api';

const searchQuery = ref('');
const searchType = ref<'all' | 'models' | 'users'>('all');
const loading = ref(false);

const modelResults = ref<LoraModel[]>([]);
const userResults = ref<SearchUserResponse[]>([]);

const popularTags = ref([
  { id: 1, name: 'Anime', count: 1234 },
  { id: 2, name: 'Character', count: 890 },
  { id: 3, name: 'Portrait', count: 567 },
  { id: 4, name: 'Landscape', count: 432 },
  { id: 5, name: 'Abstract', count: 321 },
]);

const recentSearches = ref([
  'anime character',
  'portrait style',
  'landscape art',
]);

watch(searchQuery, () => {
  if (searchQuery.value.length > 2) {
    performSearch();
  } else {
    modelResults.value = [];
    userResults.value = [];
  }
});

watch(searchType, () => {
  if (searchQuery.value.length > 2) {
    performSearch();
  }
});

const performSearch = async () => {
  loading.value = true;
  modelResults.value = [];
  userResults.value = [];

  try {
    if (searchType.value === 'models') {
      const response = await api.search.searchModels(searchQuery.value);
      modelResults.value = response.data.content;
    } else if (searchType.value === 'users') {
      const response = await api.search.searchUsers(searchQuery.value);
      userResults.value = response.data.content;
    } else { // 'all'
      const response = await api.search.search(searchQuery.value);
      modelResults.value = response.data.models.content;
      userResults.value = response.data.users.content;
    }
  } catch (error) {
    console.error('Search failed:', error);
    // Optionally, set an error message to display in the UI
  } finally {
    loading.value = false;
  }
};

const searchByTag = (tagName: string) => {
  searchQuery.value = tagName;
  searchType.value = 'models'; // Assume tag search is primarily for models
};

const useRecentSearch = (query: string) => {
  searchQuery.value = query;
  searchType.value = 'all'; // Assume recent search could be for anything
};
</script>

<template>
  <div class="search-page">
    <!-- Search Header -->
    <div class="search-header">
      <h1 class="text-3xl font-bold mb-lg">Search</h1>

      <!-- Search Bar -->
      <div class="search-bar-container mb-lg">
        <div class="search-bar">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search models, users, tags..."
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Search Type Filter -->
        <div class="search-filters flex gap-sm mt-md">
          <button
            class="filter-btn"
            :class="{ active: searchType === 'all' }"
            @click="searchType = 'all'"
          >
            All
          </button>
          <button
            class="filter-btn"
            :class="{ active: searchType === 'models' }"
            @click="searchType = 'models'"
          >
            Models
          </button>
          <button
            class="filter-btn"
            :class="{ active: searchType === 'users' }"
            @click="searchType = 'users'"
          >
            Users
          </button>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchQuery.length > 0" class="search-results">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-xl">
        <div class="loading mx-auto"></div>
      </div>

      <!-- Results -->
      <div v-else>
        <!-- Model Results -->
        <section v-if="(searchType === 'all' || searchType === 'models') && modelResults.length" class="mb-xl">
          <h2 class="text-2xl font-bold mb-lg">Models</h2>
          <div class="grid grid-cols-4 gap-lg">
            <a
              v-for="model in modelResults"
              :key="model.id"
              :href="`/models/${model.id}`"
              style="text-decoration: none; color: inherit;"
            >
              <ModelCard
                :id="model.id"
                :title="model.title"
                :description="model.description"
                :userNickname="model.userNickname"
                :likeCount="model.likeCount"
                :viewCount="model.viewCount"
                :favoriteCount="model.favoriteCount"
              />
            </a>
          </div>
        </section>

        <!-- User Results -->
        <section v-if="(searchType === 'all' || searchType === 'users') && userResults.length" class="mb-xl">
          <h2 class="text-2xl font-bold mb-lg">Users</h2>
          <div class="grid grid-cols-2 gap-lg">
            <div v-for="user in userResults" :key="user.id" class="card">
              <div class="flex items-center gap-md">
                <img :src="user.profileImageUrl" alt="User" class="avatar avatar-lg" />
                <div class="flex-1">
                  <h3 class="font-semibold">{{ user.nickname }}</h3>
                  <p class="text-sm text-secondary">{{ user.modelsCount }} models</p>
                </div>
                <a :href="`/users/${user.id}`" class="btn btn-secondary btn-sm">View</a>
              </div>
            </div>
          </div>
        </section>

        <!-- No Results -->
        <div v-if="!loading && !modelResults.length && !userResults.length" class="empty-state card text-center py-xl">
          <p class="text-secondary text-lg">No results found for "{{ searchQuery }}"</p>
        </div>
      </div>
    </div>

    <!-- Default View (No Search) -->
    <div v-else class="default-view">
      <!-- Recent Searches -->
      <section v-if="recentSearches.length" class="mb-xl">
        <h2 class="text-xl font-bold mb-md">Recent Searches</h2>
        <div class="flex flex-wrap gap-sm">
          <button
            v-for="(search, index) in recentSearches"
            :key="index"
            class="tag"
            @click="useRecentSearch(search)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            {{ search }}
          </button>
        </div>
      </section>

      <!-- Popular Tags -->
      <section>
        <h2 class="text-xl font-bold mb-md">Popular Tags</h2>
        <div class="grid grid-cols-2 gap-md">
          <div
            v-for="tag in popularTags"
            :key="tag.id"
            class="card cursor-pointer"
            @click="searchByTag(tag.name)"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold">{{ tag.name }}</span>
              <span class="badge badge-secondary">{{ tag.count }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
}

.search-bar-container {
  max-width: 800px;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border: 2px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  transition: all 0.3s ease;
}

.search-bar:focus-within {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.search-icon {
  color: var(--text-secondary);
  margin-right: var(--space-sm);
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 18px;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.search-filters {
  display: flex;
  gap: var(--space-sm);
}

.filter-btn {
  padding: 8px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--text-primary);
  color: var(--bg-dark);
  border-color: transparent;
}

@media (max-width: 768px) {
  .search-input {
    font-size: 16px;
  }
}
</style>
