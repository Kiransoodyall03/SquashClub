import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from './firebase/firestore';
import { AnimatePresence } from 'framer-motion';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import PlayerDashboard from './pages/PlayerDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import TournamentDetails from './pages/TournamentDetails';
import Tournaments from './pages/Tournaments';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import JoinTournament from './pages/JoinTournament';
import CompleteProfile from './components/CompleteProfile'
// Components
import Navigation from './components/Navigation';
import LoadingScreen from './components/LoadingScreen';

import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        // Fetch user profile from Firestore
        const profile = await getUserProfile(authUser.uid);
        setUserProfile(profile);
        setNeedsProfileCompletion(true);
                if (profile) {
          setUserProfile(profile);
          setNeedsProfileCompletion(false);
        } else {
          // User is authenticated but has no profile
          console.log('⚠️ User authenticated but no profile - needs completion');
          setUserProfile(null);
          setNeedsProfileCompletion(true);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setNeedsProfileCompletion(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  const refreshUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setUserProfile(profile);
        setNeedsProfileCompletion(false);
      }
    }
  };
  if (loading) {
    return <LoadingScreen />;
  }
  // If user is logged in but needs to complete profile, show CompleteProfile
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
          
          <Route 
            path="/tournaments" 
            element={user ? <Tournaments userProfile={userProfile} /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/tournament/:id" 
            element={user ? <TournamentDetails userProfile={userProfile} /> : <Navigate to="/login" />} 
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