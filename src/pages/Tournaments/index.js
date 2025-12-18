import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  Trophy,
  ChevronRight,
  Search
} from 'lucide-react';
import { getTournaments } from '../../firebase/firestore';

const Tournaments = ({ userProfile }) => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
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
      upcoming: { label: 'Upcoming', class: 'badge-upcoming' },
      active: { label: 'Active', class: 'badge-active' },
      completed: { label: 'Completed', class: 'badge-completed' }
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
              {[
                { key: 'all', label: 'All' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'active', label: 'Active' },
                { key: 'completed', label: 'Completed' }
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
    </div>
  );
};

export default Tournaments;