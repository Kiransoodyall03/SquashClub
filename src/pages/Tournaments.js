import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  Trophy,
  ChevronRight,
  Filter,
  Search
} from 'lucide-react';
import { getTournaments } from '../firebase/firestore';

const Tournaments = ({ userProfile }) => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, upcoming, ongoing, completed
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    setLoading(true);
    const data = await getTournaments();
    setTournaments(data);
    setLoading(false);
  };

  const filteredTournaments = tournaments.filter(tournament => {
    // Filter by status
    if (filter !== 'all' && tournament.status !== filter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm && !tournament.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const getStatusBadge = (status) => {
    const badges = {
      upcoming: { label: 'Upcoming', class: 'badge-primary' },
      ongoing: { label: 'Ongoing', class: 'badge-success' },
      completed: { label: 'Completed', class: 'badge-gray' }
    };
    return badges[status] || badges.upcoming;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isUserParticipating = (tournament) => {
    return tournament.participants?.some(p => p.userId === userProfile?.id);
  };

  return (
    <div className="page-container">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="page-header">
            <div>
              <h1>Tournaments</h1>
              <p className="page-subtitle">Browse and join upcoming tournaments</p>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section card">
            <div className="search-bar">
              <Search className="w-5 h-5" />
              <input
                type="text"
                placeholder="Search tournaments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-tabs">
              {['all', 'upcoming', 'ongoing', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`filter-tab ${filter === status ? 'active' : ''}`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tournaments Grid */}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading tournaments...</p>
            </div>
          ) : filteredTournaments.length === 0 ? (
            <div className="empty-state card">
              <Trophy className="w-16 h-16 opacity-20" />
              <h3>No tournaments found</h3>
              <p>Check back later for upcoming tournaments</p>
            </div>
          ) : (
            <div className="tournaments-grid">
              {filteredTournaments.map((tournament) => (
                <motion.div
                  key={tournament.id}
                  className="tournament-card card"
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(`/tournament/${tournament.id}`)}
                >
                  <div className="tournament-header">
                    <h3>{tournament.name}</h3>
                    <span className={`badge ${getStatusBadge(tournament.status).class}`}>
                      {getStatusBadge(tournament.status).label}
                    </span>
                  </div>

                  <div className="tournament-details">
                    <div className="detail-item">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(tournament.date)}</span>
                    </div>
                    
                    <div className="detail-item">
                      <Clock className="w-4 h-4" />
                      <span>{tournament.time || 'TBD'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <Users className="w-4 h-4" />
                      <span>
                        {tournament.participants?.length || 0}/{tournament.maxParticipants || 16} players
                      </span>
                    </div>
                  </div>

                  {tournament.description && (
                    <p className="tournament-description">{tournament.description}</p>
                  )}

                  <div className="tournament-footer">
                    {isUserParticipating(tournament) ? (
                      <span className="participating-badge">
                        <Trophy className="w-4 h-4" />
                        You're participating
                      </span>
                    ) : (
                      <div className="tournament-format">
                        <Trophy className="w-4 h-4" />
                        <span>{tournament.format || '1 game to 21'}</span>
                      </div>
                    )}
                    
                    <ChevronRight className="w-5 h-5 chevron-icon" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <style>{`
        .filters-section {
          margin-bottom: var(--spacing-xl);
          padding: var(--spacing-lg);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 1rem;
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
        }

        .filter-tab:hover {
          background: var(--light-gray);
        }

        .filter-tab.active {
          background: var(--gradient-primary);
          color: var(--white);
          border-color: transparent;
        }

        .tournaments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: var(--spacing-lg);
        }

        .tournament-card {
          cursor: pointer;
          transition: all var(--transition-base);
          position: relative;
        }

        .tournament-card:hover {
          box-shadow: var(--shadow-lg);
        }

        .tournament-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-md);
          gap: var(--spacing-md);
        }

        .tournament-header h3 {
          margin: 0;
          font-size: 1.25rem;
          flex: 1;
        }

        .tournament-details {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--gray);
          font-size: 0.9rem;
        }

        .tournament-description {
          color: var(--gray);
          font-size: 0.9rem;
          margin: var(--spacing-md) 0;
          line-height: 1.5;
        }

        .tournament-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--light-gray);
        }

        .tournament-format {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          color: var(--primary);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .participating-badge {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          color: var(--success);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .chevron-icon {
          color: var(--gray);
          transition: transform var(--transition-base);
        }

        .tournament-card:hover .chevron-icon {
          transform: translateX(4px);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xxl);
          gap: var(--spacing-md);
          color: var(--gray);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xxl);
          gap: var(--spacing-md);
          text-align: center;
        }

        .empty-state h3 {
          margin: 0;
          color: var(--secondary);
        }

        .empty-state p {
          margin: 0;
          color: var(--gray);
        }

        @media (max-width: 768px) {
          .tournaments-grid {
            grid-template-columns: 1fr;
          }

          .tournament-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Tournaments;