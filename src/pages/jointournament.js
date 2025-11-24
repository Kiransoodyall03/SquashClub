import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, Users, Trophy, LogIn } from 'lucide-react';
import { getTournament, joinTournament, getUserProfile } from '../firebase/firestore';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

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

      <style jsx>{`
        .join-tournament-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xl);
          background: linear-gradient(135deg, var(--light-gray) 0%, rgba(255, 107, 53, 0.1) 100%);
        }

        .loading-container,
        .error-container {
          text-align: center;
          padding: var(--spacing-3xl);
        }

        .error-container h2 {
          margin-bottom: var(--spacing-md);
        }

        .error-container p {
          margin-bottom: var(--spacing-xl);
          color: var(--gray);
        }

        .join-card {
          max-width: 600px;
          width: 100%;
          padding: 0;
          overflow: hidden;
        }

        .tournament-banner {
          background: var(--gradient-primary);
          color: var(--white);
          padding: var(--spacing-2xl);
          text-align: center;
        }

        .banner-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto var(--spacing-md);
        }

        .tournament-banner h1 {
          margin: 0;
          color: var(--white);
          font-size: 2rem;
        }

        .tournament-details {
          padding: var(--spacing-2xl);
        }

        .tournament-details h2 {
          text-align: center;
          margin-bottom: var(--spacing-xl);
          color: var(--secondary);
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .detail-item {
          display: flex;
          align-items: start;
          gap: var(--spacing-sm);
        }

        .detail-item > div {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .detail-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--gray);
        }

        .detail-value {
          font-weight: 600;
          color: var(--secondary);
        }

        .tournament-description {
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-xl);
        }

        .tournament-description p {
          margin: 0;
        }

        .error-message {
          padding: var(--spacing-md);
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid var(--danger);
          border-radius: var(--radius-md);
          color: var(--danger);
          margin-bottom: var(--spacing-lg);
          text-align: center;
        }

        .join-actions {
          text-align: center;
        }

        .join-prompt {
          margin-bottom: var(--spacing-lg);
          color: var(--dark-gray);
        }

        .auth-buttons {
          display: flex;
          gap: var(--spacing-md);
          justify-content: center;
          flex-wrap: wrap;
        }

        .already-joined,
        .tournament-full {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
          background: var(--light-gray);
          border-radius: var(--radius-md);
        }

        .already-joined {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .tournament-full {
          background: rgba(255, 167, 38, 0.1);
          color: var(--warning);
        }

        .participants-preview {
          padding: var(--spacing-xl);
          background: var(--light-gray);
          border-top: 1px solid var(--light-gray);
        }

        .participants-preview h3 {
          margin-bottom: var(--spacing-md);
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--dark-gray);
        }

        .participants-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }

        .participant-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-xs) var(--spacing-md);
          background: var(--white);
          border-radius: var(--radius-full);
          border: 1px solid var(--light-gray);
        }

        .participant-name {
          font-weight: 500;
          color: var(--secondary);
        }

        .participant-elo {
          font-size: 0.75rem;
          color: var(--primary);
          font-weight: 600;
        }

        .more-participants {
          display: inline-flex;
          align-items: center;
          padding: var(--spacing-xs) var(--spacing-md);
          color: var(--gray);
          font-style: italic;
        }

        .no-participants {
          text-align: center;
          color: var(--gray);
          font-style: italic;
        }

        @media (max-width: 600px) {
          .details-grid {
            grid-template-columns: 1fr;
          }

          .auth-buttons {
            flex-direction: column;
            width: 100%;
          }

          .auth-buttons .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default JoinTournament;