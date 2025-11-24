import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  Trophy, 
  CheckCircle,
  XCircle,
  Plus,
  Edit2
} from 'lucide-react';
import { 
  getTournament, 
  joinTournament,
  leaveTournament,
  updateMatchScore,
  getMatchesByTournament,
  generateTournamentGroups,
  calculateEloChange,
  updatePlayerElo
} from '../firebase/firestore';
import { auth } from '../firebase/config';

const TournamentDetails = ({ userProfile }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    loadTournamentData();
  }, [id]);

  const loadTournamentData = async () => {
    setLoading(true);
    
    const tournamentData = await getTournament(id);
    if (!tournamentData) {
      navigate('/dashboard');
      return;
    }
    
    setTournament(tournamentData);
    
    // Check if current user is participant
    const userId = auth.currentUser?.uid;
    setIsParticipant(
      tournamentData.participants?.some(p => p.userId === userId) || false
    );
    
    // Generate groups if tournament has started
    if (tournamentData.status !== 'upcoming' && tournamentData.participants?.length > 0) {
      const generatedGroups = generateTournamentGroups(
        tournamentData.participants,
        tournamentData.groupSize || 4
      );
      setGroups(generatedGroups);
    }
    
    // Load matches
    const tournamentMatches = await getMatchesByTournament(id);
    setMatches(tournamentMatches);
    
    setLoading(false);
  };

  const handleJoinTournament = async () => {
    if (!userProfile) return;
    
    const result = await joinTournament(id, auth.currentUser.uid, userProfile);
    if (result.success) {
      loadTournamentData();
    }
  };

  const handleLeaveTournament = async () => {
    if (!userProfile) return;
    
    const result = await leaveTournament(id, auth.currentUser.uid, userProfile);
    if (result.success) {
      loadTournamentData();
    }
  };

  const handleScoreSubmit = async (matchId, scores, winnerId, loserId) => {
    // Update match score
    await updateMatchScore(matchId, scores, winnerId);
    
    // Calculate ELO changes
    const winner = tournament.participants.find(p => p.userId === winnerId);
    const loser = tournament.participants.find(p => p.userId === loserId);
    
    const winnerEloChange = calculateEloChange(winner.elo, loser.elo, true);
    const loserEloChange = calculateEloChange(loser.elo, winner.elo, false);
    
    // Update player ELOs
    await updatePlayerElo(winnerId, winnerEloChange, true);
    await updatePlayerElo(loserId, loserEloChange, false);
    
    // Reload data
    loadTournamentData();
    setSelectedMatch(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="tournament-details">
      <div className="container">
        <motion.div 
          className="tournament-header-section"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="tournament-title">
            <h1>{tournament.name}</h1>
            <span className={`badge badge-${tournament.status}`}>
              {tournament.status}
            </span>
          </div>
          
          <div className="tournament-info-grid">
            <div className="info-item">
              <Calendar className="w-5 h-5" />
              <span>{new Date(tournament.date).toLocaleDateString()}</span>
            </div>
            <div className="info-item">
              <Clock className="w-5 h-5" />
              <span>{tournament.time}</span>
            </div>
            <div className="info-item">
              <Users className="w-5 h-5" />
              <span>{tournament.participants?.length || 0} / {tournament.maxParticipants} players</span>
            </div>
            <div className="info-item">
              <Trophy className="w-5 h-5" />
              <span>{tournament.format}</span>
            </div>
          </div>

          {tournament.description && (
            <div className="tournament-description">
              <p>{tournament.description}</p>
            </div>
          )}

          {tournament.status === 'upcoming' && (
            <div className="tournament-actions">
              {isParticipant ? (
                <button 
                  className="btn btn-outline"
                  onClick={handleLeaveTournament}
                >
                  <XCircle className="w-5 h-5" />
                  Leave Tournament
                </button>
              ) : (
                <button 
                  className="btn btn-primary"
                  onClick={handleJoinTournament}
                  disabled={tournament.participants?.length >= tournament.maxParticipants}
                >
                  <CheckCircle className="w-5 h-5" />
                  Join Tournament
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Participants List */}
        <motion.div 
          className="participants-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2>Participants</h2>
          <div className="participants-grid">
            {tournament.participants?.map((participant, index) => (
              <div key={participant.userId} className="participant-card">
                <div className="participant-rank">#{index + 1}</div>
                <div className="participant-info">
                  <span className="participant-name">{participant.name}</span>
                  <span className="participant-elo">ELO: {participant.elo}</span>
                </div>
              </div>
            )) || (
              <p className="empty-state">No participants yet</p>
            )}
          </div>
        </motion.div>

        {/* Tournament Groups */}
        {groups.length > 0 && (
          <motion.div 
            className="groups-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2>Tournament Groups</h2>
            <div className="groups-grid">
              {groups.map((group, groupIndex) => (
                <div key={groupIndex} className="group-card card">
                  <h3>Group {String.fromCharCode(65 + groupIndex)}</h3>
                  <div className="group-players">
                    {group.map((player, playerIndex) => (
                      <div key={player.userId} className="group-player">
                        <span className="player-seed">{playerIndex + 1}</span>
                        <span className="player-name">{player.name}</span>
                        <span className="player-elo">{player.elo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Matches */}
        {matches.length > 0 && (
          <motion.div 
            className="matches-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2>Matches</h2>
            <div className="matches-list">
              {matches.map((match) => (
                <div key={match.id} className="match-card card">
                  <div className="match-players">
                    <span className={match.winner === match.player1Id ? 'winner' : ''}>
                      {match.player1Name}
                    </span>
                    <span className="vs">vs</span>
                    <span className={match.winner === match.player2Id ? 'winner' : ''}>
                      {match.player2Name}
                    </span>
                  </div>
                  {match.status === 'completed' ? (
                    <div className="match-score">
                      {match.scores.map((score, i) => (
                        <span key={i} className="score-set">
                          {score.player1}-{score.player2}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <button 
                      className="btn btn-small btn-primary"
                      onClick={() => setSelectedMatch(match)}
                    >
                      <Edit2 className="w-4 h-4" />
                      Enter Score
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <style jsx>{`
        .tournament-details {
          min-height: calc(100vh - 70px);
          padding: var(--spacing-2xl) 0;
          background: var(--off-white);
        }

        .loading-container {
          min-height: 50vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tournament-header-section {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: var(--spacing-2xl);
          margin-bottom: var(--spacing-2xl);
        }

        .tournament-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-xl);
        }

        .tournament-title h1 {
          margin: 0;
        }

        .tournament-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-xl);
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--dark-gray);
        }

        .tournament-description {
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-xl);
        }

        .tournament-actions {
          display: flex;
          gap: var(--spacing-md);
        }

        .participants-section,
        .groups-section,
        .matches-section {
          margin-bottom: var(--spacing-2xl);
        }

        .participants-section h2,
        .groups-section h2,
        .matches-section h2 {
          margin-bottom: var(--spacing-lg);
        }

        .participants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: var(--spacing-md);
        }

        .participant-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--white);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .participant-rank {
          font-weight: 700;
          font-size: 1.25rem;
          color: var(--primary);
        }

        .participant-info {
          flex: 1;
        }

        .participant-name {
          display: block;
          font-weight: 600;
          color: var(--secondary);
        }

        .participant-elo {
          display: block;
          font-size: 0.875rem;
          color: var(--gray);
        }

        .groups-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--spacing-lg);
        }

        .group-card {
          padding: var(--spacing-lg);
        }

        .group-card h3 {
          margin-bottom: var(--spacing-md);
          color: var(--primary);
        }

        .group-players {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .group-player {
          display: grid;
          grid-template-columns: 30px 1fr auto;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm);
          background: var(--light-gray);
          border-radius: var(--radius-sm);
        }

        .player-seed {
          font-weight: 700;
          color: var(--secondary);
        }

        .player-name {
          font-weight: 500;
        }

        .player-elo {
          font-weight: 600;
          color: var(--primary);
        }

        .matches-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .match-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-lg);
        }

        .match-players {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          font-weight: 600;
        }

        .match-players .winner {
          color: var(--success);
        }

        .vs {
          color: var(--gray);
          font-weight: 400;
        }

        .match-score {
          display: flex;
          gap: var(--spacing-md);
        }

        .score-set {
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--light-gray);
          border-radius: var(--radius-sm);
          font-weight: 600;
        }

        .empty-state {
          text-align: center;
          color: var(--gray);
          padding: var(--spacing-xl);
        }

        @media (max-width: 768px) {
          .tournament-info-grid {
            grid-template-columns: 1fr;
          }

          .groups-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default TournamentDetails;
