// src/components/Profile.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Calendar, 
  Trophy, 
  Target, 
  Activity,
  Edit,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { 
  updateUserProfile, 
  getUserProfile,
  getPlayerTournaments,
  getPlayerMatchHistory
} from '../firebase/firestore';

const Profile = ({ user, userProfile: initialUserProfile }) => {
  const [userProfile, setUserProfile] = useState(initialUserProfile);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: initialUserProfile?.firstName || '',
    lastName: initialUserProfile?.lastName || '',
    age: initialUserProfile?.age || ''
  });
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [matchStats, setMatchStats] = useState({
  totalPointsScored: 0,
  totalPointsConceded: 0,
  avgPointsScored: 0,
  avgPointsConceded: 0
});

  useEffect(() => {
    loadProfileData();
  }, [user?.uid]);

  const loadProfileData = async () => {
    if (!user?.uid) return;
    
    setStatsLoading(true);
    
    // Refresh user profile to get latest stats
    const freshProfile = await getUserProfile(user.uid);
    if (freshProfile) {
      setUserProfile(freshProfile);
      setFormData({
        firstName: freshProfile.firstName || '',
        lastName: freshProfile.lastName || '',
        age: freshProfile.age || ''
      });
    }
    
    // Load tournament history
    const playerTournaments = await getPlayerTournaments(user.uid);
    setTournaments(playerTournaments);
    
    // Load recent matches
    const matchHistory = await getPlayerMatchHistory(user.uid);
    setRecentMatches(matchHistory.slice(0, 10));
    
    // Calculate match statistics
    if (matchHistory.length > 0) {
      let totalScored = 0;
      let totalConceded = 0;
      let completedMatches = 0;
      
      matchHistory.forEach(match => {
        if (match.status === 'completed') {
          totalScored += match.playerScore || 0;
          totalConceded += match.opponentScore || 0;
          completedMatches++;
        }
      });
      
      setMatchStats({
        totalPointsScored: totalScored,
        totalPointsConceded: totalConceded,
        avgPointsScored: completedMatches > 0 ? (totalScored / completedMatches).toFixed(1) : 0,
        avgPointsConceded: completedMatches > 0 ? (totalConceded / completedMatches).toFixed(1) : 0
      });
    }
    
    setStatsLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    setLoading(true);
    
    await updateUserProfile(user.uid, formData);
    
    // Refresh profile
    const freshProfile = await getUserProfile(user.uid);
    if (freshProfile) {
      setUserProfile(freshProfile);
    }
    
    setEditMode(false);
    setLoading(false);
  };

  const handleCancel = () => {
    setFormData({
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || '',
      age: userProfile?.age || ''
    });
    setEditMode(false);
  };

  const winRate = userProfile?.matchesPlayed > 0 
    ? Math.round((userProfile.matchesWon / userProfile.matchesPlayed) * 100)
    : 0;

  const lossCount = (userProfile?.matchesPlayed || 0) - (userProfile?.matchesWon || 0);

  return (
    <div className="profile-page">
      <div className="container">
        <motion.div 
          className="profile-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>My Profile</h1>
          {!editMode && (
            <button 
              className="btn btn-primary"
              onClick={() => setEditMode(true)}
            >
              <Edit className="w-5 h-5" />
              Edit Profile
            </button>
          )}
        </motion.div>

        {/* Main Stats Overview */}
        <motion.div 
          className="stats-overview"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="main-stat elo-stat">
            <div className="stat-icon-large">
              <Trophy className="w-8 h-8" />
            </div>
            <div className="stat-content">
              <span className="stat-label">Current ELO Rating</span>
              <span className="stat-value-large">{userProfile?.elo || 1200}</span>
              {userProfile?.lastEloChange !== undefined && userProfile?.lastEloChange !== 0 && (
                <span className={`elo-change-badge ${userProfile.lastEloChange > 0 ? 'positive' : 'negative'}`}>
                  {userProfile.lastEloChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {userProfile.lastEloChange > 0 ? '+' : ''}{userProfile.lastEloChange} from last tournament
                </span>
              )}
            </div>
          </div>

          <div className="stats-grid-small">
            <div className="mini-stat">
              <Activity className="w-5 h-5" />
              <div>
                <span className="mini-stat-value">{userProfile?.matchesPlayed || 0}</span>
                <span className="mini-stat-label">Matches Played</span>
              </div>
            </div>
            
            <div className="mini-stat">
              <Award className="w-5 h-5" />
              <div>
                <span className="mini-stat-value won">{userProfile?.matchesWon || 0}</span>
                <span className="mini-stat-label">Matches Won</span>
              </div>
            </div>
            
            <div className="mini-stat">
              <X className="w-5 h-5" />
              <div>
                <span className="mini-stat-value lost">{lossCount}</span>
                <span className="mini-stat-label">Matches Lost</span>
              </div>
            </div>
            
            <div className="mini-stat">
              <Target className="w-5 h-5" />
              <div>
                <span className="mini-stat-value">{winRate}%</span>
                <span className="mini-stat-label">Win Rate</span>
              </div>
            </div>
            
            <div className="mini-stat">
              <Calendar className="w-5 h-5" />
              <div>
                <span className="mini-stat-value">{userProfile?.tournamentsPlayed || 0}</span>
                <span className="mini-stat-label">Tournaments</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="profile-content">
          {/* Personal Information */}
          <motion.div 
            className="profile-section card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2>Personal Information</h2>
            
            {editMode ? (
              <div className="edit-form">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    className="form-input"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    className="form-input"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input
                    type="number"
                    name="age"
                    className="form-input"
                    value={formData.age}
                    onChange={handleChange}
                    min="16"
                    max="100"
                  />
                </div>
                
                <div className="edit-actions">
                  <button 
                    className="btn btn-outline"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <X className="w-5 h-5" />
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    <Save className="w-5 h-5" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-info">
                <div className="info-row">
                  <User className="w-5 h-5" />
                  <div>
                    <span className="info-label">Full Name</span>
                    <span className="info-value">
                      {userProfile?.firstName} {userProfile?.lastName}
                    </span>
                  </div>
                </div>
                
                <div className="info-row">
                  <Mail className="w-5 h-5" />
                  <div>
                    <span className="info-label">Email</span>
                    <span className="info-value">{user?.email}</span>
                  </div>
                </div>
                
                <div className="info-row">
                  <Calendar className="w-5 h-5" />
                  <div>
                    <span className="info-label">Age</span>
                    <span className="info-value">{userProfile?.age || '-'} years</span>
                  </div>
                </div>

                <div className="info-row">
                  <Award className="w-5 h-5" />
                  <div>
                    <span className="info-label">Account Type</span>
                    <span className="info-value badge-inline">
                      {userProfile?.role === 'owner' ? 'Club Owner' : 'Player'}
                    </span>
                  </div>
                </div>

                <div className="info-row">
                  <Clock className="w-5 h-5" />
                  <div>
                    <span className="info-label">Member Since</span>
                    <span className="info-value">
                      {new Date(userProfile?.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

        {/* Win/Loss Visual */}
        <motion.div 
          className="profile-section card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2>Performance Overview</h2>
          
          {userProfile?.matchesPlayed > 0 ? (
            <>
              <div className="win-loss-bar">
                <div 
                  className="win-portion" 
                  style={{ width: `${winRate}%` }}
                >
                  {winRate > 15 && <span>{userProfile?.matchesWon} W</span>}
                </div>
                <div 
                  className="loss-portion" 
                  style={{ width: `${100 - winRate}%` }}
                >
                  {(100 - winRate) > 15 && <span>{lossCount} L</span>}
                </div>
              </div>
              
              <div className="win-loss-legend">
                <div className="legend-item">
                  <span className="legend-color win"></span>
                  <span>Wins ({userProfile?.matchesWon})</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color loss"></span>
                  <span>Losses ({lossCount})</span>
                </div>
              </div>

              <div className="performance-stats">
                <div className="perf-stat-grid">
                  <div className="perf-stat-item">
                    <TrendingUp className="w-5 h-5 stat-icon-positive" />
                    <div className="perf-stat-content">
                      <span className="perf-stat-value">{matchStats.avgPointsScored}</span>
                      <span className="perf-stat-label">Avg Points Scored</span>
                    </div>
                  </div>
                  
                  <div className="perf-stat-item">
                    <TrendingDown className="w-5 h-5 stat-icon-negative" />
                    <div className="perf-stat-content">
                      <span className="perf-stat-value">{matchStats.avgPointsConceded}</span>
                      <span className="perf-stat-label">Avg Points Conceded</span>
                    </div>
                  </div>
                  
                  <div className="perf-stat-item">
                    <Target className="w-5 h-5 stat-icon-neutral" />
                    <div className="perf-stat-content">
                      <span className={`perf-stat-value ${matchStats.totalPointsScored - matchStats.totalPointsConceded >= 0 ? 'positive' : 'negative'}`}>
                        {matchStats.totalPointsScored - matchStats.totalPointsConceded >= 0 ? '+' : ''}
                        {matchStats.totalPointsScored - matchStats.totalPointsConceded}
                      </span>
                      <span className="perf-stat-label">Point Differential</span>
                    </div>
                  </div>
                  
                  <div className="perf-stat-item">
                    <BarChart3 className="w-5 h-5 stat-icon-neutral" />
                    <div className="perf-stat-content">
                      <span className="perf-stat-value">{matchStats.totalPointsScored}</span>
                      <span className="perf-stat-label">Total Points Scored</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-performance">
              <Activity className="w-12 h-12" />
              <p>No matches played yet</p>
              <span>Join a tournament to start tracking your performance!</span>
            </div>
          )}
        </motion.div>
        </div>

        {/* Recent Matches */}
        <motion.div 
          className="matches-section card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="section-header">
            <h2>Recent Matches</h2>
          </div>
          
          {statsLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading matches...</p>
            </div>
          ) : recentMatches.length > 0 ? (
            <div className="matches-list">
              {recentMatches.map((match, index) => (
                <div 
                  key={match.id} 
                  className={`match-item ${match.won ? 'won' : 'lost'}`}
                >
                  <div className="match-result-badge">
                    {match.won ? 'W' : 'L'}
                  </div>
                  <div className="match-details">
                    <span className="opponent-name">vs {match.opponentName}</span>
                    <span className="match-score">{match.scoreDisplay}</span>
                  </div>
                  <div className="match-meta">
                    <span className="match-tournament">{match.groupName}</span>
                    <span className="match-format">{match.format}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No matches played yet</p>
            </div>
          )}
        </motion.div>

        {/* Tournament History */}
        <motion.div 
          className="tournaments-section card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="section-header">
            <h2>Tournament History</h2>
          </div>
          
          {statsLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading tournaments...</p>
            </div>
          ) : tournaments.length > 0 ? (
            <div className="tournament-history-list">
              {tournaments.map((tournament, index) => (
                <Link 
                  key={tournament.id} 
                  to={`/tournament/${tournament.id}`}
                  className="tournament-history-item"
                >
                  <div className="tournament-info">
                    <span className="tournament-name">{tournament.name}</span>
                    <span className="tournament-date">
                      <Calendar className="w-4 h-4" />
                      {new Date(tournament.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="tournament-status">
                    <span className={`badge badge-${tournament.status}`}>
                      {tournament.status}
                    </span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Trophy className="w-12 h-12" />
              <p>No tournaments joined yet</p>
              <Link to="/tournaments" className="btn btn-primary">
                Browse Tournaments
              </Link>
            </div>
          )}
        </motion.div>
      </div>

      <style>{`
      /* Performance Stats Grid */
      .performance-stats {
        margin-top: var(--spacing-lg);
        padding-top: var(--spacing-lg);
        border-top: 1px solid var(--light-gray);
      }

      .perf-stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-md);
      }

      .perf-stat-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-md);
        background: var(--light-gray);
        border-radius: var(--radius-md);
      }

      .perf-stat-content {
        display: flex;
        flex-direction: column;
      }

      .perf-stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--secondary);
      }

      .perf-stat-value.positive {
        color: var(--success);
      }

      .perf-stat-value.negative {
        color: #f44336;
      }

      .perf-stat-label {
        font-size: 0.75rem;
        color: var(--gray);
        text-transform: uppercase;
      }

      .stat-icon-positive {
        color: var(--success);
      }

      .stat-icon-negative {
        color: #f44336;
      }

      .stat-icon-neutral {
        color: var(--primary);
      }

      @media (max-width: 500px) {
        .perf-stat-grid {
          grid-template-columns: 1fr;
        }
      }
        .profile-page {
          min-height: calc(100vh - 70px);
          padding: var(--spacing-2xl) 0;
          background: var(--off-white);
        }

        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-2xl);
        }

        .profile-header h1 {
          margin: 0;
        }

        /* Stats Overview */
        .stats-overview {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          margin-bottom: var(--spacing-xl);
        }

        .main-stat {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
          padding-bottom: var(--spacing-xl);
          border-bottom: 1px solid var(--light-gray);
          margin-bottom: var(--spacing-xl);
        }

        .stat-icon-large {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-primary);
          border-radius: var(--radius-lg);
          color: var(--white);
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--gray);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-value-large {
          font-size: 3rem;
          font-weight: 700;
          color: var(--secondary);
          line-height: 1;
        }

        .elo-change-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .elo-change-badge.positive {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .elo-change-badge.negative {
          background: rgba(244, 67, 54, 0.1);
          color: #f44336;
        }

        .stats-grid-small {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-lg);
        }

        .mini-stat {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          min-width: 150px;
        }

        .mini-stat > svg {
          color: var(--primary);
        }

        .mini-stat > div {
          display: flex;
          flex-direction: column;
        }

        .mini-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--secondary);
        }

        .mini-stat-value.won {
          color: var(--success);
        }

        .mini-stat-value.lost {
          color: #f44336;
        }

        .mini-stat-label {
          font-size: 0.75rem;
          color: var(--gray);
          text-transform: uppercase;
        }

        /* Profile Content */
        .profile-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-xl);
          margin-bottom: var(--spacing-xl);
        }

        .profile-section {
          padding: var(--spacing-xl);
        }

        .profile-section h2 {
          margin-bottom: var(--spacing-lg);
          font-size: 1.25rem;
        }

        .profile-info {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .info-row {
          display: flex;
          align-items: start;
          gap: var(--spacing-md);
        }

        .info-row > svg {
          color: var(--primary);
          margin-top: 2px;
        }

        .info-row > div {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .info-label {
          font-size: 0.75rem;
          color: var(--gray);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .info-value {
          font-size: 1rem;
          font-weight: 600;
          color: var(--secondary);
        }

        .badge-inline {
          display: inline-block;
          padding: 2px 8px;
          background: var(--primary);
          color: white;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
        }

        .edit-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .edit-actions {
          display: flex;
          gap: var(--spacing-md);
          margin-top: var(--spacing-lg);
        }

        /* Win/Loss Bar */
        .win-loss-bar {
          display: flex;
          height: 40px;
          border-radius: var(--radius-md);
          overflow: hidden;
          margin-bottom: var(--spacing-md);
        }

        .win-portion {
          background: var(--success);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          transition: width 0.3s ease;
        }

        .loss-portion {
          background: #f44336;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          transition: width 0.3s ease;
        }

        .win-loss-legend {
          display: flex;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-lg);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          color: var(--gray);
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .legend-color.win {
          background: var(--success);
        }

        .legend-color.loss {
          background: #f44336;
        }

        .empty-performance {
          text-align: center;
          padding: var(--spacing-xl);
          color: var(--gray);
        }

        .empty-performance svg {
          margin-bottom: var(--spacing-md);
          opacity: 0.3;
        }

        .empty-performance p {
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
        }

        .empty-performance span {
          font-size: 0.875rem;
        }

        /* Matches Section */
        .matches-section,
        .tournaments-section {
          padding: var(--spacing-xl);
          margin-bottom: var(--spacing-xl);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
        }

        .section-header h2 {
          margin: 0;
          font-size: 1.25rem;
        }

        .matches-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .match-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          border-left: 4px solid;
        }

        .match-item.won {
          border-left-color: var(--success);
        }

        .match-item.lost {
          border-left-color: #f44336;
        }

        .match-result-badge {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          font-weight: 700;
          font-size: 0.875rem;
        }

        .match-item.won .match-result-badge {
          background: var(--success);
          color: white;
        }

        .match-item.lost .match-result-badge {
          background: #f44336;
          color: white;
        }

        .match-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .opponent-name {
          font-weight: 600;
          color: var(--secondary);
        }

        .match-score {
          font-family: monospace;
          font-size: 0.875rem;
          color: var(--gray);
        }

        .match-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          font-size: 0.75rem;
          color: var(--gray);
        }

        /* Tournament History */
        .tournament-history-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .tournament-history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          text-decoration: none;
          color: inherit;
          transition: all var(--transition-base);
        }

        .tournament-history-item:hover {
          background: var(--off-white);
          transform: translateX(4px);
        }

        .tournament-info {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .tournament-name {
          font-weight: 600;
          color: var(--secondary);
        }

        .tournament-date {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          color: var(--gray);
        }

        .tournament-status {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .badge {
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-upcoming {
          background: rgba(33, 150, 243, 0.1);
          color: #2196F3;
        }

        .badge-active {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .badge-completed {
          background: rgba(158, 158, 158, 0.1);
          color: var(--gray);
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-2xl);
          color: var(--gray);
        }

        .empty-state svg {
          margin-bottom: var(--spacing-md);
          opacity: 0.3;
        }

        .empty-state p {
          margin-bottom: var(--spacing-lg);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-xl);
          color: var(--gray);
        }

        @media (max-width: 768px) {
          .profile-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-md);
          }

          .profile-content {
            grid-template-columns: 1fr;
          }

          .stats-grid-small {
            flex-direction: column;
          }

          .main-stat {
            flex-direction: column;
            text-align: center;
          }

          .stat-value-large {
            font-size: 2.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Profile;