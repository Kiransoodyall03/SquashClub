import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  TrendingUp, 
  Calendar, 
  Target,
  Award,
  Clock,
  Users,
  Activity
} from 'lucide-react';
import { 
  getTournaments, 
  getPlayerStatistics,
  getLeaderboard 
} from '../firebase/firestore';
import { auth } from '../firebase/config';

const PlayerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [upcomingTournaments, setUpcomingTournaments] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const userId = auth.currentUser?.uid;
    
    if (userId) {
      // Load player statistics
      const playerStats = await getPlayerStatistics(userId);
      setStats(playerStats);
      
      // Load upcoming tournaments
      const tournaments = await getTournaments({ status: 'upcoming' });
      setUpcomingTournaments(tournaments.slice(0, 3));
      
      // Load leaderboard
      const leaderboardData = await getLeaderboard(5);
      setLeaderboard(leaderboardData);
    }
    
    setLoading(false);
  };

  const getEloTrend = () => {
    if (!stats?.lastEloChange) return null;
    return stats.lastEloChange > 0 ? 'positive' : 'negative';
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="container">
        <motion.div 
          className="dashboard-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>Player Dashboard</h1>
          <p>Track your progress and upcoming matches</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <motion.div 
            className="stat-card card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="stat-icon">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Current ELO</h3>
              <div className="stat-value">
                <span className="elo-badge">{stats?.currentElo || 1200}</span>
                {stats?.lastEloChange && (
                  <span className={`elo-change ${getEloTrend()}`}>
                    {stats.lastEloChange > 0 ? '+' : ''}{stats.lastEloChange}
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="stat-card card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="stat-icon">
              <Target className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Win Rate</h3>
              <div className="stat-value">
                <span className="stat-number">{stats?.winRate || 0}%</span>
                <span className="stat-subtitle">
                  {stats?.matchesWon || 0}/{stats?.matchesPlayed || 0} wins
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="stat-card card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="stat-icon">
              <Activity className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Matches Played</h3>
              <div className="stat-value">
                <span className="stat-number">{stats?.matchesPlayed || 0}</span>
                <span className="stat-subtitle">Total matches</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="stat-card card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="stat-icon">
              <Award className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Tournaments</h3>
              <div className="stat-value">
                <span className="stat-number">{stats?.tournamentsPlayed || 0}</span>
                <span className="stat-subtitle">Participated</span>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="dashboard-content">
          {/* Upcoming Tournaments */}
          <motion.div 
            className="content-section"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="section-header">
              <h2>
                <Calendar className="w-6 h-6" />
                Upcoming Tournaments
              </h2>
              <Link to="/tournaments" className="btn btn-ghost btn-small">
                View All
              </Link>
            </div>
            
            <div className="tournaments-list">
              {upcomingTournaments.length > 0 ? (
                upcomingTournaments.map((tournament, index) => (
                  <motion.div 
                    key={tournament.id}
                    className="tournament-card card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    <div className="tournament-info">
                      <h4>{tournament.name}</h4>
                      <div className="tournament-details">
                        <span className="tournament-date">
                          <Clock className="w-4 h-4" />
                          {new Date(tournament.date).toLocaleDateString()}
                        </span>
                        <span className="tournament-players">
                          <Users className="w-4 h-4" />
                          {tournament.participants?.length || 0} players
                        </span>
                      </div>
                    </div>
                    <div className="tournament-actions">
                      <Link 
                        to={`/tournament/${tournament.id}`} 
                        className="btn btn-primary btn-small"
                      >
                        View Details
                      </Link>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No upcoming tournaments</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div 
            className="content-section"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="section-header">
              <h2>
                <TrendingUp className="w-6 h-6" />
                Club Leaderboard
              </h2>
              <Link to="/leaderboard" className="btn btn-ghost btn-small">
                Full Rankings
              </Link>
            </div>
            
            <div className="leaderboard">
              {leaderboard.map((player, index) => (
                <motion.div 
                  key={player.id}
                  className="leaderboard-item"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.05 }}
                >
                  <div className="leaderboard-rank">
                    {player.rank <= 3 ? (
                      <div className={`rank-badge rank-${player.rank}`}>
                        {player.rank}
                      </div>
                    ) : (
                      <span className="rank-number">{player.rank}</span>
                    )}
                  </div>
                  <div className="leaderboard-player">
                    <span className="player-name">{player.name}</span>
                    <span className="player-stats">
                      {player.matchesPlayed} matches • {player.winRate}% win rate
                    </span>
                  </div>
                  <div className="leaderboard-elo">
                    <span className="elo-value">{player.elo}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        .dashboard {
          min-height: calc(100vh - 80px);
          padding: var(--spacing-2xl) 0;
          background: var(--off-white);
        }

        .dashboard-loading {
          min-height: 50vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dashboard-header {
          margin-bottom: var(--spacing-2xl);
        }

        .dashboard-header h1 {
          margin-bottom: var(--spacing-sm);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-2xl);
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
          padding: var(--spacing-lg);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-primary);
          border-radius: var(--radius-md);
          color: var(--white);
        }

        .stat-content h3 {
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--gray);
          margin-bottom: var(--spacing-sm);
        }

        .stat-value {
          display: flex;
          align-items: baseline;
          gap: var(--spacing-sm);
        }

        .stat-number {
          font-size: 2rem;
          font-weight: 700;
          color: var(--secondary);
        }

        .stat-subtitle {
          font-size: 0.875rem;
          color: var(--gray);
        }

        .dashboard-content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: var(--spacing-xl);
          margin-bottom: var(--spacing-2xl);
        }

        .content-section {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-lg);
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: 1.5rem;
        }

        .tournaments-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .tournament-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-md);
        }

        .tournament-info h4 {
          margin-bottom: var(--spacing-sm);
          color: var(--secondary);
        }

        .tournament-details {
          display: flex;
          gap: var(--spacing-lg);
          font-size: 0.875rem;
          color: var(--gray);
        }

        .tournament-date,
        .tournament-players {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .leaderboard {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .leaderboard-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) 0;
          border-bottom: 1px solid var(--light-gray);
        }

        .leaderboard-item:last-child {
          border-bottom: none;
        }

        .leaderboard-rank {
          width: 40px;
        }

        .rank-badge {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          font-weight: 700;
          font-size: 0.875rem;
        }

        .rank-badge.rank-1 {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: var(--white);
        }

        .rank-badge.rank-2 {
          background: linear-gradient(135deg, #C0C0C0, #808080);
          color: var(--white);
        }

        .rank-badge.rank-3 {
          background: linear-gradient(135deg, #CD7F32, #8B4513);
          color: var(--white);
        }

        .rank-number {
          font-weight: 600;
          color: var(--gray);
        }

        .leaderboard-player {
          flex: 1;
        }

        .player-name {
          display: block;
          font-weight: 600;
          color: var(--secondary);
        }

        .player-stats {
          display: block;
          font-size: 0.75rem;
          color: var(--gray);
        }

        .leaderboard-elo {
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--primary);
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-2xl);
          color: var(--gray);
        }

        @media (max-width: 968px) {
          .dashboard-content {
            grid-template-columns: 1fr;
          }
          
          .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }

        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default PlayerDashboard;
