// src/components/ScoreEntryModal.js

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Check } from 'lucide-react';

const ScoreEntryModal = ({ match, onClose, onSubmit, isOwner }) => {
  const [scores, setScores] = useState([]);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // UPDATED: Logic to handle all specific formats
  const getFormatConfig = (format) => {
    // Default fallback
    const config = { type: 'fixed', games: 1, pointsToWin: 21 };

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
      else if (fmt.includes('to 9')) config.pointsToWin = 9;
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

  const formatConfig = getFormatConfig(match.format);

  // Initialize scores array based on format
  useEffect(() => {
    if (match.scores && match.scores.length > 0) {
      setScores(match.scores);
    } else {
      // For "Best Of", we start with the minimum games needed to win (e.g. 2 for Bo3)
      // For "Fixed", we show all games immediately
      const initialGames = formatConfig.type === 'bestOf' 
        ? formatConfig.gamesToWin
        : formatConfig.games;
      
      const initialScores = Array(initialGames).fill(null).map(() => ({
        player1: '',
        player2: ''
      }));
      setScores(initialScores);
    }
  }, [match]);

  // Recalculate winner whenever scores change
  useEffect(() => {
    const calculatedWinner = calculateWinner(scores);
    setWinner(calculatedWinner);
  }, [scores]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Calculate winner based on format
  const calculateWinner = (currentScores) => {
    const validScores = currentScores.filter(
      s => s.player1 !== '' && s.player2 !== '' && 
           !isNaN(parseInt(s.player1)) && !isNaN(parseInt(s.player2))
    );

    if (validScores.length === 0) return null;

    if (formatConfig.type === 'fixed') {
      // Check if all games are entered
      if (validScores.length < formatConfig.games) return null;

      if (formatConfig.games === 1) {
        const p1 = parseInt(validScores[0].player1);
        const p2 = parseInt(validScores[0].player2);
        if (p1 === p2) return null; // Draw not allowed in 1 game usually
        return p1 > p2 ? match.player1Id : match.player2Id;
      } else {
        // Aggregate score for multi-game fixed (e.g. 2 games to 15)
        let p1Total = 0;
        let p2Total = 0;
        validScores.forEach(score => {
          p1Total += parseInt(score.player1);
          p2Total += parseInt(score.player2);
        });
        if (p1Total === p2Total) return null; // Handle draw logic if needed
        return p1Total > p2Total ? match.player1Id : match.player2Id;
      }
    } else {
      // Best Of Logic
      let p1Wins = 0;
      let p2Wins = 0;
      validScores.forEach(score => {
        const p1 = parseInt(score.player1);
        const p2 = parseInt(score.player2);
        if (p1 > p2) p1Wins++;
        else if (p2 > p1) p2Wins++;
      });

      if (p1Wins >= formatConfig.gamesToWin) return match.player1Id;
      if (p2Wins >= formatConfig.gamesToWin) return match.player2Id;
      return null;
    }
  };

  // Check if we need to show another game input (for Best of formats)
  const shouldShowNextGame = () => {
    if (formatConfig.type !== 'bestOf') return false;
    if (scores.length >= formatConfig.games) return false;
    
    // Check wins so far
    let p1Wins = 0;
    let p2Wins = 0;
    
    // Only count fully entered games
    const validScores = scores.filter(s => s.player1 !== '' && s.player2 !== '');
    
    validScores.forEach(score => {
      const p1 = parseInt(score.player1);
      const p2 = parseInt(score.player2);
      if (p1 > p2) p1Wins++;
      else if (p2 > p1) p2Wins++;
    });

    const hasWinner = p1Wins >= formatConfig.gamesToWin || p2Wins >= formatConfig.gamesToWin;
    
    // Only show "Add Game" if previous games are filled AND we don't have a winner yet
    return validScores.length === scores.length && !hasWinner;
  };

  // Add another game input
  const addNextGame = () => {
    setScores([...scores, { player1: '', player2: '' }]);
  };

  // Handle score change
  const handleScoreChange = (gameIndex, player, value) => {
    const newScores = [...scores];
    newScores[gameIndex] = {
      ...newScores[gameIndex],
      [player]: value
    };
    setScores(newScores);
  };

  // Check if form is valid
  const isFormValid = () => {
    if (formatConfig.type === 'fixed') {
      const allFilled = scores.length === formatConfig.games && 
        scores.every(s => s.player1 !== '' && s.player2 !== '');
      return allFilled && winner !== null;
    } else {
      // For best of, we need a winner determined
      return winner !== null;
    }
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setLoading(true);
    setError('');

    const numericScores = scores
      .filter(s => s.player1 !== '' && s.player2 !== '')
      .map(s => ({
        player1: parseInt(s.player1),
        player2: parseInt(s.player2)
      }));

    const result = await onSubmit(match.id, numericScores, winner);
    
    if (!result.success) {
      setError(result.error || 'Failed to submit score');
      setLoading(false);
    }
  };

  // Get game label
  const getGameLabel = (index) => {
    if (formatConfig.games === 1) return 'Final Score';
    return `Game ${index + 1}`;
  };

  // Get current games won display
  const getGamesWonDisplay = () => {
    if (formatConfig.type !== 'bestOf') return null;
    
    let p1Wins = 0;
    let p2Wins = 0;
    scores.forEach(score => {
      if (score.player1 !== '' && score.player2 !== '') {
        const p1 = parseInt(score.player1);
        const p2 = parseInt(score.player2);
        if (p1 > p2) p1Wins++;
        else if (p2 > p1) p2Wins++;
      }
    });

    return { p1Wins, p2Wins };
  };

  const gamesWon = getGamesWonDisplay();

  return (
    <AnimatePresence>
      <div className="score-modal-overlay" onClick={onClose}>
        <motion.div 
          className="score-modal-container"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="score-modal-header">
            <h2>Enter Match Score</h2>
            <button className="close-btn" onClick={onClose}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="score-modal-body">
            <div className="match-info">
              <div className="players-display">
                <div className={`player-name ${winner === match.player1Id ? 'winner' : ''}`}>
                  {match.player1Name}
                  {winner === match.player1Id && <Trophy className="w-4 h-4" />}
                </div>
                <span className="vs">vs</span>
                <div className={`player-name ${winner === match.player2Id ? 'winner' : ''}`}>
                  {match.player2Name}
                  {winner === match.player2Id && <Trophy className="w-4 h-4" />}
                </div>
              </div>
              <div className="format-badge">{match.format}</div>
              
              {gamesWon && (
                <div className="games-won-display">
                  <span>Games: {gamesWon.p1Wins} - {gamesWon.p2Wins}</span>
                  <span className="games-needed">(First to {formatConfig.gamesToWin})</span>
                </div>
              )}
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="score-form">
              <div className="scores-container">
                <div className="scores-header">
                  <span></span>
                  <span>{match.player1Name.split(' ')[0]}</span>
                  <span>{match.player2Name.split(' ')[0]}</span>
                </div>

                {scores.map((score, index) => (
                  <div key={index} className="score-row">
                    <label className="game-label">{getGameLabel(index)}</label>
                    <input
                      type="number"
                      min="0"
                      max={formatConfig.pointsToWin + 20} // Allow overtime
                      value={score.player1}
                      onChange={(e) => handleScoreChange(index, 'player1', e.target.value)}
                      className="score-input"
                      placeholder="0"
                    />
                    <input
                      type="number"
                      min="0"
                      max={formatConfig.pointsToWin + 20} // Allow overtime
                      value={score.player2}
                      onChange={(e) => handleScoreChange(index, 'player2', e.target.value)}
                      className="score-input"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {shouldShowNextGame() && (
                <button 
                  type="button" 
                  className="btn btn-outline add-game-btn"
                  onClick={addNextGame}
                >
                  + Add Game {scores.length + 1}
                </button>
              )}

              {winner && (
                <div className="winner-display">
                  <Check className="w-5 h-5" />
                  <span>
                    Winner: {winner === match.player1Id ? match.player1Name : match.player2Name}
                  </span>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading || !isFormValid()}
                >
                  {loading ? 'Submitting...' : 'Submit Score'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>

        <style>{`
          .score-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 20px;
            box-sizing: border-box;
          }

          .score-modal-container {
            background: var(--white, #ffffff);
            border-radius: 16px;
            max-width: 500px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }

          .score-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--light-gray, #e5e7eb);
            position: sticky;
            top: 0;
            background: var(--white, #ffffff);
            z-index: 10;
          }

          .score-modal-header h2 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--secondary, #1f2937);
          }

          .close-btn {
            background: transparent;
            border: none;
            color: var(--gray, #6b7280);
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .close-btn:hover {
            background: var(--light-gray, #f3f4f6);
            color: var(--secondary, #1f2937);
          }

          .score-modal-body {
            padding: 24px;
          }

          .match-info {
            padding: 16px;
            background: var(--light-gray, #f3f4f6);
            border-radius: 12px;
            margin-bottom: 20px;
            text-align: center;
          }

          .players-display {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin-bottom: 12px;
          }

          .players-display .player-name {
            font-weight: 600;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--secondary, #1f2937);
          }

          .players-display .player-name.winner {
            color: var(--success, #22c55e);
          }

          .players-display .vs {
            color: var(--gray, #6b7280);
            font-weight: 400;
            font-size: 0.875rem;
          }

          .format-badge {
            display: inline-block;
            padding: 4px 12px;
            background: var(--primary, #3b82f6);
            color: white;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
          }

          .games-won-display {
            margin-top: 12px;
            font-weight: 600;
            color: var(--secondary, #1f2937);
          }

          .games-needed {
            font-weight: 400;
            color: var(--gray, #6b7280);
            font-size: 0.875rem;
            margin-left: 6px;
          }

          .error-message {
            padding: 12px 16px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #ef4444;
            border-radius: 8px;
            color: #ef4444;
            margin-bottom: 20px;
            font-size: 0.875rem;
          }

          .score-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .scores-container {
            background: white;
            border: 1px solid var(--light-gray, #e5e7eb);
            border-radius: 12px;
            overflow: hidden;
          }

          .scores-header {
            display: grid;
            grid-template-columns: 100px 1fr 1fr;
            gap: 12px;
            padding: 12px 16px;
            background: var(--secondary, #1f2937);
            color: white;
            font-weight: 600;
            font-size: 0.875rem;
            text-align: center;
          }

          .scores-header span:first-child {
            text-align: left;
          }

          .score-row {
            display: grid;
            grid-template-columns: 100px 1fr 1fr;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid var(--light-gray, #e5e7eb);
            align-items: center;
          }

          .score-row:last-child {
            border-bottom: none;
          }

          .game-label {
            font-weight: 500;
            color: var(--secondary, #1f2937);
            font-size: 0.875rem;
          }

          .score-input {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid var(--light-gray, #e5e7eb);
            border-radius: 8px;
            font-size: 1.25rem;
            font-weight: 600;
            text-align: center;
            transition: border-color 0.2s ease;
            -moz-appearance: textfield;
            box-sizing: border-box;
          }

          .score-input::-webkit-outer-spin-button,
          .score-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }

          .score-input:focus {
            outline: none;
            border-color: var(--primary, #3b82f6);
          }

          .score-input::placeholder {
            color: var(--gray, #9ca3af);
            font-weight: 400;
          }

          .add-game-btn {
            width: 100%;
            padding: 12px;
            font-weight: 500;
          }

          .winner-display {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 16px;
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid var(--success, #22c55e);
            border-radius: 8px;
            color: var(--success, #22c55e);
            font-weight: 600;
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 8px;
            padding-top: 16px;
            border-top: 1px solid var(--light-gray, #e5e7eb);
          }

          .btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: none;
          }

          .btn-outline {
            background: transparent;
            border: 1px solid var(--light-gray, #e5e7eb);
            color: var(--secondary, #1f2937);
          }

          .btn-outline:hover {
            background: var(--light-gray, #f3f4f6);
          }

          .btn-primary {
            background: var(--primary, #3b82f6);
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: #2563eb;
          }

          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          @media (max-width: 500px) {
            .score-modal-overlay {
              padding: 10px;
            }

            .score-modal-container {
              max-height: 95vh;
            }

            .scores-header,
            .score-row {
              grid-template-columns: 80px 1fr 1fr;
              gap: 8px;
              padding: 10px 12px;
            }

            .score-input {
              padding: 8px;
              font-size: 1.1rem;
            }

            .players-display {
              flex-direction: column;
              gap: 8px;
            }

            .modal-actions {
              flex-direction: column;
            }

            .modal-actions .btn {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
};

export default ScoreEntryModal;