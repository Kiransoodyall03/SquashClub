import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus,
  Calendar,
  Users,
  Trophy,
  Send,
  Settings,
  BarChart3,
  Clock,
  Edit,
  MessageSquare
} from 'lucide-react';
import { 
  getTournaments,
  createTournament,
  generateWhatsAppLink,
  getLeaderboard,
  getUserProfile
} from '../firebase/firestore';
import { auth } from '../firebase/config';
import CreateTournamentModal from '../components/CreateTournamentModal';

const OwnerDashboard = () => {
  const [tournaments, setTournaments] = useState([]);
  const [players, setPlayers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTournaments: 0,
    activePlayers: 0,
    upcomingTournaments: 0,
    completedTournaments: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    // Load tournaments
    const allTournaments = await getTournaments();
    setTournaments(allTournaments);
    
    // Load player leaderboard
    const leaderboardData = await getLeaderboard(100);
    setPlayers(leaderboardData);
    
    // Calculate stats
    setStats({
      totalTournaments: allTournaments.length,
      activePlayers: leaderboardData.filter(p => p.matchesPlayed > 0).length,
      upcomingTournaments: allTournaments.filter(t => t.status === 'upcoming').length,
      completedTournaments: allTournaments.filter(t => t.status === 'completed').length
    });
    
    setLoading(false);
  };

  const handleCreateTournament = async (tournamentData) => {
    const result = await createTournament({
      ...tournamentData,
      ownerId: auth.currentUser?.uid,
      createdBy: auth.currentUser?.displayName
    });
    
    if (result.success) {
      loadDashboardData();
      setShowCreateModal(false);
    }
    
    return result;
  };

  const sendInvitations = (tournamentId, tournamentName, date) => {
    const whatsappLink = generateWhatsAppLink(tournamentId, tournamentName, date);
    window.open(whatsappLink, '_blank');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard owner-dashboard">
      <div className="container">
        <motion.div 
          className="dashboard-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="header-content">
            <h1>Club Management</h1>
            <p>Manage tournaments and track player performance</p>
          </div>
          <button 
            className="btn btn-primary btn-large"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-5 h-5" />
            Create Tournament
          </button>
        </motion.div>

        {/* Stats Overview */}
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
              <h3>Total Tournaments</h3>
              <div className="stat-value">
                <span className="stat-number">{stats.totalTournaments}</span>
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
              <Users className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Active Players</h3>
              <div className="stat-value">
                <span className="stat-number">{stats.activePlayers}</span>
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
              <Calendar className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Upcoming</h3>
              <div className="stat-value">
                <span className="stat-number">{stats.upcomingTournaments}</span>
                <span className="stat-subtitle">tournaments</span>
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
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Completed</h3>
              <div className="stat-value">
                <span className="stat-number">{stats.completedTournaments}</span>
                <span className="stat-subtitle">tournaments</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tournament Management */}
        <motion.div 
          className="tournaments-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="section-header">
            <h2>Tournament Management</h2>
            <div className="filter-tabs">
              <button className="filter-tab active">All</button>
              <button className="filter-tab">Upcoming</button>
              <button className="filter-tab">In Progress</button>
              <button className="filter-tab">Completed</button>
            </div>
          </div>

          <div className="tournaments-grid">
            {tournaments.map((tournament, index) => (
              <motion.div 
                key={tournament.id}
                className="tournament-management-card card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.05 }}
              >
                <div className="tournament-header">
                  <div className="tournament-status">
                    <span className={`badge badge-${tournament.status}`}>
                      {tournament.status}
                    </span>
                  </div>
                  <div className="tournament-actions">
                    <button className="action-btn" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="action-btn" title="Settings">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="tournament-body">
                  <h3>{tournament.name}</h3>
                  <div className="tournament-meta">
                    <span className="meta-item">
                      <Calendar className="w-4 h-4" />
                      {new Date(tournament.date).toLocaleDateString()}
                    </span>
                    <span className="meta-item">
                      <Clock className="w-4 h-4" />
                      {tournament.time}
                    </span>
                    <span className="meta-item">
                      <Users className="w-4 h-4" />
                      {tournament.participants?.length || 0} players
                    </span>
                  </div>
                  <div className="tournament-format">
                    <span className="format-label">Format:</span>
                    <span className="format-value">{tournament.format}</span>
                  </div>
                </div>

                <div className="tournament-footer">
                  <Link 
                    to={`/tournament/${tournament.id}`}
                    className="btn btn-outline btn-small"
                  >
                    Manage
                  </Link>
                  <button 
                    className="btn btn-primary btn-small"
                    onClick={() => sendInvitations(
                      tournament.id, 
                      tournament.name, 
                      tournament.date
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send Invites
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {tournaments.length === 0 && (
            <div className="empty-state">
              <Trophy className="w-16 h-16" />
              <h3>No tournaments yet</h3>
              <p>Create your first tournament to get started</p>
              <button 
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create Tournament
              </button>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div 
          className="quick-actions-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2>Quick Actions</h2>
          <div className="quick-actions-grid">
            <button className="quick-action-card">
              <Send className="w-8 h-8" />
              <span>Send Reminders</span>
            </button>
            <button className="quick-action-card">
              <BarChart3 className="w-8 h-8" />
              <span>View Reports</span>
            </button>
            <Link to="/players" className="quick-action-card">
              <Users className="w-8 h-8" />
              <span>Manage Players</span>
            </Link>
            <Link to="/settings" className="quick-action-card">
              <Settings className="w-8 h-8" />
              <span>Club Settings</span>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Create Tournament Modal */}
      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTournament}
        />
      )}

      <style jsx>{`
        .owner-dashboard {
          background: var(--off-white);
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-2xl);
        }

        .header-content h1 {
          margin-bottom: var(--spacing-sm);
        }

        .tournaments-section {
          margin-top: var(--spacing-2xl);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-xl);
        }

        .filter-tabs {
          display: flex;
          gap: var(--spacing-sm);
        }

        .filter-tab {
          padding: var(--spacing-sm) var(--spacing-md);
          background: transparent;
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-full);
          color: var(--dark-gray);
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .filter-tab:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .filter-tab.active {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--white);
        }

        .tournaments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: var(--spacing-lg);
        }

        .tournament-management-card {
          display: flex;
          flex-direction: column;
        }

        .tournament-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: var(--spacing-md);
          border-bottom: 1px solid var(--light-gray);
          margin-bottom: var(--spacing-md);
        }

        .tournament-actions {
          display: flex;
          gap: var(--spacing-sm);
        }

        .action-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-sm);
          color: var(--dark-gray);
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .action-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .tournament-body {
          flex: 1;
        }

        .tournament-body h3 {
          margin-bottom: var(--spacing-md);
        }

        .tournament-meta {
          display: flex;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-md);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          color: var(--gray);
        }

        .tournament-format {
          display: flex;
          gap: var(--spacing-sm);
          font-size: 0.875rem;
        }

        .format-label {
          color: var(--gray);
        }

        .format-value {
          font-weight: 600;
          color: var(--secondary);
        }

        .tournament-footer {
          display: flex;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--light-gray);
        }

        .badge-upcoming {
          background: var(--warning);
        }

        .badge-in-progress {
          background: var(--primary);
        }

        .badge-completed {
          background: var(--success);
        }

        .quick-actions-section {
          margin-top: var(--spacing-3xl);
        }

        .quick-actions-section h2 {
          margin-bottom: var(--spacing-lg);
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--spacing-lg);
        }

        .quick-action-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-md);
          padding: var(--spacing-xl);
          background: var(--white);
          border: 2px solid var(--light-gray);
          border-radius: var(--radius-lg);
          color: var(--secondary);
          text-decoration: none;
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .quick-action-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .quick-action-card span {
          font-weight: 600;
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-3xl);
          color: var(--gray);
        }

        .empty-state h3 {
          margin: var(--spacing-lg) 0 var(--spacing-sm);
        }

        .empty-state p {
          margin-bottom: var(--spacing-xl);
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-lg);
          }

          .section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-md);
          }

          .filter-tabs {
            width: 100%;
            overflow-x: auto;
          }

          .tournaments-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default OwnerDashboard;
