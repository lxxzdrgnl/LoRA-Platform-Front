<script setup lang="ts">
const props = defineProps<{
  history: any;
}>();

const emit = defineEmits(['view-details', 'download']);

const handleViewDetails = () => {
  emit('view-details');
};

const handleDownload = (event: Event) => {
  event.stopPropagation(); // Prevent opening the detail modal
  if (!props.history.thumbnailUrl) {
    alert('No image available for download.');
    return;
  }

  // Create a link element to trigger the download
  const link = document.createElement('a');
  link.href = props.history.thumbnailUrl;

  // Suggest a filename to the user
  const promptPart = props.history.prompt.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
  link.download = `blueming_ai_${props.history.id}_${promptPart}.png`;
  
  // Append to the DOM, click, and then remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<template>
  <div class="card card-clickable group" @click="handleViewDetails">
    <div class="relative aspect-square w-full overflow-hidden rounded-lg">
      <img
        :src="history.thumbnailUrl || 'https://via.placeholder.com/300'"
        :alt="`Generated image for ${history.prompt}`"
        class="img-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div
        class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-md"
      >
        <button class="btn btn-primary btn-sm" @click.stop="handleViewDetails">Details</button>
        <button class="btn btn-secondary btn-sm" @click.stop="handleDownload">Download</button>
      </div>
    </div>
    <div class="p-md">
      <p class="font-semibold truncate">{{ history.modelTitle }}</p>
      <p class="text-sm text-muted truncate">{{ history.prompt }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Using styles from main.css, but you can add specific overrides here if needed */
.group:hover .group-hover\:scale-105 {
  transform: scale(1.05);
}

.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}
</style>
