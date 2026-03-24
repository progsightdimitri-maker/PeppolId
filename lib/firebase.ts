import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// You can add other services here as needed (e.g., getAuth, getFirestore)

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log("Initializing Firebase with config:", {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? "***" : "MISSING"
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
console.log("Firebase Auth initialized");

export { auth };
export default app;
