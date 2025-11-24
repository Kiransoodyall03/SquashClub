import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCifrqszkwPzpbMA9sy3RhKjGSPCS-wVDo",
  authDomain: "squashclub-e8a0c.firebaseapp.com",
  projectId: "squashclub-e8a0c",
  storageBucket: "squashclub-e8a0c.firebasestorage.app",
  messagingSenderId: "397341468790",
  appId: "1:397341468790:web:5fce36506579b808a91757",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Functions
export const functions = getFunctions(app);

export default app;
