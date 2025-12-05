// src/pages/IndividualMatches.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
} from '../firebase/firestore';
import { auth } from '../firebase/config';
import CreateMatchModal from '../components/CreateMatchModal';

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
                        <span className="match-format">
                          {match.format?.replace('-', ' ')} • {match.pointsPerGame} pts
                        </span>
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

      <style>{`
        .individual-matches {
          min-height: calc(100vh - 70px);
          padding: var(--spacing-2xl) 0;
          background: var(--off-white);
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-xl);
        }

        .page-header h1 {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-xs);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .stat-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          box-shadow: var(--shadow-sm);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          background: var(--light-gray);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray);
        }

        .stat-icon.ranked {
          background: rgba(255, 107, 53, 0.1);
          color: var(--primary);
        }

        .stat-icon.wins {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .stat-icon.winrate {
          background: rgba(33, 150, 243, 0.1);
          color: #2196F3;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--secondary);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--gray);
        }

        .filters-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-xl);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }

        .filter-tabs {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .filter-tab {
          padding: var(--spacing-sm) var(--spacing-md);
          background: transparent;
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-base);
          color: var(--dark-gray);
          font-weight: 500;
          font-size: 0.875rem;
        }

        .filter-tab:hover {
          background: var(--light-gray);
        }

        .filter-tab.active {
          background: var(--gradient-primary);
          color: var(--white);
          border-color: transparent;
        }

        .mode-filter {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--gray);
        }

        .mode-filter select {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-md);
          background: var(--white);
          cursor: pointer;
        }

        .matches-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .match-card {
          cursor: pointer;
          transition: all var(--transition-base);
          position: relative;
          overflow: hidden;
        }

        .match-card:hover {
          box-shadow: var(--shadow-lg);
        }

        .match-card.result-won {
          border-left: 4px solid var(--success);
        }

        .match-card.result-lost {
          border-left: 4px solid var(--danger);
        }

        .match-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
        }

        .match-mode {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .mode-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .mode-badge.ranked {
          background: rgba(255, 107, 53, 0.1);
          color: var(--primary);
        }

        .mode-badge.casual {
          background: rgba(158, 158, 158, 0.1);
          color: var(--gray);
        }

        .match-type {
          font-size: 0.875rem;
          color: var(--gray);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-completed {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .status-pending {
          background: rgba(255, 152, 0, 0.1);
          color: #FF9800;
        }

        .status-active {
          background: rgba(33, 150, 243, 0.1);
          color: #2196F3;
        }

        .status-cancelled {
          background: rgba(244, 67, 54, 0.1);
          color: var(--danger);
        }

        .match-teams {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-md) 0;
          gap: var(--spacing-md);
        }

        .team {
          flex: 1;
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          position: relative;
        }

        .team.user-team {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid var(--success);
        }

        .team.winner {
          background: rgba(255, 215, 0, 0.1);
          border: 2px solid #FFD700;
        }

        .team-players {
          font-weight: 600;
          color: var(--secondary);
          display: block;
        }

        .you-indicator {
          position: absolute;
          top: var(--spacing-xs);
          right: var(--spacing-xs);
          font-size: 0.625rem;
          padding: 2px 6px;
          background: var(--success);
          color: var(--white);
          border-radius: var(--radius-sm);
          font-weight: 600;
        }

        .vs-badge {
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--secondary);
          color: var(--white);
          font-weight: 700;
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          text-align: center;
          min-width: 60px;
        }

        .vs-badge .score {
          font-family: monospace;
        }

        .match-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--light-gray);
          margin-top: var(--spacing-md);
        }

        .match-info {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .match-format {
          font-size: 0.875rem;
          color: var(--primary);
          font-weight: 500;
        }

        .match-date {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.75rem;
          color: var(--gray);
        }

        .match-result {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--spacing-xs);
        }

        .result-text {
          font-weight: 700;
          font-size: 0.875rem;
        }

        .match-result.won .result-text {
          color: var(--success);
        }

        .match-result.lost .result-text {
          color: var(--danger);
        }

        .elo-change {
          font-size: 0.75rem;
          font-weight: 600;
        }

        .elo-change.positive {
          color: var(--success);
        }

        .elo-change.negative {
          color: var(--danger);
        }

        .chevron-icon {
          color: var(--gray);
          transition: transform var(--transition-base);
        }

        .match-card:hover .chevron-icon {
          transform: translateX(4px);
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-2xl);
          text-align: center;
          color: var(--gray);
        }

        .empty-state h3 {
          margin: var(--spacing-md) 0 var(--spacing-xs);
          color: var(--secondary);
        }

        .empty-state .btn {
          margin-top: var(--spacing-lg);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--light-gray);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            gap: var(--spacing-md);
          }

          .page-header .btn {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filters-section {
            flex-direction: column;
            align-items: stretch;
          }

          .match-teams {
            flex-direction: column;
          }

          .team {
            width: 100%;
          }

          .vs-badge {
            margin: var(--spacing-sm) 0;
          }
        }
      `}</style>
    </div>
  );
};

export default IndividualMatches;