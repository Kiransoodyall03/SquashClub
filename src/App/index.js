import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from '../firebase/firestore';
import { AnimatePresence } from 'framer-motion';

// Pages
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Register from '../pages/Register';
import PlayerDashboard from '../pages/PlayerDashboard';
import OwnerDashboard from '../pages/OwnerDashboard';
import TournamentDetails from '../pages/TournamentDetails';
import Tournaments from '../pages/Tournaments';
import Leaderboard from 'pages/LeaderBoard';
import Profile from '../pages/Profile';
import JoinTournament from '../pages/JoinTournament';
import MemberManagement from '../pages/MemberManagement';
import IndividualMatches from '../pages/IndividualMatches';
import MatchDetails from '../pages/MatchDetails';

// Components
import Navigation from '../components/Navigation';
import LoadingScreen from '../components/LoadingScreen';
import CompleteProfile from '../components/CompleteProfile';

import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log('=== onAuthStateChanged triggered ===');
      console.log('Auth user:', authUser ? authUser.uid : 'null');
      
      if (authUser) {
        setUser(authUser);
        
        // Fetch user profile from Firestore
        console.log('Fetching profile for:', authUser.uid);
        const profile = await getUserProfile(authUser.uid);
        console.log('Profile result:', profile ? 'FOUND' : 'NOT FOUND');
        
        if (profile) {
          // Check if user is disabled
          if (profile.disabled) {
            console.log('⛔ User account is disabled');
            // Sign out disabled users
            await auth.signOut();
            setUser(null);
            setUserProfile(null);
            setNeedsProfileCompletion(false);
            alert('Your account has been disabled. Please contact the administrator.');
            setLoading(false);
            return;
          }
          
          // User has a complete profile - normal flow
          console.log('✅ Profile exists - setting normal state');
          setUserProfile(profile);
          setNeedsProfileCompletion(false);
        } else {
          // User is authenticated but has no Firestore profile
          console.log('⚠️ No profile found - checking auth provider');
          
          // Check if this is a Google user (they need to complete profile)
          const isGoogleUser = authUser.providerData?.some(
            provider => provider.providerId === 'google.com'
          );
          
          console.log('Is Google user:', isGoogleUser);
          
          if (isGoogleUser) {
            // Google user without profile - needs to complete registration
            console.log('🔄 Google user needs profile completion');
            setUserProfile(null);
            setNeedsProfileCompletion(true);
          } else {
            // Email/password user - profile should exist
            console.log('📧 Email user - waiting for profile...');
            
            // Wait a moment and retry once
            await new Promise(resolve => setTimeout(resolve, 1500));
            const retryProfile = await getUserProfile(authUser.uid);
            
            if (retryProfile) {
              console.log('✅ Profile found on retry');
              setUserProfile(retryProfile);
              setNeedsProfileCompletion(false);
            } else {
              // Still no profile - something went wrong during registration
              console.log('❌ Still no profile after retry - showing completion');
              setUserProfile(null);
              setNeedsProfileCompletion(true);
            }
          }
        }
      } else {
        // No user logged in
        console.log('No user - clearing state');
        setUser(null);
        setUserProfile(null);
        setNeedsProfileCompletion(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    console.log('=== refreshUserProfile called ===');
    if (user) {
      const profile = await getUserProfile(user.uid);
      console.log('Refreshed profile:', profile ? 'FOUND' : 'NOT FOUND');
      if (profile) {
        setUserProfile(profile);
        setNeedsProfileCompletion(false);
      }
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  // If user is logged in but needs to complete profile (Google users only)
  if (user && needsProfileCompletion) {
    return (
      <Router>
        <CompleteProfile 
          user={user} 
          onProfileComplete={refreshUserProfile}
        />
      </Router>
    );
  }

  return (
    <Router>
      <div className="app">
        <AnimatePresence mode="wait">
          {user && <Navigation user={user} userProfile={userProfile} />}
        </AnimatePresence>
        
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={!user ? <Landing /> : <Navigate to="/dashboard" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/join/:tournamentId" element={<JoinTournament />} />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              user ? (
                userProfile?.role === 'owner' ? <OwnerDashboard /> : <PlayerDashboard />
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
          
          {/* Owner Dashboard Route */}
          <Route 
            path="/owner-dashboard" 
            element={
              user && userProfile?.role === 'owner' ? (
                <OwnerDashboard />
              ) : (
                <Navigate to="/dashboard" />
              )
            } 
          />
          
          {/* Member Management (Owners Only) */}
          <Route 
            path="/members" 
            element={
              user && userProfile?.role === 'owner' ? (
                <MemberManagement />
              ) : (
                <Navigate to="/dashboard" />
              )
            } 
          />
          
          <Route 
            path="/tournaments" 
            element={user ? <Tournaments userProfile={userProfile} /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/tournament/:id" 
            element={user ? <TournamentDetails userProfile={userProfile} /> : <Navigate to="/login" />} 
          />
          
          {/* Individual Matches */}
          <Route 
            path="/matches" 
            element={user ? <IndividualMatches userProfile={userProfile} /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/match/:id" 
            element={user ? <MatchDetails userProfile={userProfile} /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/leaderboard" 
            element={user ? <Leaderboard userProfile={userProfile} /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/profile" 
            element={user ? <Profile user={user} userProfile={userProfile} /> : <Navigate to="/login" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;