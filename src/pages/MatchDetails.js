// src/pages/MatchDetails.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  ArrowLeft, 
  Zap, 
  Coffee, 
  Clock, 
  CheckCircle, 
  XCircle,
  Edit2,
  AlertCircle,
  Users,
  Target,
  Calendar,
  Flag
} from 'lucide-react';
import { 
  getIndividualMatch, 
  completeIndividualMatch,
  cancelIndividualMatch
} from '../firebase/firestore';
import { auth } from '../firebase/config';

const MatchDetails = ({ userProfile }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showScoreEntry, setShowScoreEntry] = useState(false);
  const [scores, setScores] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadMatch();
  }, [id]);

  const loadMatch = async () => {
    setLoading(true);
    try {
      const matchData = await getIndividualMatch(id);
      if (!matchData) {
        navigate('/matches');
        return;
      }
      setMatch(matchData);
      
      // Initialize scores array based on format
      const numGames = getNumberOfGames(matchData.format);
      if (matchData.scores && matchData.scores.length > 0) {
        setScores(matchData.scores);
      } else {
        setScores(Array(numGames).fill({ team1: 0, team2: 0 }));
      }
    } catch (error) {
      console.error('Error loading match:', error);
    }
    setLoading(false);
  };

  const getNumberOfGames = (format) => {
    const formatMap = {
      'best-of-1': 1,
      'best-of-3': 3,
      'best-of-5': 5,
      'best-of-7': 7
    };
    return formatMap[format] || 3;
  };

  const isUserInMatch = () => {
    return match?.players?.includes(currentUserId);
  };

  const isUserInTeam1 = () => {
    return match?.team1?.some(p => p.id === currentUserId);
  };

  const canEditScore = () => {
    if (!match) return false;
    if (match.status === 'completed' || match.status === 'cancelled') return false;
    return isUserInMatch() || userProfile?.role === 'owner';
  };

  const handleScoreChange = (gameIndex, team, value) => {
    const newScores = [...scores];
    newScores[gameIndex] = {
      ...newScores[gameIndex],
      [team]: parseInt(value) || 0
    };
    setScores(newScores);
  };

  const calculateWinner = () => {
    let team1Wins = 0;
    let team2Wins = 0;
    const gamesToWin = Math.ceil(getNumberOfGames(match.format) / 2);
    
    scores.forEach(game => {
      if (game.team1 > game.team2) team1Wins++;
      else if (game.team2 > game.team1) team2Wins++;
    });
    
    if (team1Wins >= gamesToWin) return 'team1';
    if (team2Wins >= gamesToWin) return 'team2';
    return null;
  };

  const validateScores = () => {
    const minPoints = match.pointsPerGame;
    const gamesToWin = Math.ceil(getNumberOfGames(match.format) / 2);
    
    let team1Wins = 0;
    let team2Wins = 0;
    
    for (let i = 0; i < scores.length; i++) {
      const game = scores[i];
      
      // Check if game has been played
      if (game.team1 === 0 && game.team2 === 0) continue;
      
      // For a completed game, winner must have at least minPoints
      if (game.team1 >= minPoints || game.team2 >= minPoints) {
        if (game.team1 > game.team2) team1Wins++;
        else if (game.team2 > game.team1) team2Wins++;
      }
      
      // Stop checking once we have a match winner
      if (team1Wins >= gamesToWin || team2Wins >= gamesToWin) break;
    }
    
    // Must have a winner
    if (team1Wins < gamesToWin && team2Wins < gamesToWin) {
      setError(`Match must have a winner (first to ${gamesToWin} games)`);
      return false;
    }
    
    return true;
  };

  const handleSubmitScore = async () => {
    setError('');
    
    if (!validateScores()) return;
    
    const winner = calculateWinner();
    if (!winner) {
      setError('Could not determine winner');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Filter out games that weren't played
      const playedScores = scores.filter(g => g.team1 > 0 || g.team2 > 0);
      
      const result = await completeIndividualMatch(id, playedScores, winner);
      
      if (result.success) {
        await loadMatch();
        setShowScoreEntry(false);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    }
    
    setSubmitting(false);
  };

  const handleCancelMatch = async () => {
    if (!window.confirm('Are you sure you want to cancel this match?')) return;
    
    setSubmitting(true);
    try {
      const result = await cancelIndividualMatch(id);
      if (result.success) {
        await loadMatch();
      }
    } catch (error) {
      console.error('Error cancelling match:', error);
    }
    setSubmitting(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEloChange = (playerId) => {
    if (!match?.eloChanges) return null;
    return match.eloChanges[playerId] || 0;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading match...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="page-container">
        <div className="container">
          <div className="error-state">
            <AlertCircle className="w-16 h-16" />
            <h2>Match Not Found</h2>
            <button className="btn btn-primary" onClick={() => navigate('/matches')}>
              Back to Matches
            </button>
          </div>
        </div>
      </div>
    );
  }

  const winner = match.winner;
  const userTeam = isUserInTeam1() ? 'team1' : 'team2';
  const userWon = winner === userTeam;

  return (
    <div className="page-container match-details">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Back Button */}
          <button className="back-btn" onClick={() => navigate('/matches')}>
            <ArrowLeft className="w-5 h-5" />
            Back to Matches
          </button>

          {/* Match Header */}
          <div className="match-header card">
            <div className="header-top">
              <div className="match-badges">
                {match.matchMode === 'ranked' ? (
                  <span className="mode-badge ranked">
                    <Zap className="w-4 h-4" />
                    Ranked Match
                  </span>
                ) : (
                  <span className="mode-badge casual">
                    <Coffee className="w-4 h-4" />
                    Casual Match
                  </span>
                )}
                <span className="type-badge">{match.matchType}</span>
              </div>
              <span className={`status-badge status-${match.status}`}>
                {match.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                {match.status === 'pending' && <Clock className="w-4 h-4" />}
                {match.status === 'cancelled' && <XCircle className="w-4 h-4" />}
                {match.status}
              </span>
            </div>

            <div className="match-info-row">
              <div className="info-item">
                <Target className="w-5 h-5" />
                <span>{match.format?.replace('-', ' ')} • {match.pointsPerGame} points</span>
              </div>
              <div className="info-item">
                <Calendar className="w-5 h-5" />
                <span>{formatDate(match.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Teams Display */}
          <div className="teams-section">
            {/* Team 1 */}
            <motion.div 
              className={`team-card ${winner === 'team1' ? 'winner' : ''} ${isUserInTeam1() ? 'user-team' : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {winner === 'team1' && (
                <div className="winner-banner">
                  <Trophy className="w-5 h-5" />
                  Winner
                </div>
              )}
              <h3>Team 1</h3>
              <div className="team-players">
                {match.team1.map((player) => (
                  <div key={player.id} className="player-row">
                    <div className="player-info">
                      <span className="player-name">
                        {player.name}
                        {player.id === currentUserId && <span className="you-tag">You</span>}
                      </span>
                      <span className="player-elo">ELO: {player.elo || 1200}</span>
                    </div>
                    {match.status === 'completed' && match.matchMode === 'ranked' && (
                      <span className={`elo-change ${getEloChange(player.id) >= 0 ? 'positive' : 'negative'}`}>
                        {getEloChange(player.id) >= 0 ? '+' : ''}{getEloChange(player.id)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* VS Badge */}
            <div className="vs-container">
              <div className="vs-badge">VS</div>
            </div>

            {/* Team 2 */}
            <motion.div 
              className={`team-card ${winner === 'team2' ? 'winner' : ''} ${!isUserInTeam1() && isUserInMatch() ? 'user-team' : ''}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {winner === 'team2' && (
                <div className="winner-banner">
                  <Trophy className="w-5 h-5" />
                  Winner
                </div>
              )}
              <h3>Team 2</h3>
              <div className="team-players">
                {match.team2.map((player) => (
                  <div key={player.id} className="player-row">
                    <div className="player-info">
                      <span className="player-name">
                        {player.name}
                        {player.id === currentUserId && <span className="you-tag">You</span>}
                      </span>
                      <span className="player-elo">ELO: {player.elo || 1200}</span>
                    </div>
                    {match.status === 'completed' && match.matchMode === 'ranked' && (
                      <span className={`elo-change ${getEloChange(player.id) >= 0 ? 'positive' : 'negative'}`}>
                        {getEloChange(player.id) >= 0 ? '+' : ''}{getEloChange(player.id)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Score Display */}
          {match.status === 'completed' && match.scores && match.scores.length > 0 && (
            <motion.div 
              className="scores-section card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3>
                <Trophy className="w-5 h-5" />
                Match Score
              </h3>
              <div className="scores-grid">
                {match.scores.map((game, index) => (
                  <div key={index} className="game-score">
                    <span className="game-label">Game {index + 1}</span>
                    <div className="game-result">
                      <span className={game.team1 > game.team2 ? 'winner-score' : ''}>
                        {game.team1}
                      </span>
                      <span className="score-separator">-</span>
                      <span className={game.team2 > game.team1 ? 'winner-score' : ''}>
                        {game.team2}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Final Score Summary */}
              <div className="final-score">
                <span>Final Score: </span>
                <strong>
                  {match.scores.filter(g => g.team1 > g.team2).length} - {match.scores.filter(g => g.team2 > g.team1).length}
                </strong>
              </div>
            </motion.div>
          )}

          {/* Score Entry */}
          {showScoreEntry && (
            <motion.div 
              className="score-entry-section card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3>
                <Edit2 className="w-5 h-5" />
                Enter Match Score
              </h3>
              
              {error && (
                <div className="error-message">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <div className="score-entry-grid">
                <div className="score-header">
                  <span></span>
                  <span>Team 1</span>
                  <span>Team 2</span>
                </div>
                {scores.map((game, index) => (
                  <div key={index} className="score-row">
                    <span className="game-label">Game {index + 1}</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={game.team1}
                      onChange={(e) => handleScoreChange(index, 'team1', e.target.value)}
                      className="score-input"
                    />
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={game.team2}
                      onChange={(e) => handleScoreChange(index, 'team2', e.target.value)}
                      className="score-input"
                    />
                  </div>
                ))}
              </div>

              <p className="score-hint">
                Enter scores for each game. First team to win {Math.ceil(getNumberOfGames(match.format) / 2)} games wins.
                {match.matchMode === 'ranked' && ' This will affect ELO ratings.'}
              </p>

              <div className="score-entry-actions">
                <button 
                  className="btn btn-outline"
                  onClick={() => setShowScoreEntry(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleSubmitScore}
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Submit Score
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          {canEditScore() && !showScoreEntry && (
            <div className="match-actions">
              <button 
                className="btn btn-primary"
                onClick={() => setShowScoreEntry(true)}
              >
                <Edit2 className="w-5 h-5" />
                Enter Score
              </button>
              <button 
                className="btn btn-outline btn-danger"
                onClick={handleCancelMatch}
                disabled={submitting}
              >
                <XCircle className="w-5 h-5" />
                Cancel Match
              </button>
            </div>
          )}

          {/* Match Result Banner */}
          {match.status === 'completed' && isUserInMatch() && (
            <motion.div 
              className={`result-banner ${userWon ? 'victory' : 'defeat'}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Trophy className="w-8 h-8" />
              <div className="result-text">
                <span className="result-title">{userWon ? 'Victory!' : 'Defeat'}</span>
                {match.matchMode === 'ranked' && (
                  <span className="result-elo">
                    ELO: {getEloChange(currentUserId) >= 0 ? '+' : ''}{getEloChange(currentUserId)}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      <style>{`
        .match-details {
          min-height: calc(100vh - 70px);
          padding: var(--spacing-2xl) 0;
          background: var(--off-white);
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-sm);
          background: none;
          border: none;
          color: var(--gray);
          cursor: pointer;
          margin-bottom: var(--spacing-lg);
          font-size: 0.875rem;
        }

        .back-btn:hover {
          color: var(--primary);
        }

        .match-header {
          margin-bottom: var(--spacing-xl);
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
        }

        .match-badges {
          display: flex;
          gap: var(--spacing-sm);
        }

        .mode-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
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

        .type-badge {
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--light-gray);
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
          color: var(--secondary);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
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

        .status-cancelled {
          background: rgba(244, 67, 54, 0.1);
          color: var(--danger);
        }

        .match-info-row {
          display: flex;
          gap: var(--spacing-xl);
          flex-wrap: wrap;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--gray);
        }

        .teams-section {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
          align-items: stretch;
        }

        .team-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
        }

        .team-card.winner {
          border: 2px solid #FFD700;
          background: linear-gradient(to bottom, rgba(255, 215, 0, 0.1), var(--white));
        }

        .team-card.user-team {
          border: 2px solid var(--success);
        }

        .winner-banner {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: var(--white);
          padding: var(--spacing-xs) var(--spacing-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-xs);
          font-weight: 700;
          font-size: 0.875rem;
        }

        .team-card.winner {
          padding-top: calc(var(--spacing-xl) + 30px);
        }

        .team-card h3 {
          margin-bottom: var(--spacing-md);
          color: var(--secondary);
        }

        .team-players {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .player-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
        }

        .player-info {
          display: flex;
          flex-direction: column;
        }

        .player-name {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .you-tag {
          font-size: 0.625rem;
          padding: 2px 6px;
          background: var(--success);
          color: var(--white);
          border-radius: var(--radius-sm);
          font-weight: 600;
        }

        .player-elo {
          font-size: 0.875rem;
          color: var(--gray);
        }

        .elo-change {
          font-weight: 700;
          font-size: 1rem;
        }

        .elo-change.positive {
          color: var(--success);
        }

        .elo-change.negative {
          color: var(--danger);
        }

        .vs-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .vs-badge {
          width: 60px;
          height: 60px;
          border-radius: var(--radius-full);
          background: var(--secondary);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
        }

        .scores-section {
          margin-bottom: var(--spacing-xl);
        }

        .scores-section h3 {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
          color: var(--primary);
        }

        .scores-grid {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: wrap;
          margin-bottom: var(--spacing-lg);
        }

        .game-score {
          flex: 1;
          min-width: 100px;
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          text-align: center;
        }

        .game-label {
          display: block;
          font-size: 0.75rem;
          color: var(--gray);
          margin-bottom: var(--spacing-xs);
        }

        .game-result {
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          justify-content: center;
          gap: var(--spacing-sm);
        }

        .winner-score {
          color: var(--success);
        }

        .score-separator {
          color: var(--gray);
        }

        .final-score {
          text-align: center;
          font-size: 1.125rem;
          color: var(--secondary);
        }

        .final-score strong {
          color: var(--primary);
          font-size: 1.5rem;
        }

        .score-entry-section {
          margin-bottom: var(--spacing-xl);
        }

        .score-entry-section h3 {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid var(--danger);
          border-radius: var(--radius-md);
          color: var(--danger);
          margin-bottom: var(--spacing-lg);
        }

        .score-entry-grid {
          margin-bottom: var(--spacing-lg);
        }

        .score-header,
        .score-row {
          display: grid;
          grid-template-columns: 100px 1fr 1fr;
          gap: var(--spacing-md);
          align-items: center;
          padding: var(--spacing-sm) 0;
        }

        .score-header {
          font-weight: 600;
          color: var(--gray);
          border-bottom: 1px solid var(--light-gray);
          margin-bottom: var(--spacing-sm);
        }

        .score-input {
          padding: var(--spacing-md);
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-md);
          text-align: center;
          font-size: 1.25rem;
          font-weight: 600;
          width: 100%;
        }

        .score-input:focus {
          border-color: var(--primary);
          outline: none;
        }

        .score-hint {
          font-size: 0.875rem;
          color: var(--gray);
          margin-bottom: var(--spacing-lg);
        }

        .score-entry-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-md);
        }

        .match-actions {
          display: flex;
          gap: var(--spacing-md);
          justify-content: center;
          margin-bottom: var(--spacing-xl);
        }

        .btn-danger {
          color: var(--danger);
          border-color: var(--danger);
        }

        .btn-danger:hover {
          background: rgba(244, 67, 54, 0.1);
        }

        .result-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-md);
          padding: var(--spacing-xl);
          border-radius: var(--radius-lg);
          text-align: center;
        }

        .result-banner.victory {
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(76, 175, 80, 0.1));
          border: 2px solid var(--success);
          color: var(--success);
        }

        .result-banner.defeat {
          background: linear-gradient(135deg, rgba(244, 67, 54, 0.2), rgba(244, 67, 54, 0.1));
          border: 2px solid var(--danger);
          color: var(--danger);
        }

        .result-text {
          display: flex;
          flex-direction: column;
        }

        .result-title {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .result-elo {
          font-size: 1rem;
        }

        .loading-state,
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: var(--spacing-md);
          color: var(--gray);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--light-gray);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: var(--white);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .teams-section {
            grid-template-columns: 1fr;
          }

          .vs-container {
            order: -1;
          }

          .vs-badge {
            width: 50px;
            height: 50px;
            font-size: 1rem;
          }

          .match-actions {
            flex-direction: column;
          }

          .match-actions .btn {
            width: 100%;
          }

          .score-header,
          .score-row {
            grid-template-columns: 80px 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default MatchDetails;