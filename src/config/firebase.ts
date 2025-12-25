import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "my-lora-auth.firebaseapp.com",
  projectId: "my-lora-auth",
  storageBucket: "my-lora-auth.firebasestorage.app",
  messagingSenderId: "17587805020",
  appId: "1:17587805020:web:580bfd5ae1340b9f8cbf99",
  measurementId: "G-9S9T0X13T1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
