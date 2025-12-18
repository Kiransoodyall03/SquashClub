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
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('all'); // all, month, week

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    const data = await getLeaderboard(50); // Get top 50
    setLeaderboard(data);
    setLoading(false);
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

  const userRank = leaderboard.findIndex(player => player.id === userProfile?.id) + 1;

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
          ) : leaderboard.length === 0 ? (
            <div className="empty-state card">
              <Trophy className="w-16 h-16 opacity-20" />
              <h3>No players yet</h3>
              <p>Be the first to compete!</p>
            </div>
          ) : (
            <div className="leaderboard-container card">
              <div className="leaderboard-table">
                {leaderboard.map((player, index) => (
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