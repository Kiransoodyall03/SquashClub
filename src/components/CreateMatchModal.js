// src/components/CreateMatchModal.js

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Users, 
  Trophy, 
  Target,
  Zap,
  Coffee,
  AlertCircle,
  Search,
  UserPlus,
  Check,
  ChevronDown
} from 'lucide-react';
import { getAllUsers, createIndividualMatch } from '../firebase/firestore';
import { auth } from '../firebase/config';

const CreateMatchModal = ({ isOpen, onClose, onMatchCreated, userProfile }) => {
  const [matchType, setMatchType] = useState('1v1'); // 1v1 or 2v2
  const [matchMode, setMatchMode] = useState('ranked'); // ranked or casual
  const [format, setFormat] = useState('Best of 3 to 11');
  const [opponent, setOpponent] = useState(null);
  const [partner, setPartner] = useState(null); // For 2v2
  const [opponent2, setOpponent2] = useState(null); // For 2v2
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectingFor, setSelectingFor] = useState(null); // 'opponent', 'partner', 'opponent2'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Settings, 2: Select Players

  const currentUserId = auth.currentUser?.uid;

  const formatOptions = [
    '1 game to 21',
    '2 games to 15',
    '3 games to 11',
    'Best of 3 to 11',
    'Best of 3 to 15',
    'Best of 5 to 11',
    'Best of 5 to 15',
    'Best of 7 to 11'
  ];

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (matchMode === 'ranked') {
      const isRankedFormat = format.startsWith('Best of');
      if (!isRankedFormat) {
        setFormat('Best of 3 to 11'); // Default ranked format
      }
    }
  }, [matchMode, format]);

  const resetForm = () => {
    setMatchType('1v1');
    setMatchMode('ranked');
    setFormat('Best of 3 to 11');
    setOpponent(null);
    setPartner(null);
    setOpponent2(null);
    setSearchTerm('');
    setSelectingFor(null);
    setError('');
    setStep(1);
  };

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      // Filter out current user and disabled users, only show players
      const availableUsers = allUsers.filter(
        u => u.id !== currentUserId && !u.disabled && u.role === 'player'
      );
      setUsers(availableUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase());
    
    // Exclude already selected players
    const selectedIds = [opponent?.id, partner?.id, opponent2?.id].filter(Boolean);
    const notAlreadySelected = !selectedIds.includes(user.id);
    
    return matchesSearch && notAlreadySelected;
  });

  const handleSelectPlayer = (user) => {
    switch (selectingFor) {
      case 'opponent':
        setOpponent(user);
        break;
      case 'partner':
        setPartner(user);
        break;
      case 'opponent2':
        setOpponent2(user);
        break;
      default:
        break;
    }
    setSelectingFor(null);
    setSearchTerm('');
  };

  const removePlayer = (role) => {
    switch (role) {
      case 'opponent':
        setOpponent(null);
        break;
      case 'partner':
        setPartner(null);
        break;
      case 'opponent2':
        setOpponent2(null);
        break;
      default:
        break;
    }
  };

  const validateForm = () => {
    if (!opponent) {
      setError('Please select an opponent');
      return false;
    }
    
    if (matchType === '2v2') {
      if (!partner) {
        setError('Please select your partner');
        return false;
      }
      if (!opponent2) {
        setError('Please select a second opponent');
        return false;
      }
    }
    
    if (matchMode === 'ranked') {
      if (!format.startsWith('Best of')) {
        setError('Ranked matches must be a "Best of" format.');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const points = parseInt(format.split(' to ')[1]) || 0;

      const matchData = {
        matchType,
        matchMode,
        format,
        pointsPerGame: points,
        // Team 1
        team1: matchType === '1v1' 
          ? [{ id: currentUserId, name: `${userProfile.firstName} ${userProfile.lastName}`, elo: userProfile.elo }]
          : [
              { id: currentUserId, name: `${userProfile.firstName} ${userProfile.lastName}`, elo: userProfile.elo },
              { id: partner.id, name: `${partner.firstName} ${partner.lastName}`, elo: partner.elo }
            ],
        // Team 2
        team2: matchType === '1v1'
          ? [{ id: opponent.id, name: `${opponent.firstName} ${opponent.lastName}`, elo: opponent.elo }]
          : [
              { id: opponent.id, name: `${opponent.firstName} ${opponent.lastName}`, elo: opponent.elo },
              { id: opponent2.id, name: `${opponent2.firstName} ${opponent2.lastName}`, elo: opponent2.elo }
            ],
        createdBy: currentUserId
      };
      
      const result = await createIndividualMatch(matchData);
      
      if (result.success) {
        onMatchCreated && onMatchCreated(result.matchId);
        onClose();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    }
    
    setLoading(false);
  };

  const getFormatOptions = () => {
    if (matchMode === 'ranked') {
      return formatOptions
        .filter(f => f.startsWith('Best of'))
        .map(f => ({ value: f, label: f }));
    }
    return formatOptions.map(f => ({ value: f, label: f }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div 
          className="modal-content create-match-modal"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title">
              <Trophy className="w-6 h-6" />
              <h2>Create Match</h2>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="progress-steps">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
              <span className="step-number">1</span>
              <span className="step-label">Settings</span>
            </div>
            <div className="step-connector"></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
              <span className="step-number">2</span>
              <span className="step-label">Players</span>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Match Settings */}
          {step === 1 && (
            <div className="modal-body">
              {/* Match Type */}
              <div className="form-section">
                <label className="section-label">Match Type</label>
                <div className="option-cards">
                  <div 
                    className={`option-card ${matchType === '1v1' ? 'selected' : ''}`}
                    onClick={() => setMatchType('1v1')}
                  >
                    <Users className="w-8 h-8" />
                    <span className="option-title">1 vs 1</span>
                    <span className="option-desc">Singles match</span>
                    {matchType === '1v1' && <Check className="check-icon" />}
                  </div>
                  <div 
                    className={`option-card ${matchType === '2v2' ? 'selected' : ''}`}
                    onClick={() => setMatchType('2v2')}
                  >
                    <Users className="w-8 h-8" />
                    <span className="option-title">2 vs 2</span>
                    <span className="option-desc">Doubles match</span>
                    {matchType === '2v2' && <Check className="check-icon" />}
                  </div>
                </div>
              </div>

              {/* Match Mode */}
              <div className="form-section">
                <label className="section-label">Match Mode</label>
                <div className="option-cards">
                  <div 
                    className={`option-card ${matchMode === 'ranked' ? 'selected' : ''}`}
                    onClick={() => setMatchMode('ranked')}
                  >
                    <Zap className="w-8 h-8" />
                    <span className="option-title">Ranked</span>
                    <span className="option-desc">Affects ELO rating</span>
                    {matchMode === 'ranked' && <Check className="check-icon" />}
                  </div>
                  <div 
                    className={`option-card ${matchMode === 'casual' ? 'selected' : ''}`}
                    onClick={() => setMatchMode('casual')}
                  >
                    <Coffee className="w-8 h-8" />
                    <span className="option-title">Casual</span>
                    <span className="option-desc">Just for fun</span>
                    {matchMode === 'casual' && <Check className="check-icon" />}
                  </div>
                </div>
              </div>

              {/* Match Format */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="form-select"
                >
                  {getFormatOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="form-hint">
                  {matchMode === 'ranked' && 'Ranked matches must be a "Best of" format.'}
                </p>
              </div>

              {/* Match Summary */}
              <div className="match-summary">
                <Target className="w-5 h-5" />
                <span>{matchType} {matchMode} match • {format}</span>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => setStep(2)}>
                  Next: Select Players
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Players */}
          {step === 2 && (
            <div className="modal-body">
              {/* Your Team */}
              <div className="team-section">
                <h3 className="team-title">
                  <span className="team-badge team-1">Team 1</span>
                  Your Team
                </h3>
                
                {/* Current User (You) */}
                <div className="player-slot filled">
                  <div className="player-info">
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt="" className="player-avatar" />
                    ) : (
                      <div className="player-avatar-placeholder">
                        {userProfile?.firstName?.[0]}{userProfile?.lastName?.[0]}
                      </div>
                    )}
                    <div className="player-details">
                      <span className="player-name">
                        {userProfile?.firstName} {userProfile?.lastName}
                        <span className="you-tag">You</span>
                      </span>
                      <span className="player-elo">ELO: {userProfile?.elo || 1200}</span>
                    </div>
                  </div>
                </div>

                {/* Partner (for 2v2) */}
                {matchType === '2v2' && (
                  partner ? (
                    <div className="player-slot filled">
                      <div className="player-info">
                        {partner.photoURL ? (
                          <img src={partner.photoURL} alt="" className="player-avatar" />
                        ) : (
                          <div className="player-avatar-placeholder">
                            {partner.firstName?.[0]}{partner.lastName?.[0]}
                          </div>
                        )}
                        <div className="player-details">
                          <span className="player-name">{partner.firstName} {partner.lastName}</span>
                          <span className="player-elo">ELO: {partner.elo || 1200}</span>
                        </div>
                      </div>
                      <button 
                        className="remove-player-btn"
                        onClick={() => removePlayer('partner')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      className={`player-slot empty ${selectingFor === 'partner' ? 'selecting' : ''}`}
                      onClick={() => setSelectingFor('partner')}
                    >
                      <UserPlus className="w-5 h-5" />
                      <span>Select your partner</span>
                    </div>
                  )
                )}
              </div>

              {/* VS Divider */}
              <div className="vs-divider">
                <span>VS</span>
              </div>

              {/* Opponent Team */}
              <div className="team-section">
                <h3 className="team-title">
                  <span className="team-badge team-2">Team 2</span>
                  Opponent{matchType === '2v2' ? 's' : ''}
                </h3>
                
                {/* Opponent 1 */}
                {opponent ? (
                  <div className="player-slot filled">
                    <div className="player-info">
                      {opponent.photoURL ? (
                        <img src={opponent.photoURL} alt="" className="player-avatar" />
                      ) : (
                        <div className="player-avatar-placeholder opponent">
                          {opponent.firstName?.[0]}{opponent.lastName?.[0]}
                        </div>
                      )}
                      <div className="player-details">
                        <span className="player-name">{opponent.firstName} {opponent.lastName}</span>
                        <span className="player-elo">ELO: {opponent.elo || 1200}</span>
                      </div>
                    </div>
                    <button 
                      className="remove-player-btn"
                      onClick={() => removePlayer('opponent')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    className={`player-slot empty ${selectingFor === 'opponent' ? 'selecting' : ''}`}
                    onClick={() => setSelectingFor('opponent')}
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Select opponent</span>
                  </div>
                )}

                {/* Opponent 2 (for 2v2) */}
                {matchType === '2v2' && (
                  opponent2 ? (
                    <div className="player-slot filled">
                      <div className="player-info">
                        {opponent2.photoURL ? (
                          <img src={opponent2.photoURL} alt="" className="player-avatar" />
                        ) : (
                          <div className="player-avatar-placeholder opponent">
                            {opponent2.firstName?.[0]}{opponent2.lastName?.[0]}
                          </div>
                        )}
                        <div className="player-details">
                          <span className="player-name">{opponent2.firstName} {opponent2.lastName}</span>
                          <span className="player-elo">ELO: {opponent2.elo || 1200}</span>
                        </div>
                      </div>
                      <button 
                        className="remove-player-btn"
                        onClick={() => removePlayer('opponent2')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      className={`player-slot empty ${selectingFor === 'opponent2' ? 'selecting' : ''}`}
                      onClick={() => setSelectingFor('opponent2')}
                    >
                      <UserPlus className="w-5 h-5" />
                      <span>Select second opponent</span>
                    </div>
                  )
                )}
              </div>

              {/* Player Selection Dropdown */}
              {selectingFor && (
                <div className="player-selector">
                  <div className="selector-header">
                    <Search className="w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => setSelectingFor(null)}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="selector-list">
                    {filteredUsers.length === 0 ? (
                      <div className="no-results">No players found</div>
                    ) : (
                      filteredUsers.map(user => (
                        <div 
                          key={user.id}
                          className="selector-item"
                          onClick={() => handleSelectPlayer(user)}
                        >
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="selector-avatar" />
                          ) : (
                            <div className="selector-avatar-placeholder">
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                          )}
                          <div className="selector-details">
                            <span className="selector-name">
                              {user.firstName} {user.lastName}
                            </span>
                            <span className="selector-elo">ELO: {user.elo || 1200}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ELO Impact Preview (for ranked) */}
              {matchMode === 'ranked' && opponent && (
                <div className="elo-preview">
                  <Zap className="w-5 h-5" />
                  <div className="elo-preview-content">
                    <span className="elo-preview-title">Estimated ELO Change</span>
                    <span className="elo-preview-values">
                      Win: <span className="elo-gain">+{calculateEstimatedElo(true)}</span> | 
                      Loss: <span className="elo-loss">{calculateEstimatedElo(false)}</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setStep(1)}>
                  Back
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      <Trophy className="w-5 h-5" />
                      Create Match
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: var(--spacing-xl);
        }

        .create-match-modal {
          background: var(--white);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 550px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--light-gray);
          position: sticky;
          top: 0;
          background: var(--white);
          z-index: 10;
        }

        .modal-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--primary);
        }

        .modal-title h2 {
          margin: 0;
          font-size: 1.25rem;
        }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray);
          padding: var(--spacing-xs);
          border-radius: var(--radius-md);
          transition: all var(--transition-base);
        }

        .close-btn:hover {
          background: var(--light-gray);
          color: var(--secondary);
        }

        .progress-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-lg);
          gap: var(--spacing-md);
        }

        .progress-step {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          color: var(--gray);
        }

        .progress-step.active {
          color: var(--primary);
        }

        .step-number {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-full);
          background: var(--light-gray);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .progress-step.active .step-number {
          background: var(--gradient-primary);
          color: var(--white);
        }

        .step-label {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .step-connector {
          width: 40px;
          height: 2px;
          background: var(--light-gray);
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
          margin: 0 var(--spacing-lg);
        }

        .modal-body {
          padding: var(--spacing-lg);
        }

        .form-section {
          margin-bottom: var(--spacing-xl);
        }

        .section-label {
          display: block;
          font-weight: 600;
          color: var(--secondary);
          margin-bottom: var(--spacing-md);
        }

        .option-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }

        .option-card {
          position: relative;
          padding: var(--spacing-lg);
          border: 2px solid var(--light-gray);
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: center;
          transition: all var(--transition-base);
        }

        .option-card:hover {
          border-color: var(--primary);
          background: rgba(255, 107, 53, 0.05);
        }

        .option-card.selected {
          border-color: var(--primary);
          background: rgba(255, 107, 53, 0.1);
        }

        .option-card svg:first-child {
          color: var(--primary);
          margin-bottom: var(--spacing-sm);
        }

        .option-title {
          display: block;
          font-weight: 600;
          color: var(--secondary);
          margin-bottom: var(--spacing-xs);
        }

        .option-desc {
          display: block;
          font-size: 0.75rem;
          color: var(--gray);
        }

        .check-icon {
          position: absolute;
          top: var(--spacing-sm);
          right: var(--spacing-sm);
          width: 20px;
          height: 20px;
          color: var(--success);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .form-label {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--secondary);
        }

        .form-select {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-md);
          font-size: 1rem;
          cursor: pointer;
        }

        .form-hint {
          font-size: 0.75rem;
          color: var(--gray);
        }

        .match-summary {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: rgba(255, 107, 53, 0.1);
          border-radius: var(--radius-md);
          color: var(--primary);
          font-weight: 500;
          margin-bottom: var(--spacing-lg);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-md);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--light-gray);
          margin-top: var(--spacing-lg);
        }

        /* Step 2 Styles */
        .team-section {
          margin-bottom: var(--spacing-lg);
        }

        .team-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
          font-size: 1rem;
        }

        .team-badge {
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .team-badge.team-1 {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .team-badge.team-2 {
          background: rgba(244, 67, 54, 0.1);
          color: var(--danger);
        }

        .player-slot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-md);
          border: 2px dashed var(--light-gray);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-sm);
          transition: all var(--transition-base);
        }

        .player-slot.filled {
          border-style: solid;
          border-color: var(--light-gray);
          background: var(--off-white);
        }

        .player-slot.empty {
          cursor: pointer;
          justify-content: center;
          gap: var(--spacing-sm);
          color: var(--gray);
        }

        .player-slot.empty:hover,
        .player-slot.selecting {
          border-color: var(--primary);
          background: rgba(255, 107, 53, 0.05);
          color: var(--primary);
        }

        .player-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .player-avatar {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          object-fit: cover;
        }

        .player-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          background: var(--gradient-primary);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .player-avatar-placeholder.opponent {
          background: linear-gradient(135deg, var(--danger), #d32f2f);
        }

        .player-details {
          display: flex;
          flex-direction: column;
        }

        .player-name {
          font-weight: 600;
          color: var(--secondary);
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

        .remove-player-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray);
          padding: var(--spacing-xs);
          border-radius: var(--radius-md);
        }

        .remove-player-btn:hover {
          background: rgba(244, 67, 54, 0.1);
          color: var(--danger);
        }

        .vs-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: var(--spacing-lg) 0;
        }

        .vs-divider span {
          padding: var(--spacing-sm) var(--spacing-lg);
          background: var(--secondary);
          color: var(--white);
          font-weight: 700;
          border-radius: var(--radius-full);
        }

        .player-selector {
          position: absolute;
          left: var(--spacing-lg);
          right: var(--spacing-lg);
          background: var(--white);
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 20;
          margin-top: var(--spacing-sm);
        }

        .selector-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--light-gray);
        }

        .selector-header input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 0.875rem;
        }

        .selector-header button {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray);
        }

        .selector-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .selector-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          cursor: pointer;
          transition: background var(--transition-base);
        }

        .selector-item:hover {
          background: var(--light-gray);
        }

        .selector-avatar {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          object-fit: cover;
        }

        .selector-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background: var(--gradient-primary);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .selector-details {
          display: flex;
          flex-direction: column;
        }

        .selector-name {
          font-weight: 500;
          font-size: 0.875rem;
        }

        .selector-elo {
          font-size: 0.75rem;
          color: var(--gray);
        }

        .no-results {
          padding: var(--spacing-lg);
          text-align: center;
          color: var(--gray);
        }

        .elo-preview {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: rgba(33, 150, 243, 0.1);
          border-radius: var(--radius-md);
          margin-top: var(--spacing-lg);
        }

        .elo-preview svg {
          color: #2196F3;
        }

        .elo-preview-content {
          display: flex;
          flex-direction: column;
        }

        .elo-preview-title {
          font-size: 0.75rem;
          color: var(--gray);
        }

        .elo-preview-values {
          font-weight: 500;
          color: var(--secondary);
        }

        .elo-gain {
          color: var(--success);
        }

        .elo-loss {
          color: var(--danger);
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

        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .option-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AnimatePresence>
  );

  function calculateEstimatedElo(win) {
    const currentUserElo = userProfile?.elo || 1200;
    let ownTeamElo;
    let opponentTeamElo;

    if (matchType === '1v1') {
      ownTeamElo = currentUserElo;
      opponentTeamElo = opponent?.elo || 1200;
    } else {
      if (!partner || !opponent || !opponent2) return 0;
      ownTeamElo = (currentUserElo + (partner.elo || 1200)) / 2;
      opponentTeamElo = ((opponent.elo || 1200) + (opponent2.elo || 1200)) / 2;
    }

    // Use same calculation as Chess.com
    const K = (userProfile?.matchesPlayed || 0) < 30 ? 40 : 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentTeamElo - ownTeamElo) / 400));
    const actualScore = win ? 1 : 0;
    const change = Math.round(K * (actualScore - expectedScore));
    
    return change;
  }
};

export default CreateMatchModal;