import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCifrqszkwPzpbMA9sy3RhKjGSPCS-wVDo",
  authDomain: "squashclub-e8a0c.firebaseapp.com",
  projectId: "squashclub-e8a0c",
  storageBucket: "squashclub-e8a0c.firebasestorage.app",
  messagingSenderId: "397341468790",
  appId: "1:397341468790:web:5fce36506579b808a91757",
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;