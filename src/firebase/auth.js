// src/firebase/auth.js

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './config';
import { createUserProfile, getUserProfile } from './firestore';

// Registration passwords - Change these to your desired passwords
const REGISTRATION_PASSWORDS = {
  player: 'SquashPlayer2024',
  owner: 'SquashOwner2024'
};

// Validate registration password
export const validateRegistrationPassword = (role, password) => {
  return REGISTRATION_PASSWORDS[role] === password;
};

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
    
    let errorMessage = 'Registration failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered. Please login instead.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please use at least 6 characters.';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Login with Email and Password
export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(userCredential.user.uid);
    
    return { success: true, user: userCredential.user, profile };
  } catch (error) {
    console.error('Error logging in with email:', error);
    
    let errorMessage = 'Login failed. Please try again.';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password. Please try again.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later.';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Login/Register with Google
export const loginWithGoogle = async () => {
  try {
    console.log('loginWithGoogle: Starting Google popup...');
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    console.log('loginWithGoogle: Popup successful');
    console.log('User ID:', user.uid);
    console.log('User email:', user.email);
    console.log('User displayName:', user.displayName);
    
    // Check if user profile exists
    console.log('loginWithGoogle: Checking for existing profile...');
    const existingProfile = await getUserProfile(user.uid);
    console.log('loginWithGoogle: Profile check result:', existingProfile ? 'FOUND' : 'NOT FOUND');
    
    if (existingProfile) {
      // Existing user - return profile
      console.log('loginWithGoogle: Returning existing user');
      return { 
        success: true, 
        user, 
        profile: existingProfile,
        isNewUser: false 
      };
    }
    
    // New user - needs to complete registration with role selection and password
    console.log('loginWithGoogle: Returning NEW user (needs completion)');
    return { 
      success: true, 
      user, 
      profile: null,
      isNewUser: true 
    };
  } catch (error) {
    console.error('loginWithGoogle: Error occurred');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    let errorMessage = 'Google sign-in failed. Please try again.';
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in cancelled. Please try again.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Popup was blocked. Please allow popups and try again.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'Sign-in cancelled. Please try again.';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Complete Google registration (for new Google users) - SIMPLIFIED VERSION
export const completeGoogleRegistration = async (userId, profileData) => {
  try {
    console.log('=== Starting completeGoogleRegistration ===');
    console.log('userId:', userId);
    console.log('profileData:', profileData);
    
    const user = auth.currentUser;
    console.log('Current user:', user ? user.uid : 'none');
    
    if (!user) {
      console.error('No current user found');
      return { success: false, error: 'No user logged in. Please try signing in again.' };
    }
    
    // Verify the userId matches the current user
    if (user.uid !== userId) {
      console.error('User ID mismatch:', user.uid, 'vs', userId);
      return { success: false, error: 'User ID mismatch. Please try again.' };
    }
    
    // Extract name from Google account if not provided
    const displayName = user.displayName || '';
    const nameParts = displayName.split(' ');
    
    const finalProfileData = {
      firstName: profileData.firstName || nameParts[0] || '',
      lastName: profileData.lastName || nameParts.slice(1).join(' ') || '',
      email: user.email,
      role: profileData.role,
      age: profileData.age || null,
      photoURL: user.photoURL || null,
      authProvider: 'google'
    };
    
    console.log('Final profile data:', finalProfileData);
    
    // Use the existing createUserProfile function
    console.log('Calling createUserProfile...');
    const result = await createUserProfile(userId, finalProfileData);
    
    if (!result.success) {
      console.error('createUserProfile failed:', result.error);
      return { success: false, error: result.error };
    }
    
    console.log('✅ createUserProfile succeeded');
    
    // Wait a moment for Firestore to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fetch the created profile to confirm it exists
    console.log('Fetching created profile...');
    const createdProfile = await getUserProfile(userId);
    console.log('Fetched profile:', createdProfile);
    
    if (!createdProfile) {
      console.error('❌ Profile was not created - getUserProfile returned null');
      throw new Error('Profile creation verification failed');
    }
    
    console.log('=== completeGoogleRegistration SUCCESS ===');
    return { success: true, profile: createdProfile };
  } catch (error) {
    console.error('=== completeGoogleRegistration ERROR ===');
    console.error('Error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return { success: false, error: `Failed to complete registration: ${error.message}` };
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
    
    let errorMessage = 'Failed to send reset email. Please try again.';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    }
    
    return { success: false, error: errorMessage };
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