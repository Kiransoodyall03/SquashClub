import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from './firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import PlayerDashboard from './pages/PlayerDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import TournamentDetails from './pages/TournamentDetails';
import Profile from './pages/profile';
import JoinTournament from './pages/jointournament';

// Components
import Navigation from './components/navigation';
import LoadingScreen from './components/LoadingScreen';

import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        // Fetch user profile from Firestore
        const profile = await getUserProfile(authUser.uid);
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
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
            path="/tournament/:id" 
            element={user ? <TournamentDetails userProfile={userProfile} /> : <Navigate to="/login" />} 
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
