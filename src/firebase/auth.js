import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from './config';
import { createUserProfile, getUserProfile } from './firestore';

// Register with Email and Password
export const registerWithEmail = async (email, password, profileData) => {
  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update display name in Auth
    await updateProfile(user, {
      displayName: `${profileData.firstName} ${profileData.lastName}`
    });
    
    // Create user profile in Firestore
    await createUserProfile(user.uid, {
      ...profileData,
      email: user.email,
      authProvider: 'email'
    });
    
    return { success: true, user };
  } catch (error) {
    console.error('Error registering with email:', error);
    return { success: false, error: error.message };
  }
};

// Login with Email and Password
export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error logging in with email:', error);
    return { success: false, error: error.message };
  }
};

// Login/Register with Google
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user profile exists
    const existingProfile = await getUserProfile(user.uid);
    
    if (!existingProfile) {
      // Create new profile for Google user
      const names = user.displayName ? user.displayName.split(' ') : ['', ''];
      await createUserProfile(user.uid, {
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || '',
        email: user.email,
        authProvider: 'google',
        role: 'player' // Default role
      });
    }
    
    return { success: true, user };
  } catch (error) {
    console.error('Error logging in with Google:', error);
    return { success: false, error: error.message };
  }
};

// Logout
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error logging out:', error);
    return { success: false, error: error.message };
  }
};

// Reset Password
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, error: error.message };
  }
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Check if user is owner
export const isOwner = async (userId) => {
  const profile = await getUserProfile(userId);
  return profile?.role === 'owner';
};