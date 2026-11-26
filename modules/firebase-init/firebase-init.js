// modules/firebase-init/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB0GWTLaywOq2fEdrME8jVMygsdjj49NL4",
  authDomain: "gestion-cdbf.firebaseapp.com",
  projectId: "gestion-cdbf",
  storageBucket: "gestion-cdbf.firebasestorage.app",
  messagingSenderId: "514312606131",
  appId: "1:514312606131:web:38a1ccac8f9c819a5b7bc6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsub();
      resolve(user);
    }
  });

  if (!auth.currentUser) {
    signInAnonymously(auth).catch((err) => {
      console.error("Error de autenticación silenciosa:", err);
      unsub();
      resolve(null);
    });
  }
});