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
    if (calculatedWinner) {
      setWinner(calculatedWinner);
    }
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
        if (p1 === p2) return 'draw';
        return p1 > p2 ? match.player1Id : match.player2Id;
      } else {
        // Aggregate score for multi-game fixed (e.g. 2 games to 15)
        let p1Total = 0;
        let p2Total = 0;
        
        validScores.forEach(score => {
          p1Total += parseInt(score.player1);
          p2Total += parseInt(score.player2);
        });
        
        if (p1Total === p2Total) return 'draw';
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
      
      // If all games played and tied
      if (validScores.length === formatConfig.games && p1Wins === p2Wins) return 'draw';

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

  // Handle input focus - clear if value is 0
  const handleFocus = (gameIndex, player) => {
    const currentValue = scores[gameIndex][player];
    if (currentValue === '0') {
      const newScores = [...scores];
      newScores[gameIndex] = {
        ...newScores[gameIndex],
        [player]: ''
      };
      setScores(newScores);
    }
  };

  // Check if form is valid
  const isFormValid = () => {
    const hasValidScore = scores.some(s => s.player1 !== '' && s.player2 !== '');
    return hasValidScore && winner !== null;
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 9999
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '448px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#111827',
              margin: 0
            }}>Enter Match Score</h2>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '1.125rem',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  {match.player1Name}
                  {winner === match.player1Id && <Trophy className="w-5 h-5" style={{ color: '#eab308' }} />}
                </div>
              </div>
              <div style={{ color: '#9ca3af', fontWeight: 'bold' }}>vs</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '1.125rem',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  {match.player2Name}
                  {winner === match.player2Id && <Trophy className="w-5 h-5" style={{ color: '#eab308' }} />}
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#dbeafe',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#1e3a8a'
              }}>{match.format}</div>
              {gamesWon && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#1e40af',
                  marginTop: '4px'
                }}>
                  Games: {gamesWon.p1Wins} - {gamesWon.p2Wins} (First to {formatConfig.gamesToWin})
                </div>
              )}
            </div>

            {/* Manual Result Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                fontWeight: '600', 
                color: '#6b7280', 
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Result Override
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setWinner(match.player1Id)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: `1px solid ${winner === match.player1Id ? '#2563eb' : '#e5e7eb'}`,
                    backgroundColor: winner === match.player1Id ? '#eff6ff' : 'white',
                    color: winner === match.player1Id ? '#1e40af' : '#374151',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {match.player1Name.split(' ')[0]}
                </button>
                <button
                  type="button"
                  onClick={() => setWinner('draw')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: `1px solid ${winner === 'draw' ? '#2563eb' : '#e5e7eb'}`,
                    backgroundColor: winner === 'draw' ? '#eff6ff' : 'white',
                    color: winner === 'draw' ? '#1e40af' : '#374151',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() => setWinner(match.player2Id)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: `1px solid ${winner === match.player2Id ? '#2563eb' : '#e5e7eb'}`,
                    backgroundColor: winner === match.player2Id ? '#eff6ff' : 'white',
                    color: winner === match.player2Id ? '#1e40af' : '#374151',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {match.player2Name.split(' ')[0]}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px'
              }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#dc2626',
                  margin: 0
                }}>{error}</p>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#4b5563',
                marginBottom: '16px'
              }}>
                <div style={{ textAlign: 'left' }}>{match.player1Name.split(' ')[0]}</div>
                <div style={{ textAlign: 'center' }}></div>
                <div style={{ textAlign: 'right' }}>{match.player2Name.split(' ')[0]}</div>
              </div>

              {scores.map((score, index) => (
                <div key={index} style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>{getGameLabel(index)}</div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <input
                      type="number"
                      value={score.player1}
                      onChange={(e) => handleScoreChange(index, 'player1', e.target.value)}
                      onFocus={() => handleFocus(index, 'player1')}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        textAlign: 'center',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                    <div style={{ textAlign: 'center', color: '#9ca3af' }}>-</div>
                    <input
                      type="number"
                      value={score.player2}
                      onChange={(e) => handleScoreChange(index, 'player2', e.target.value)}
                      onFocus={() => handleFocus(index, 'player2')}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        textAlign: 'center',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                </div>
              ))}

              {shouldShowNextGame() && (
                <button
                  type="button"
                  onClick={addNextGame}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    color: '#4b5563',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.color = '#2563eb';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.color = '#4b5563';
                  }}
                >
                  + Add Game {scores.length + 1}
                </button>
              )}

              {winner && (
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '16px'
                }}>
                  {winner === 'draw' ? (
                    <>
                      <span style={{ fontSize: '1.25rem' }}>🤝</span>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#14532d'
                      }}>
                        Match Draw
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" style={{ color: '#16a34a' }} />
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#14532d'
                      }}>
                        Winner: {winner === match.player1Id ? match.player1Name : match.player2Name}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              paddingTop: '16px'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontWeight: '500',
                  color: '#374151',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormValid() || loading}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: isFormValid() && !loading ? '#2563eb' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: isFormValid() && !loading ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => {
                  if (isFormValid() && !loading) {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                  }
                }}
                onMouseOut={(e) => {
                  if (isFormValid() && !loading) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
              >
                {loading ? 'Submitting...' : 'Submit Score'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScoreEntryModal;