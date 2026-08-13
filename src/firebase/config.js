import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

/**
 * Firebase configuration.
 *
 * These values are public by design — they identify the project, they do not
 * authorise anything. Security comes from firestore.rules and from the fact
 * that privileged writes only happen in Cloud Functions.
 *
 * They are read from the environment so development and production can point
 * at different projects, with the current project as the fallback so nothing
 * breaks before a .env file exists. Create .env.local with REACT_APP_FB_*
 * values to target a separate development project.
 */
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FB_API_KEY || 'AIzaSyCifrqszkwPzpbMA9sy3RhKjGSPCS-wVDo',
  authDomain: process.env.REACT_APP_FB_AUTH_DOMAIN || 'squashclub-e8a0c.firebaseapp.com',
  projectId: process.env.REACT_APP_FB_PROJECT_ID || 'squashclub-e8a0c',
  storageBucket: process.env.REACT_APP_FB_STORAGE_BUCKET || 'squashclub-e8a0c.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FB_MESSAGING_SENDER_ID || '397341468790',
  appId: process.env.REACT_APP_FB_APP_ID || '1:397341468790:web:5fce36506579b808a91757',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * The functions region must match the region declared in functions/index.js.
 * A mismatch surfaces as a confusing "not found" at call time rather than a
 * useful error, so it is pinned in both places.
 */
export const FUNCTIONS_REGION = 'europe-west1';
export const functions = getFunctions(app, FUNCTIONS_REGION);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

/* Local emulator wiring. Opt in with REACT_APP_USE_EMULATORS=true. */
if (process.env.REACT_APP_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  // eslint-disable-next-line no-console
  console.info('Firebase emulators connected');
}

export default app;
