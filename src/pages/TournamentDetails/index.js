// src/components/TournamentDetails.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Users, Trophy, CheckCircle, XCircle, 
  Edit2, AlertCircle, Play, RefreshCw, Flag, Award, 
  Settings
} from 'lucide-react';
import { 
  getTournament, joinTournament, leaveTournament, updateMatchScore,
  getMatchesByTournament, generateTournamentGroups, generateGroupMatches,
  updateTournament, completeTournament, getTournamentSummary,
  updateTournamentGroupSettings 
} from '../../firebase/firestore';
import { auth } from '../../firebase/config';
import ScoreEntryModal from '../../components/scoreEntryModal';
import './TournamentDetails.css';
const TournamentDetails = ({ userProfile }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [generatingMatches, setGeneratingMatches] = useState(false);
  const [startingTournament, setStartingTournament] = useState(false);
  const [completingTournament, setCompletingTournament] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [completionError, setCompletionError] = useState('');
  const [activeSettingsGroup, setActiveSettingsGroup] = useState(null); 
  const [savingSettings, setSavingSettings] = useState(false);
  const currentUserId = auth.currentUser?.uid;

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
    setIsParticipant(
      tournamentData.participants?.some(p => p.userId === currentUserId) || false
    );
    
    // Check if current user is the tournament owner/creator
    setIsOwner(tournamentData.createdBy === currentUserId);
    
    // Generate groups if tournament is not upcoming and has participants
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
    
    // Load standings if tournament is active or completed
    if (tournamentData.status === 'active' || tournamentData.status === 'completed') {
      const summary = await getTournamentSummary(id);
      if (summary) {
        setStandings(summary.standings);
      }
    }
    
    setLoading(false);
  };

  const handleJoinTournament = async () => {
    if (!userProfile) return;
    
    const result = await joinTournament(id, currentUserId, userProfile);
    if (result.success) {
      loadTournamentData();
    }
  };

  const handleLeaveTournament = async () => {
    if (!userProfile) return;
    
    const result = await leaveTournament(id, currentUserId);
    if (result.success) {
      loadTournamentData();
    }
  };

  // Start tournament manually (owner only)
  const handleStartTournament = async () => {
    if (!isOwner || tournament.participants?.length < 2) return;
    
    setStartingTournament(true);
    
    try {
      await updateTournament(id, { status: 'active' });
      await loadTournamentData();
    } catch (error) {
      console.error('Error starting tournament:', error);
    }
    
    setStartingTournament(false);
  };

// Update your handleGenerateMatches function
  const handleGenerateMatches = async () => {
    if (!isOwner || matches.length > 0) return;
    
    setGeneratingMatches(true);
    
    try {
      const generatedGroups = generateTournamentGroups(
        tournament.participants,
        tournament.groupSize || 4
      );
      
      for (let i = 0; i < generatedGroups.length; i++) {
        const groupName = `Group ${String.fromCharCode(65 + i)}`;
        
        // CHANGED: Use the helper to get specific group format
        const specificFormat = getGroupFormat(groupName);

        await generateGroupMatches(
          id,
          specificFormat, // Use the specific format here
          generatedGroups[i],
          groupName
        );
      }
      
      await loadTournamentData();
    } catch (error) {
      console.error('Error generating matches:', error);
    }
    
    setGeneratingMatches(false);
  };

  // Complete tournament (owner only)
  const handleCompleteTournament = async () => {
    if (!isOwner) return;
    
    setCompletingTournament(true);
    setCompletionError('');
    setCompletionResult(null);
    
    try {
      const result = await completeTournament(id);
      
      if (result.success) {
        setCompletionResult(result);
        await loadTournamentData();
      } else {
        setCompletionError(result.error);
      }
    } catch (error) {
      console.error('Error completing tournament:', error);
      setCompletionError(error.message);
    }
    
    setCompletingTournament(false);
  };

  // Check if user can edit a specific match
  const canEditMatch = (match) => {
    if (tournament.status === 'completed') return false;
    if (match.status === 'completed') return false;
    if (isOwner) return true;
    return match.players?.includes(currentUserId);
  };

  // Handle score submission from modal (NO ELO UPDATE - that happens at tournament end)
  const handleScoreSubmit = async (matchId, scores, winnerId) => {
    try {
      await updateMatchScore(matchId, scores, winnerId);
      
      await loadTournamentData();
      setSelectedMatch(null);
      
      return { success: true };
    } catch (error) {
      console.error('Error submitting score:', error);
      return { success: false, error: error.message };
    }
  };

  // Format score display for table
  const formatScoreDisplay = (match) => {
    if (!match.scores || match.scores.length === 0) {
      return '-';
    }
    
    return match.scores.map((score, i) => (
      `${score.player1}-${score.player2}`
    )).join(', ');
  };

  // Get winner name
  const getWinnerName = (match) => {
    if (!match.winner) return '-';
    return match.winner === match.player1Id ? match.player1Name : match.player2Name;
  };

  // Group matches by groupName
  const getMatchesByGroup = () => {
    const grouped = {};
    matches.forEach(match => {
      const group = match.groupName || 'Ungrouped';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(match);
    });
    return grouped;
  };

  // Check if all matches are completed
  const allMatchesCompleted = () => {
    return matches.length > 0 && matches.every(m => m.status === 'completed');
  };

  const groupedMatches = getMatchesByGroup();
  const completedMatchCount = matches.filter(m => m.status === 'completed').length;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Helper to determine the format for a specific group
  const getGroupFormat = (groupName) => {
    if (tournament.groupSettings && tournament.groupSettings[groupName]) {
      return tournament.groupSettings[groupName].format;
    }
    return tournament.format; // Fallback to global default
  };

  const handleUpdateGroupFormat = async (groupName, newFormat) => {
    setSavingSettings(true);
    // If returning to default (null), or setting a specific format
    const settings = newFormat === 'default' ? null : { format: newFormat };
    
    // If "default" is selected, we effectively remove the override by setting it to null
    // However, firestore update needs a value. 
    // If your backend logic in step 1 allows simple overwrites, we just save the object.
    
    // Logic: If 'default', we pass null to indicate removal of override, 
    // but for the UI flow let's just save the format string or null.
    
    await updateTournamentGroupSettings(id, groupName, settings);
    await loadTournamentData(); // Reload to see changes
    setActiveSettingsGroup(null);
    setSavingSettings(false);
  };

  // OPTIONS FOR THE DROPDOWN
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

          {/* Match Progress */}
          {matches.length > 0 && (
            <div className="match-progress">
              <div className="progress-label">
                <span>Match Progress</span>
                <span>{completedMatchCount} / {matches.length} completed</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${(completedMatchCount / matches.length) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {tournament.description && (
            <div className="tournament-description">
              <p>{tournament.description}</p>
            </div>
          )}

          <div className="tournament-actions">
            {/* Player Actions */}
            {tournament.status === 'upcoming' && !isOwner && (
              <>
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
              </>
            )}

            {/* Owner Actions */}
            {isOwner && (
              <div className="owner-actions">
                {tournament.status === 'upcoming' && tournament.participants?.length >= 2 && (
                  <button 
                    className="btn btn-primary"
                    onClick={handleStartTournament}
                    disabled={startingTournament}
                  >
                    <Play className="w-5 h-5" />
                    {startingTournament ? 'Starting...' : 'Start Tournament'}
                  </button>
                )}
                
                {tournament.status === 'active' && matches.length === 0 && tournament.participants?.length >= 2 && (
                  <button 
                    className="btn btn-success"
                    onClick={handleGenerateMatches}
                    disabled={generatingMatches}
                  >
                    <RefreshCw className={`w-5 h-5 ${generatingMatches ? 'spin' : ''}`} />
                    {generatingMatches ? 'Generating...' : 'Generate Matches'}
                  </button>
                )}

                {tournament.status === 'active' && matches.length > 0 && (
                  <button 
                    className="btn btn-complete"
                    onClick={handleCompleteTournament}
                    disabled={completingTournament || !allMatchesCompleted()}
                    title={!allMatchesCompleted() ? 'Complete all matches first' : 'End tournament and calculate ELO'}
                  >
                    <Flag className={`w-5 h-5 ${completingTournament ? 'spin' : ''}`} />
                    {completingTournament ? 'Completing...' : 'Complete Tournament'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Completion Error */}
          {completionError && (
            <div className="completion-error">
              <AlertCircle className="w-5 h-5" />
              <span>{completionError}</span>
            </div>
          )}

          {/* Owner Info Banners */}
          {isOwner && tournament.status === 'upcoming' && (
            <div className="owner-info-banner">
              <AlertCircle className="w-5 h-5" />
              <div>
                <strong>You are the tournament organizer.</strong>
                <p>Once you have enough participants, click "Start Tournament" to begin. Then generate matches for all groups.</p>
              </div>
            </div>
          )}

          {isOwner && tournament.status === 'active' && matches.length === 0 && (
            <div className="owner-info-banner warning">
              <AlertCircle className="w-5 h-5" />
              <div>
                <strong>Tournament is active but has no matches.</strong>
                <p>Click "Generate Matches" to create round-robin matches for all groups.</p>
              </div>
            </div>
          )}

          {isOwner && tournament.status === 'active' && allMatchesCompleted() && (
            <div className="owner-info-banner success">
              <CheckCircle className="w-5 h-5" />
              <div>
                <strong>All matches completed!</strong>
                <p>Click "Complete Tournament" to finalize results and update player ELO ratings.</p>
              </div>
            </div>
          )}

          {isOwner && tournament.status === 'active' && matches.length > 0 && !allMatchesCompleted() && (
            <div className="owner-info-banner">
              <AlertCircle className="w-5 h-5" />
              <div>
                <strong>{matches.length - completedMatchCount} match(es) remaining.</strong>
                <p>Once all matches are completed, you can finalize the tournament.</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Tournament Completed Summary */}
        {tournament.status === 'completed' && standings.length > 0 && (
          <motion.div 
            className="tournament-summary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="summary-header">
              <Award className="w-8 h-8" />
              <h2>Tournament Results</h2>
            </div>
            
            <div className="standings-podium">
              {standings.slice(0, 3).map((player, index) => (
                <div key={player.userId} className={`podium-place place-${index + 1}`}>
                  <div className="podium-rank">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                  </div>
                  <div className="podium-name">{player.name}</div>
                  <div className="podium-stats">
                    {player.matchesWon}W - {player.matchesPlayed - player.matchesWon}L
                  </div>
                </div>
              ))}
            </div>

            <div className="full-standings">
              <h3>Final Standings</h3>
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Played</th>
                    <th>Won</th>
                    <th>Lost</th>
                    <th>Points +/-</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((player, index) => (
                    <tr 
                      key={player.userId}
                      className={player.userId === currentUserId ? 'is-me' : ''}
                    >
                      <td className="rank-cell">{index + 1}</td>
                      <td className="name-cell">{player.name}</td>
                      <td>{player.matchesPlayed}</td>
                      <td className="won-cell">{player.matchesWon}</td>
                      <td className="lost-cell">{player.matchesPlayed - player.matchesWon}</td>
                      <td className={`diff-cell ${player.pointDifference >= 0 ? 'positive' : 'negative'}`}>
                        {player.pointDifference >= 0 ? '+' : ''}{player.pointDifference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Participants List */}
        <motion.div 
          className="participants-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2>Participants ({tournament.participants?.length || 0})</h2>
          <div className="participants-grid">
            {tournament.participants?.length > 0 ? (
              tournament.participants.map((participant, index) => (
                <div 
                  key={participant.userId} 
                  className={`participant-card ${participant.userId === currentUserId ? 'is-me' : ''}`}
                >
                  <div className="participant-rank">#{index + 1}</div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {participant.name}
                      {participant.userId === currentUserId && <span className="me-badge">You</span>}
                    </span>
                    <span className="participant-elo">ELO: {participant.elo}</span>
                  </div>
                </div>
              ))
            ) : (
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
              {groups.map((group, groupIndex) => {
                const groupName = `Group ${String.fromCharCode(65 + groupIndex)}`;
                const currentFormat = getGroupFormat(groupName);
                const isCustom = tournament.groupSettings?.[groupName] != null;
                const hasMatches = matches.some(m => m.groupName === groupName); // ← ADD THIS

                return (
                  <div key={groupIndex} className="group-card card">
                    <div className="group-header">
                      <div className="group-title-stack">
                        <h3>{groupName}</h3>
                        <span className="group-rules-text">
                          {isCustom ? (
                            <span className="text-highlight">{currentFormat}</span>
                          ) : (
                            <span className="text-muted">Default ({currentFormat})</span>
                          )}
                        </span>
                      </div>
                      
                      {/* SETTINGS ICON (Only for Owner) */}
                      {isOwner && !hasMatches && (
                        <div className="settings-wrapper">
                          <button 
                            className={`btn-icon ${activeSettingsGroup === groupName ? 'active' : ''}`}
                            onClick={() => setActiveSettingsGroup(activeSettingsGroup === groupName ? null : groupName)}
                          >
                            <Settings className="w-4 h-4" />
                          </button>

                          {/* POPOVER MENU */}
                          <AnimatePresence>
                            {activeSettingsGroup === groupName && (
                              <motion.div 
                                className="settings-popover"
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              >
                                <h4>Edit Scoring</h4>
                                <div className="popover-options">
                                  <button 
                                    className={`popover-option ${!isCustom ? 'selected' : ''}`}
                                    onClick={() => handleUpdateGroupFormat(groupName, 'default')}
                                  >
                                    Use Default
                                  </button>
                                  <div className="divider"></div>
                                  {formatOptions.map(fmt => (
                                    <button
                                      key={fmt}
                                      className={`popover-option ${currentFormat === fmt && isCustom ? 'selected' : ''}`}
                                      onClick={() => handleUpdateGroupFormat(groupName, fmt)}
                                    >
                                      {fmt}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                    {hasMatches && (
                      <div className="format-locked-badge">
                        <span className="text-muted text-sm">✓ Format Locked</span>
                      </div>
                    )}
                    <div className="group-players">
                      {group.map((player, playerIndex) => (
                        <div 
                          key={player.userId} 
                          className={`group-player ${player.userId === currentUserId ? 'is-me' : ''}`}
                        >
                          <span className="player-seed">{playerIndex + 1}</span>
                          <span className="player-name">{player.name}</span>
                          <span className="player-elo">{player.elo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Matches Tables by Group */}
        {Object.keys(groupedMatches).length > 0 && (
          <motion.div 
            className="matches-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="section-header">
              <h2>Matches</h2>
              <div className="format-info">
                <AlertCircle className="w-4 h-4" />
                <span>Format: {tournament.format}</span>
              </div>
            </div>

            {Object.entries(groupedMatches).map(([groupName, groupMatches]) => (
              <div key={groupName} className="group-matches">
                <h3 className="group-matches-title">{groupName}</h3>
                <div className="matches-table-container">
                  <table className="matches-table">
                    <thead>
                      <tr>
                        <th>Player 1</th>
                        <th>Player 2</th>
                        <th>Score</th>
                        <th>Winner</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMatches.map((match) => (
                        <tr 
                          key={match.id} 
                          className={`
                            ${match.status === 'completed' ? 'completed' : ''}
                            ${match.players?.includes(currentUserId) ? 'my-match' : ''}
                          `}
                        >
                          <td className={match.winner === match.player1Id ? 'winner-cell' : ''}>
                            <div className="player-cell">
                              {match.player1Name}
                              {match.winner === match.player1Id && (
                                <Trophy className="w-4 h-4 winner-icon" />
                              )}
                            </div>
                          </td>
                          <td className={match.winner === match.player2Id ? 'winner-cell' : ''}>
                            <div className="player-cell">
                              {match.player2Name}
                              {match.winner === match.player2Id && (
                                <Trophy className="w-4 h-4 winner-icon" />
                              )}
                            </div>
                          </td>
                          <td className="score-cell">
                            {formatScoreDisplay(match)}
                          </td>
                          <td className="winner-name-cell">
                            {getWinnerName(match)}
                          </td>
                          <td>
                            <span className={`status-badge status-${match.status}`}>
                              {match.status}
                            </span>
                          </td>
                          <td>
                            {canEditMatch(match) ? (
                              <button 
                                className="btn btn-small btn-primary"
                                onClick={() => setSelectedMatch(match)}
                              >
                                <Edit2 className="w-4 h-4" />
                                Enter Score
                              </button>
                            ) : match.status === 'completed' ? (
                              <span className="completed-text">
                                <CheckCircle className="w-4 h-4" />
                                Done
                              </span>
                            ) : (
                              <span className="pending-text">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="table-legend">
              <div className="legend-item">
                <span className="legend-color my-match-color"></span>
                <span>Your Match</span>
              </div>
              <div className="legend-item">
                <span className="legend-color completed-color"></span>
                <span>Completed</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* No Matches Message */}
        {matches.length === 0 && tournament.status === 'active' && !isOwner && (
          <motion.div 
            className="no-matches-message"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AlertCircle className="w-8 h-8" />
            <p>No matches have been created for this tournament yet.</p>
            <p className="hint">The tournament organizer will generate matches soon.</p>
          </motion.div>
        )}

        {/* Tournament Not Started Message */}
        {tournament.status === 'upcoming' && (
          <motion.div 
            className="tournament-not-started"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Clock className="w-8 h-8" />
            <p>Tournament hasn't started yet.</p>
            <p className="hint">
              {isParticipant 
                ? "You're registered! Matches will be available once the tournament starts."
                : "Join now to participate when the tournament begins."
              }
            </p>
          </motion.div>
        )}
      </div>

      {/* Score Entry Modal */}
      {selectedMatch && (
        <ScoreEntryModal
          match={selectedMatch} 
          onClose={() => setSelectedMatch(null)}
          onSubmit={handleScoreSubmit}
          isOwner={isOwner}
        />
      )}
    </div>
  );
};

export default TournamentDetails;