// src/pages/IndividualMatches.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './IndividualMatches.css';
import { 
  Trophy, 
  Plus, 
  Clock, 
  CheckCircle,
  XCircle,
  Users,
  Zap,
  Coffee,
  ChevronRight,
  Search,
  Filter,
  Calendar
} from 'lucide-react';
import { 
  getIndividualMatchesByPlayer,
  getRecentIndividualMatches
} from '../../firebase/firestore.js';
import { auth } from '../../firebase/config.js';
import CreateMatchModal from 'components/CreateMatchModal';

const IndividualMatches = ({ userProfile }) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, completed, cancelled
  const [modeFilter, setModeFilter] = useState('all'); // all, ranked, casual
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const userMatches = await getIndividualMatchesByPlayer(currentUserId);
      setMatches(userMatches);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
    setLoading(false);
  };

  const filteredMatches = matches.filter(match => {
    const matchesStatus = filter === 'all' || match.status === filter;
    const matchesMode = modeFilter === 'all' || match.matchMode === modeFilter;
    return matchesStatus && matchesMode;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
      case 'in-progress':
        return <Clock className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'pending':
        return 'status-pending';
      case 'in-progress':
        return 'status-active';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTeamDisplay = (team, isUserTeam) => {
    return team.map(p => p.name).join(' & ');
  };

  const isUserInTeam1 = (match) => {
    return match.team1.some(p => p.id === currentUserId);
  };

  const getMatchResult = (match) => {
    if (match.status !== 'completed') return null;
    
    const userInTeam1 = isUserInTeam1(match);
    const userWon = (userInTeam1 && match.winner === 'team1') || 
                   (!userInTeam1 && match.winner === 'team2');
    
    return userWon ? 'won' : 'lost';
  };

  const getEloChange = (match) => {
    if (!match.eloChanges || match.matchMode !== 'ranked') return null;
    return match.eloChanges[currentUserId] || 0;
  };

  const formatScores = (scores) => {
    if (!scores || scores.length === 0) return '-';
    return scores.map(s => `${s.team1}-${s.team2}`).join(', ');
  };

  const handleMatchCreated = () => {
    loadMatches();
  };

  // Stats
  const totalMatches = matches.filter(m => m.status === 'completed').length;
  const rankedMatches = matches.filter(m => m.status === 'completed' && m.matchMode === 'ranked').length;
  const wins = matches.filter(m => {
    if (m.status !== 'completed') return false;
    const userInTeam1 = isUserInTeam1(m);
    return (userInTeam1 && m.winner === 'team1') || (!userInTeam1 && m.winner === 'team2');
  }).length;

  return (
    <div className="page-container individual-matches">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="page-header">
            <div>
              <h1>
                <Trophy className="w-8 h-8" />
                Individual Matches
              </h1>
              <p className="page-subtitle">
                Challenge other players to ranked or casual matches
              </p>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-5 h-5" />
              Create Match
            </button>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{totalMatches}</span>
                <span className="stat-label">Total Matches</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon ranked">
                <Zap className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{rankedMatches}</span>
                <span className="stat-label">Ranked Matches</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon wins">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{wins}</span>
                <span className="stat-label">Wins</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon winrate">
                <Users className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">
                  {totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0}%
                </span>
                <span className="stat-label">Win Rate</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section card">
            <div className="filter-tabs">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'in-progress', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`filter-tab ${filter === key ? 'active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
            
            <div className="mode-filter">
              <Filter className="w-4 h-4" />
              <select 
                value={modeFilter} 
                onChange={(e) => setModeFilter(e.target.value)}
              >
                <option value="all">All Modes</option>
                <option value="ranked">Ranked Only</option>
                <option value="casual">Casual Only</option>
              </select>
            </div>
          </div>

          {/* Matches List */}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading matches...</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="empty-state card">
              <Trophy className="w-16 h-16 opacity-20" />
              <h3>No matches found</h3>
              <p>Create a match to challenge another player!</p>
              <button 
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-5 h-5" />
                Create Your First Match
              </button>
            </div>
          ) : (
            <div className="matches-list">
              {filteredMatches.map((match) => {
                const result = getMatchResult(match);
                const eloChange = getEloChange(match);
                const userInTeam1 = isUserInTeam1(match);
                
                return (
                  <motion.div
                    key={match.id}
                    className={`match-card card ${result ? `result-${result}` : ''}`}
                    whileHover={{ y: -2 }}
                    onClick={() => navigate(`/match/${match.id}`)}
                  >
                    <div className="match-header">
                      <div className="match-mode">
                        {match.matchMode === 'ranked' ? (
                          <span className="mode-badge ranked">
                            <Zap className="w-3 h-3" />
                            Ranked
                          </span>
                        ) : (
                          <span className="mode-badge casual">
                            <Coffee className="w-3 h-3" />
                            Casual
                          </span>
                        )}
                        <span className="match-type">{match.matchType}</span>
                      </div>
                      <span className={`status-badge ${getStatusClass(match.status)}`}>
                        {getStatusIcon(match.status)}
                        {match.status}
                      </span>
                    </div>

                    <div className="match-teams">
                      <div className={`team team-1 ${userInTeam1 ? 'user-team' : ''} ${match.winner === 'team1' ? 'winner' : ''}`}>
                        <span className="team-players">
                          {getTeamDisplay(match.team1)}
                        </span>
                        {userInTeam1 && <span className="you-indicator">You</span>}
                      </div>
                      
                      <div className="vs-badge">
                        {match.status === 'completed' ? (
                          <span className="score">{formatScores(match.scores)}</span>
                        ) : (
                          <span>VS</span>
                        )}
                      </div>
                      
                      <div className={`team team-2 ${!userInTeam1 ? 'user-team' : ''} ${match.winner === 'team2' ? 'winner' : ''}`}>
                        <span className="team-players">
                          {getTeamDisplay(match.team2)}
                        </span>
                        {!userInTeam1 && <span className="you-indicator">You</span>}
                      </div>
                    </div>

                    <div className="match-footer">
                      <div className="match-info">
                        <span className="match-format">{match.format}</span>
                        <span className="match-date">
                          <Calendar className="w-3 h-3" />
                          {formatDate(match.createdAt)}
                        </span>
                      </div>
                      
                      {result && (
                        <div className={`match-result ${result}`}>
                          <span className="result-text">{result === 'won' ? 'Victory' : 'Defeat'}</span>
                          {eloChange !== null && eloChange !== 0 && (
                            <span className={`elo-change ${eloChange > 0 ? 'positive' : 'negative'}`}>
                              {eloChange > 0 ? '+' : ''}{eloChange} ELO
                            </span>
                          )}
                        </div>
                      )}
                      
                      <ChevronRight className="chevron-icon" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create Match Modal */}
      <CreateMatchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onMatchCreated={handleMatchCreated}
        userProfile={userProfile}
      />
    </div>
  );
};

export default IndividualMatches;