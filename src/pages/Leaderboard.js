import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Award,
  Target,
  Zap
} from 'lucide-react';
import { getLeaderboard } from '../firebase/firestore';

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

      <style>{`
        .user-rank-card {
          margin-bottom: var(--spacing-xl);
          background: var(--gradient-primary);
          color: var(--white);
        }

        .user-rank-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--spacing-lg);
        }

        .user-rank-info h3 {
          margin: 0 0 var(--spacing-md) 0;
          font-size: 1.25rem;
          opacity: 0.9;
        }

        .user-rank-stats {
          display: flex;
          gap: var(--spacing-xl);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .elo-badge {
          padding: var(--spacing-md) var(--spacing-lg);
          border-radius: var(--radius-lg);
          font-size: 1.25rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.2);
        }

        .leaderboard-container {
          padding: 0;
          overflow: hidden;
        }

        .leaderboard-table {
          display: flex;
          flex-direction: column;
        }

        .leaderboard-row {
          display: grid;
          grid-template-columns: 80px 1fr 120px 300px;
          align-items: center;
          padding: var(--spacing-lg) var(--spacing-xl);
          border-bottom: 1px solid var(--light-gray);
          transition: all var(--transition-base);
          position: relative;
        }

        .leaderboard-row:last-child {
          border-bottom: none;
        }

        .leaderboard-row:hover {
          background: var(--light-gray);
        }

        .leaderboard-row.current-user {
          background: rgba(59, 130, 246, 0.1);
          border-left: 4px solid var(--primary);
        }

        .leaderboard-row.top-three {
          background: linear-gradient(to right, rgba(255, 215, 0, 0.05), transparent);
        }

        .rank-cell {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rank-number {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--gray);
        }

        .player-cell {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .player-info {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .player-name {
          font-weight: 600;
          font-size: 1rem;
          color: var(--secondary);
        }

        .player-tier {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .elo-cell {
          display: flex;
          justify-content: center;
        }

        .elo-value {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .elo-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }

        .elo-label {
          font-size: 0.75rem;
          color: var(--gray);
          text-transform: uppercase;
        }

        .stats-cell {
          display: flex;
          gap: var(--spacing-lg);
          justify-content: flex-end;
        }

        .stat-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 60px;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--gray);
          margin-bottom: var(--spacing-xs);
        }

        .stat-number {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--secondary);
        }

        .stat-number.win {
          color: var(--success);
        }

        .you-badge {
          position: absolute;
          top: var(--spacing-sm);
          right: var(--spacing-sm);
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--primary);
          color: var(--white);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
        }

        /* ELO Color Classes */
        .elo-master { color: #a855f7; }
        .elo-expert { color: #ef4444; }
        .elo-advanced { color: #f59e0b; }
        .elo-intermediate { color: #3b82f6; }
        .elo-beginner { color: #6b7280; }

        .loading-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xxl);
          gap: var(--spacing-md);
        }

        .empty-state {
          text-align: center;
          color: var(--gray);
        }

        @media (max-width: 1024px) {
          .leaderboard-row {
            grid-template-columns: 60px 1fr 100px 200px;
            padding: var(--spacing-md) var(--spacing-lg);
          }

          .stats-cell {
            gap: var(--spacing-md);
          }
        }

        @media (max-width: 768px) {
          .leaderboard-row {
            grid-template-columns: 50px 1fr 80px;
            padding: var(--spacing-md);
          }

          .stats-cell {
            display: none;
          }

          .user-rank-stats {
            flex-direction: column;
            gap: var(--spacing-sm);
          }

          .user-rank-content {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Leaderboard;