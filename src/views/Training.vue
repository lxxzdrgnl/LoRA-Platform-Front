<script setup lang="ts">
import { ref } from 'vue';
import TrainingHero from '../components/training/TrainingHero.vue';
import TrainingForm from '../components/training/TrainingForm.vue';

interface TrainingStatus {
  isTraining: boolean;
  statusMessage: string;
  currentEpoch: number;
  totalEpochs: number;
}

const trainingStatus = ref<TrainingStatus>({
  isTraining: false,
  statusMessage: '',
  currentEpoch: 0,
  totalEpochs: 0
});

const handleTrainingStatusChange = (status: TrainingStatus) => {
  trainingStatus.value = status;
};
</script>

<template>
  <div>
    <TrainingHero />
    <div class="container">
      <div class="training-container">
        <TrainingForm @training-status-change="handleTrainingStatusChange" />

        <!-- Training Progress Section -->
        <div class="card">
          <h2 class="text-2xl font-bold mb-md gradient-text">Training Progress</h2>
          <div class="progress-section">
            <div v-if="trainingStatus.isTraining">
              <!-- Status Message -->
              <div class="mb-md p-md rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p class="text-base text-blue-400 font-medium">{{ trainingStatus.statusMessage }}</p>
              </div>

              <!-- Epoch Progress (only show during TRAINING phase) -->
              <div v-if="trainingStatus.currentEpoch > 0 && trainingStatus.totalEpochs > 0" class="mt-md">
                <div class="flex justify-between mb-sm">
                  <span class="text-sm font-semibold text-secondary">Training Progress</span>
                  <span class="text-sm font-bold text-primary">Epoch {{ trainingStatus.currentEpoch }} / {{ trainingStatus.totalEpochs }}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: `${(trainingStatus.currentEpoch / trainingStatus.totalEpochs) * 100}%` }"></div>
                </div>
                <div class="flex justify-between mt-xs">
                  <span class="text-xs text-muted">{{ Math.round((trainingStatus.currentEpoch / trainingStatus.totalEpochs) * 100) }}% Complete</span>
                  <span class="text-xs text-muted">{{ trainingStatus.totalEpochs - trainingStatus.currentEpoch }} epochs remaining</span>
                </div>
              </div>
            </div>
            <div v-else class="no-training-message">
              <div class="message-box">
                <p class="text-sm text-muted">Training has not started yet. Upload images and start training to see progress.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.training-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-xl);
  max-width: 800px;
  margin: -50px auto 0;
  position: relative;
  z-index: 2;
  padding-bottom: var(--space-xl);
}

.card {
  background-color: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
}

.progress-section {
  margin-top: var(--space-md);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--text-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.no-training-message {
  text-align: center;
}

.message-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}
</style>