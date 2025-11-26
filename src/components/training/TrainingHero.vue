<template>
  <header class="hero-section">
    <div class="animation-container">
      <div class="petal-container">
        <div v-for="i in 30" :key="i" :class="`petal petal-${i}`"></div>
      </div>
      <div class="shape shape1"></div>
      <div class="shape shape2"></div>
      <div class="shape shape3"></div>
    </div>
    <h1 class="hero-title">
      Craft Your AI Masterpiece
    </h1>
    <p class="hero-subtitle">
      Bring your vision to life by training a custom LoRA model. <br />
      Just upload your images, and we'll handle the rest.
    </p>
  </header>
</template>

<style scoped>
/* Hero Section Styles from ModelList.vue */
.hero-section {
  text-align: center;
  padding: 10rem 1rem 8rem;
  position: relative;
  overflow: hidden;
  background: var(--bg-dark);
}

.animation-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.petal-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.petal {
  position: absolute;
  background: rgba(173, 216, 230, 0.7); /* Light blue */
  border-radius: 150% 0 150% 0;
  top: -10%;
  opacity: 0;
  animation: fall 10s linear infinite;
}

.petal-1 { left: 10%; animation-delay: 0s; width: 15px; height: 20px; animation-duration: 12s; }
.petal-2 { left: 20%; animation-delay: 5s; width: 20px; height: 25px; animation-duration: 15s; }
.petal-3 { left: 30%; animation-delay: 2s; width: 12px; height: 18px; animation-duration: 10s; }
.petal-4 { left: 40%; animation-delay: 8s; width: 18px; height: 22px; animation-duration: 18s; }
.petal-5 { left: 50%; animation-delay: 1s; width: 22px; height: 28px; animation-duration: 13s; }
.petal-6 { left: 60%; animation-delay: 6s; width: 16px; height: 20px; animation-duration: 11s; }
.petal-7 { left: 70%; animation-delay: 3s; width: 14px; height: 19px; animation-duration: 14s; }
.petal-8 { left: 80%; animation-delay: 9s; width: 19px; height: 24px; animation-duration: 16s; }
.petal-9 { left: 90%; animation-delay: 4s; width: 17px; height: 21px; animation-duration: 12s; }
.petal-10 { left: 5%; animation-delay: 7s; width: 13px; height: 18px; animation-duration: 17s; }
.petal-11 { left: 15%; animation-delay: 2.5s; width: 18px; height: 23px; animation-name: fall2; animation-duration: 20s; }
.petal-12 { left: 25%; animation-delay: 6.5s; width: 15px; height: 20px; animation-name: fall3; animation-duration: 13s; }
.petal-13 { left: 35%; animation-delay: 1.5s; width: 20px; height: 25px; animation-name: fall2; animation-duration: 18s; }
.petal-14 { left: 45%; animation-delay: 5.5s; width: 12px; height: 17px; animation-name: fall3; animation-duration: 11s; }
.petal-15 { left: 55%; animation-delay: 0.5s; width: 16px; height: 22px; animation-name: fall2; animation-duration: 14s; }
.petal-16 { left: 65%; animation-delay: 8.5s; width: 14px; height: 18px; animation-duration: 19s; background-color: rgba(135, 206, 250, 0.7); }
.petal-17 { left: 75%; animation-delay: 3.5s; width: 18px; height: 24px; animation-duration: 16s; }
.petal-18 { left: 85%; animation-delay: 1.2s; width: 20px; height: 26px; animation-name: fall3; animation-duration: 12s; background-color: rgba(135, 206, 250, 0.7); }
.petal-19 { left: 95%; animation-delay: 4.5s; width: 15px; height: 20px; animation-duration: 15s; }
.petal-20 { left: 2%; animation-delay: 9.5s; width: 12px; height: 16px; animation-name: fall2; animation-duration: 18s; }
.petal-21 { left: 12%; animation-delay: 0.2s; width: 18px; height: 24px; animation-duration: 13s; background-color: rgba(135, 206, 250, 0.7); }
.petal-22 { left: 22%; animation-delay: 5.2s; width: 16px; height: 21px; animation-duration: 17s; }
.petal-23 { left: 32%; animation-delay: 2.8s; width: 14px; height: 18px; animation-name: fall3; animation-duration: 11s; }
.petal-24 { left: 42%; animation-delay: 7.8s; width: 20px; height: 26px; animation-duration: 19s; }
.petal-25 { left: 52%; animation-delay: 1.8s; width: 15px; height: 20px; animation-name: fall2; animation-duration: 12s; background-color: rgba(135, 206, 250, 0.7); }
.petal-26 { left: 62%; animation-delay: 6.8s; width: 22px; height: 28px; animation-duration: 16s; }
.petal-27 { left: 72%; animation-delay: 3.8s; width: 17px; height: 22px; animation-duration: 13s; }
.petal-28 { left: 82%; animation-delay: 8.8s; width: 13px; height: 19px; animation-name: fall3; animation-duration: 15s; }
.petal-29 { left: 92%; animation-delay: 4.8s; width: 19px; height: 25px; animation-duration: 17s; background-color: rgba(135, 206, 250, 0.7); }
.petal-30 { left: 98%; animation-delay: 2.2s; width: 15px; height: 20px; animation-name: fall2; animation-duration: 14s; }


@keyframes fall {
  0% { top: -10%; opacity: 0; transform: translateX(0) rotate(0deg); }
  10% { opacity: 1; }
  100% { top: 110%; opacity: 1; transform: translateX(50px) rotate(270deg); }
}

@keyframes fall2 {
  0% { top: -10%; opacity: 0; transform: translateX(0) rotate(0deg); }
  20% { opacity: 1; }
  100% { top: 110%; opacity: 1; transform: translateX(-80px) rotate(360deg); }
}

@keyframes fall3 {
  0% { top: -10%; opacity: 0; transform: translateX(0) rotate(0deg); }
  15% { opacity: 1; }
  100% { top: 110%; opacity: 1; transform: translateX(100px) rotate(180deg); }
}


.shape {
  position: absolute;
  mix-blend-mode: screen;
  filter: blur(120px);
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

.shape1 {
  width: 500px;
  height: 500px;
  background: rgba(0, 71, 171, 0.25);
  top: -150px;
  left: -150px;
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  animation-name: move1, pulse-glow;
  animation-duration: 25s, 8s;
}

.shape2 {
  width: 400px;
  height: 400px;
  background: rgba(0, 207, 255, 0.2);
  bottom: -100px;
  right: -100px;
  border-radius: 60% 40% 30% 70% / 50% 60% 40% 50%;
  animation-name: move2, pulse-glow;
  animation-duration: 30s, 10s;
  animation-direction: alternate-reverse, alternate;
}

.shape3 {
  width: 350px;
  height: 350px;
  background: rgba(79, 70, 229, 0.2);
  bottom: 50px;
  left: 15%;
  border-radius: 50% 50% 30% 70% / 60% 40% 60% 40%;
  animation-name: move3, pulse-glow;
  animation-duration: 20s, 9s;
}

@keyframes move1 {
  from { transform: translate(0, 0) rotate(0deg) scale(1); }
  to { transform: translate(100px, 50px) rotate(45deg) scale(1.1); }
}
@keyframes move2 {
  from { transform: translate(0, 0) rotate(0deg) scale(1); }
  to { transform: translate(-80px, -40px) rotate(-30deg) scale(1.2); }
}
@keyframes move3 {
  from { transform: translate(0, 0) rotate(0deg) scale(1); }
  to { transform: translate(50px, -100px) rotate(60deg) scale(1.1); }
}
@keyframes pulse-glow {
  0% { opacity: 0.5; }
  50% { opacity: 0.8; }
  100% { opacity: 0.5; }
}

.hero-title, .hero-subtitle, .hero-actions {
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: 4.5rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  max-width: 42rem;
  margin: 0 auto 2.5rem;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .hero-section {
    padding: 6rem 1rem 4rem;
  }

  .hero-title {
    font-size: 4rem;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 4rem;
  }
}
</style>