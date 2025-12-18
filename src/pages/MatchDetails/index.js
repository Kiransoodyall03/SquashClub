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
} from '../../firebase/firestore';
import { auth } from '../../firebase/config';
import './MatchDetails.css';

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

  // UPDATED: Logic to handle all specific formats
  const getFormatConfig = (format) => {
    // Default fallback
    const config = { type: 'fixed', games: 1, pointsToWin: 21, gamesToWin: 1 };

    if (!format) return config;

    // Normalizing string for easier matching
    const fmt = format.toLowerCase();

    // === Best Of Formats ===
    if (fmt.startsWith('best of')) {
      config.type = 'bestOf';
      
      // Determine Max Games & Games Needed to Win
      if (fmt.includes('best of 3')) {
        config.games = 3;
        config.gamesToWin = 2;
      } else if (fmt.includes('best of 5')) {
        config.games = 5;
        config.gamesToWin = 3;
      } else if (fmt.includes('best of 7')) {
        config.games = 7;
        config.gamesToWin = 4;
      }

      // Determine Points per Game
      if (fmt.includes('to 15')) config.pointsToWin = 15;
      else if (fmt.includes('to 11')) config.pointsToWin = 11;
      else config.pointsToWin = 11; // Default for best of
    } 
    // === Fixed Game Formats ===
    else {
      config.type = 'fixed';
      
      if (fmt.includes('1 game')) {
        config.games = 1;
        config.pointsToWin = 21;
      } else if (fmt.includes('2 games')) {
        config.games = 2;
        config.pointsToWin = 15;
      } else if (fmt.includes('3 games')) {
        config.games = 3;
        config.pointsToWin = 11;
      }
    }
    return config;
  };

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
      
      if (matchData) {
        const config = getFormatConfig(matchData.format);
        const numGames = config.type === 'bestOf' ? config.games : config.games;
        if (matchData.scores && matchData.scores.length > 0) {
          setScores(matchData.scores);
        } else {
          setScores(Array(numGames).fill({ team1: 0, team2: 0 }));
        }
      }
    } catch (error) {
      console.error('Error loading match:', error);
    }
    setLoading(false);
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
    const formatConfig = getFormatConfig(match.format);
    const validScores = scores.filter(g => g.team1 > 0 || g.team2 > 0);

    if (formatConfig.type === 'bestOf') {
      let team1Wins = 0;
      let team2Wins = 0;
      validScores.forEach(game => {
        if (game.team1 > game.team2) team1Wins++;
        else if (game.team2 > game.team1) team2Wins++;
      });
      if (team1Wins >= formatConfig.gamesToWin) return 'team1';
      if (team2Wins >= formatConfig.gamesToWin) return 'team2';
    } else { // 'fixed'
      if (validScores.length < formatConfig.games) return null;
      let team1TotalPoints = 0;
      let team2TotalPoints = 0;
      validScores.forEach(game => {
        team1TotalPoints += game.team1;
        team2TotalPoints += game.team2;
      });
      if (team1TotalPoints > team2TotalPoints) return 'team1';
      if (team2TotalPoints > team1TotalPoints) return 'team2';
    }

    return null;
  };

  const validateScores = () => {
    const formatConfig = getFormatConfig(match.format);
    const playedScores = scores.filter(g => g.team1 > 0 || g.team2 > 0);

    if (formatConfig.type === 'bestOf') {
      let team1Wins = 0;
      let team2Wins = 0;
      playedScores.forEach(game => {
        if (game.team1 > game.team2) team1Wins++;
        else if (game.team2 > game.team1) team2Wins++;
      });
      if (team1Wins < formatConfig.gamesToWin && team2Wins < formatConfig.gamesToWin) {
        setError(`Match must have a winner (first to ${formatConfig.gamesToWin} games)`);
        return false;
      }
    } else { // 'fixed'
      if (playedScores.length < formatConfig.games) {
        setError(`All ${formatConfig.games} games must be entered.`);
        return false;
      }
      let team1TotalPoints = 0;
      let team2TotalPoints = 0;
      playedScores.forEach(game => {
        team1TotalPoints += game.team1;
        team2TotalPoints += game.team2;
      });
      if (team1TotalPoints === team2TotalPoints) {
        setError('Total score cannot be a draw for this format.');
        return false;
      }
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
  const formatConfig = getFormatConfig(match.format);
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
                <span>{match.format}</span>
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
                <span>
                  {formatConfig.type === 'bestOf' ? 'Final Score (Games):' : 'Final Score (Total Points):'}
                </span>
                <strong>
                  {formatConfig.type === 'bestOf'
                    ? `${match.scores.filter(g => g.team1 > g.team2).length} - ${match.scores.filter(g => g.team2 > g.team1).length}`
                    : `${match.scores.reduce((acc, s) => acc + s.team1, 0)} - ${match.scores.reduce((acc, s) => acc + s.team2, 0)}`}
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
                {formatConfig.type === 'bestOf' 
                  ? `Enter scores for each game. First team to win ${formatConfig.gamesToWin} games wins.`
                  : `Enter scores for all ${formatConfig.games} games. Team with highest total score wins.`
                }
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
    </div>
  );
};

export default MatchDetails;