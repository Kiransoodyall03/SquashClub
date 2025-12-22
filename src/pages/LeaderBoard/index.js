import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Award,
  Target,
  Zap
} from 'lucide-react';
import { getLeaderboard } from '../../firebase/firestore';
import './Leaderboard.css';

const Leaderboard = ({ userProfile }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [filteredLeaderboard, setFilteredLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ageFilter, setAgeFilter] = useState('all');

  const ageGroups = [
    { key: 'all', label: 'All Players', title: 'All Players' },
    { key: 'juniors', label: 'Juniors', title: 'Juniors (Under 13)' },
    { key: 'teenagers', label: 'Teenagers', title: 'Teenagers (Under 18)' },
    { key: 'adults', label: 'Adults', title: 'Adults (18-45)' },
    { key: 'masters', label: 'Masters', title: 'Masters (45+)' }
  ];

  useEffect(() => {
    loadLeaderboard();
  }, []);

  useEffect(() => {
    filterLeaderboard();
  }, [ageFilter, leaderboard]);

  const loadLeaderboard = async () => {
    setLoading(true);
    const data = await getLeaderboard(50);
    setLeaderboard(data);
    setLoading(false);
  };

  const getAgeFromBirthdate = (birthdate) => {
    if (!birthdate) return null;
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const filterLeaderboard = () => {
    if (ageFilter === 'all') {
      setFilteredLeaderboard(leaderboard);
      return;
    }

    const filtered = leaderboard.filter(player => {
      const age = getAgeFromBirthdate(player.birthdate);
      if (age === null) return false;

      switch (ageFilter) {
        case 'juniors':
          return age < 13;
        case 'teenagers':
          return age >= 13 && age < 18;
        case 'adults':
          return age >= 18 && age <= 45;
        case 'masters':
          return age > 45;
        default:
          return true;
      }
    });

    // Reassign ranks for filtered results
    const rankedFiltered = filtered.map((player, index) => ({
      ...player,
      rank: index + 1
    }));

    setFilteredLeaderboard(rankedFiltered);
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Award className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Award className="w-6 h-6 text-orange-600" />;
    return <span className="rank-number">#{rank}</span>;
  };

  const getEloColor = (elo) => {
    if (elo >= 1800) return 'elo-master';
    if (elo >= 1600) return 'elo-expert';
    if (elo >= 1400) return 'elo-advanced';
    if (elo >= 1200) return 'elo-intermediate';
    return 'elo-beginner';
  };

  const getEloRank = (elo) => {
    if (elo >= 1800) return 'Master';
    if (elo >= 1600) return 'Expert';
    if (elo >= 1400) return 'Advanced';
    if (elo >= 1200) return 'Intermediate';
    return 'Beginner';
  };

  const userRank = filteredLeaderboard.findIndex(player => player.id === userProfile?.id) + 1;
  const currentAgeGroup = ageGroups.find(group => group.key === ageFilter);

  return (
    <div className="page-container">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="page-header">
            <div>
              <h1>Leaderboard</h1>
              <p className="page-subtitle">Top players ranked by ELO rating</p>
            </div>
          </div>

          {/* Age Group Filters */}
          <div className="filters-section card">
            <div className="filter-tabs">
              {ageGroups.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAgeFilter(key)}
                  className={`filter-tab ${ageFilter === key ? 'active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Title */}
          <div className="category-title">
            <h2>{currentAgeGroup?.title}</h2>
          </div>

          {/* User's Position Card */}
          {userRank > 0 && (
            <div className="user-rank-card card">
              <div className="user-rank-content">
                <div className="user-rank-info">
                  <h3>Your Rank</h3>
                  <div className="user-rank-stats">
                    <div className="stat-item">
                      <Trophy className="w-5 h-5" />
                      <span className="stat-value">#{userRank}</span>
                    </div>
                    <div className="stat-item">
                      <Target className="w-5 h-5" />
                      <span className="stat-value">{userProfile?.elo || 1200} ELO</span>
                    </div>
                    <div className="stat-item">
                      <Zap className="w-5 h-5" />
                      <span className="stat-value">{getEloRank(userProfile?.elo || 1200)}</span>
                    </div>
                  </div>
                </div>
                <div className={`elo-badge ${getEloColor(userProfile?.elo || 1200)}`}>
                  {getEloRank(userProfile?.elo || 1200)}
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading leaderboard...</p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="empty-state card">
              <Trophy className="w-16 h-16 opacity-20" />
              <h3>No players in this category</h3>
              <p>Check back later or try a different age group</p>
            </div>
          ) : (
            <div className="leaderboard-container card">
              <div className="leaderboard-table">
                {filteredLeaderboard.map((player, index) => (
                  <motion.div
                    key={player.id}
                    className={`leaderboard-row ${player.id === userProfile?.id ? 'current-user' : ''} ${index < 3 ? 'top-three' : ''}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="rank-cell">
                      {getRankIcon(player.rank)}
                    </div>

                    <div className="player-cell">
                      <div className="player-info">
                        <span className="player-name">{player.name}</span>
                        <span className={`player-tier ${getEloColor(player.elo)}`}>
                          {getEloRank(player.elo)}
                        </span>
                      </div>
                    </div>

                    <div className="elo-cell">
                      <div className="elo-value">
                        <span className="elo-number">{player.elo}</span>
                        <span className="elo-label">ELO</span>
                      </div>
                    </div>

                    <div className="stats-cell">
                      <div className="stat-group">
                        <span className="stat-label">Matches</span>
                        <span className="stat-number">{player.matchesPlayed}</span>
                      </div>
                      <div className="stat-group">
                        <span className="stat-label">Won</span>
                        <span className="stat-number win">{player.matchesWon}</span>
                      </div>
                      <div className="stat-group">
                        <span className="stat-label">Win Rate</span>
                        <span className="stat-number">{player.winRate}%</span>
                      </div>
                    </div>

                    {player.id === userProfile?.id && (
                      <div className="you-badge">You</div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Leaderboard;