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
} from '../../firebase/firestore';
import './Profile.css';

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
                    <span className="match-tournament">{match.contextDisplay}</span>
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
    </div>
  );
};

export default Profile;