import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, Users, Trophy, LogIn } from 'lucide-react';
import { getTournament, joinTournament, getUserProfile } from '../../firebase/firestore';
import { auth } from '../../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import './JoinTournament.css';
const JoinTournament = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check auth state
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const profile = await getUserProfile(authUser.uid);
        setUserProfile(profile);
      }
    });

    loadTournament();

    return () => unsubscribe();
  }, [tournamentId]);

  const loadTournament = async () => {
    setLoading(true);
    const tournamentData = await getTournament(tournamentId);
    setTournament(tournamentData);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/join/${tournamentId}`);
      return;
    }

    if (!userProfile) {
      setError('Please complete your profile first');
      setTimeout(() => navigate('/profile'), 2000);
      return;
    }

    setJoining(true);
    const result = await joinTournament(tournamentId, user.uid, userProfile);
    
    if (result.success) {
      navigate(`/tournament/${tournamentId}`);
    } else {
      setError(result.error || 'Failed to join tournament');
    }
    setJoining(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="error-container">
        <h2>Tournament Not Found</h2>
        <p>This tournament link may be invalid or expired.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Go to Home
        </button>
      </div>
    );
  }

  const isAlreadyJoined = user && tournament.participants?.some(
    p => p.userId === user.uid
  );

  const isFull = tournament.participants?.length >= tournament.maxParticipants;

  return (
    <div className="join-tournament-page">
      <div className="container">
        <motion.div 
          className="join-card card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="tournament-banner">
            <Trophy className="banner-icon" />
            <h1>You're Invited!</h1>
          </div>

          <div className="tournament-details">
            <h2>{tournament.name}</h2>
            
            <div className="details-grid">
              <div className="detail-item">
                <Calendar className="w-5 h-5" />
                <div>
                  <span className="detail-label">Date</span>
                  <span className="detail-value">
                    {new Date(tournament.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="detail-item">
                <Clock className="w-5 h-5" />
                <div>
                  <span className="detail-label">Time</span>
                  <span className="detail-value">{tournament.time}</span>
                </div>
              </div>
              
              <div className="detail-item">
                <Users className="w-5 h-5" />
                <div>
                  <span className="detail-label">Players</span>
                  <span className="detail-value">
                    {tournament.participants?.length || 0} / {tournament.maxParticipants}
                  </span>
                </div>
              </div>
              
              <div className="detail-item">
                <Trophy className="w-5 h-5" />
                <div>
                  <span className="detail-label">Format</span>
                  <span className="detail-value">{tournament.format}</span>
                </div>
              </div>
            </div>

            {tournament.description && (
              <div className="tournament-description">
                <p>{tournament.description}</p>
              </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="join-actions">
              {isAlreadyJoined ? (
                <div className="already-joined">
                  <CheckCircle className="w-6 h-6" />
                  <span>You're already registered for this tournament!</span>
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate(`/tournament/${tournamentId}`)}
                  >
                    View Tournament
                  </button>
                </div>
              ) : isFull ? (
                <div className="tournament-full">
                  <span>Sorry, this tournament is full!</span>
                  <button 
                    className="btn btn-outline"
                    onClick={() => navigate('/dashboard')}
                  >
                    Browse Other Tournaments
                  </button>
                </div>
              ) : (
                <>
                  {!user ? (
                    <>
                      <p className="join-prompt">
                        Sign in or create an account to join this tournament
                      </p>
                      <div className="auth-buttons">
                        <button 
                          className="btn btn-primary btn-large"
                          onClick={() => navigate(`/login?redirect=/join/${tournamentId}`)}
                        >
                          <LogIn className="w-5 h-5" />
                          Sign In
                        </button>
                        <button 
                          className="btn btn-outline btn-large"
                          onClick={() => navigate(`/register?redirect=/join/${tournamentId}`)}
                        >
                          Create Account
                        </button>
                      </div>
                    </>
                  ) : (
                    <button 
                      className="btn btn-primary btn-large"
                      onClick={handleJoin}
                      disabled={joining}
                    >
                      {joining ? (
                        <>
                          <span className="loading-spinner"></span>
                          Joining...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Join Tournament
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="participants-preview">
            <h3>Current Participants ({tournament.participants?.length || 0})</h3>
            {tournament.participants && tournament.participants.length > 0 ? (
              <div className="participants-list">
                {tournament.participants.slice(0, 8).map((participant) => (
                  <div key={participant.userId} className="participant-chip">
                    <span className="participant-name">{participant.name}</span>
                    <span className="participant-elo">ELO {participant.elo}</span>
                  </div>
                ))}
                {tournament.participants.length > 8 && (
                  <div className="more-participants">
                    +{tournament.participants.length - 8} more
                  </div>
                )}
              </div>
            ) : (
              <p className="no-participants">Be the first to join!</p>
            )}
          </div>
        </motion.div>
      </div>

    </div>
  );
};

export default JoinTournament;
