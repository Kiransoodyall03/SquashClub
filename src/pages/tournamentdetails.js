// src/pages/tournamentdetails.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Users, Trophy, CheckCircle, XCircle, 
  Edit2, AlertCircle, Play, RefreshCw, Flag, Award,
  Settings, Lock, ShieldAlert, UserPlus, UserMinus,
  RotateCcw, AlertTriangle, Trash2, GripVertical
} from 'lucide-react';
import { 
  getTournament, joinTournament, leaveTournament, updateMatchScore,
  getMatchesByTournament, generateTournamentGroups, generateGroupMatches,
  updateTournament, completeTournament, getTournamentSummary,
  updateTournamentGroupSettings, approveParticipant, rejectParticipant,
  removePlayerAfterMatchesCreated, restartTournament, shouldRestartTournament,
  getTournamentGroupWinners,
  deleteTournament, addGuestPlayer
} from '../firebase/firestore';
import { auth } from '../firebase/config';
import ScoreEntryModal from '../components/scoreEntryModal';
import PlayerRemovalModal from '../components/PlayerRemovalModal';
import TournamentRestartModal from '../components/TournamentRestartModal';
import TournamentDeleteModal from '../components/TournamentDeleteModal';
import GuestPlayerModal from '../components/GuestPlayerModal';


const TournamentDetails = ({ userProfile }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [standings, setStandings] = useState([]);
  const [groupWinners, setGroupWinners] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [generatingMatches, setGeneratingMatches] = useState(false);
  const [startingTournament, setStartingTournament] = useState(false);
  const [completingTournament, setCompletingTournament] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [completionError, setCompletionError] = useState('');
  const [activeSettingsGroup, setActiveSettingsGroup] = useState(null); 
  const [savingSettings, setSavingSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  
  // New state for player removal & restart
  const [showRemovalModal, setShowRemovalModal] = useState(false);
  const [selectedPlayerForRemoval, setSelectedPlayerForRemoval] = useState(null);
  const [removingPlayer, setRemovingPlayer] = useState(false);
  const [removalResult, setRemovalResult] = useState(null);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restartRecommendation, setRestartRecommendation] = useState(null);
  const [restartingTournament, setRestartingTournament] = useState(false);
  const [restartResult, setRestartResult] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTournament, setDeletingTournament] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  
  const currentUserId = auth.currentUser?.uid;
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [selectedGroupForGuest, setSelectedGroupForGuest] = useState(null);
  useEffect(() => {
    loadTournamentData();
  }, [id]);

  // Check restart recommendation when tournament is active and has matches
  useEffect(() => {
    if (isOwner && tournament?.status === 'active' && matches.length > 0) {
      checkRestartRecommendation();
    }
  }, [tournament, matches, isOwner]);

  const checkRestartRecommendation = async () => {
    const recommendation = await shouldRestartTournament(id);
    if (recommendation.success) {
      setRestartRecommendation(recommendation);
    }
  };

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
      tournamentData.participants?.some(p => p.userId === currentUserId && p.status !== 'no-show') || false
    );
    
    // Check if current user is pending
    setIsPending(
      tournamentData.pendingParticipants?.some(p => p.userId === currentUserId) || false
    );

    // Check if current user is the tournament owner/creator
    setIsOwner(tournamentData.createdBy === currentUserId);
    
    // Load matches
    const tournamentMatches = await getMatchesByTournament(id);
    setMatches(tournamentMatches);

    // Generate groups if tournament is not upcoming and has participants
    if (tournamentData.status !== 'upcoming' && tournamentData.participants?.length > 0) {
      if (tournamentMatches.length > 0) {
        // Reconstruct groups from matches to ensure consistency with what was generated
        const groupMap = {};
        tournamentMatches.forEach(m => {
           const gName = m.groupName || 'Ungrouped';
           if (!groupMap[gName]) groupMap[gName] = new Set();
           groupMap[gName].add(m.player1Id);
           groupMap[gName].add(m.player2Id);
        });
        
        const participantsMap = {};
        tournamentData.participants.forEach(p => participantsMap[p.userId] = p);
        
        const reconstructedGroups = Object.keys(groupMap).sort().map(gName => {
           return Array.from(groupMap[gName]).map(uid => participantsMap[uid]).filter(Boolean);
        });
        
        reconstructedGroups.forEach(g => g.sort((a, b) => (b.elo || 1200) - (a.elo || 1200)));
        setGroups(reconstructedGroups);
      } else {
        const activeParticipants = tournamentData.participants.filter(p => p.status !== 'no-show');
        const generatedGroups = generateTournamentGroups(
          activeParticipants,
          tournamentData.groupSize || 4
        );
        setGroups(generatedGroups);
      }
    }
    
    // Load standings if tournament is active or completed
    if (tournamentData.status === 'active' || tournamentData.status === 'completed') {
      const summary = await getTournamentSummary(id);
      if (summary) {
        setStandings(summary.standings);
      }
      
      if (tournamentData.status === 'completed') {
        const winners = await getTournamentGroupWinners(id);
        setGroupWinners(winners);
      }
    }
    
    setLoading(false);
  };

  const handleJoinClick = () => {
    if (tournament.password && !password && !showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }
    handleJoinTournament();
  };

  const handleJoinTournament = async () => {
    if (!userProfile) return;
    setJoinError('');
    
    const result = await joinTournament(id, currentUserId, userProfile, password);
    if (result.success) {
      setShowPasswordInput(false);
      setPassword('');
      loadTournamentData();
    } else {
      setJoinError(result.error);
    }
  };

  const handleLeaveTournament = async () => {
    if (!userProfile) return;
    
    const result = await leaveTournament(id, currentUserId);
    if (result.success) {
      loadTournamentData();
    }
  };

  const handleApprove = async (participant) => {
    await approveParticipant(id, participant);
    loadTournamentData();
  };

  const handleReject = async (participant) => {
    await rejectParticipant(id, participant);
    loadTournamentData();
  };

  // Open removal modal
  const handleRemovePlayerClick = (participant) => {
    setSelectedPlayerForRemoval(participant);
    setShowRemovalModal(true);
    setRemovalResult(null);
  };

  // Remove player (after matches created)
  const handleRemovePlayer = async () => {
    if (!selectedPlayerForRemoval) return;
    
    setRemovingPlayer(true);
    const result = await removePlayerAfterMatchesCreated(id, selectedPlayerForRemoval.userId);
    setRemovingPlayer(false);
    
    if (result.success) {
      setRemovalResult(result);
      await loadTournamentData();
      await checkRestartRecommendation(); // Update recommendation after removal
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setShowRemovalModal(false);
        setSelectedPlayerForRemoval(null);
        setRemovalResult(null);
      }, 3000);
    } else {
      setRemovalResult(result);
    }
  };

  // Open restart modal
  const handleRestartClick = async () => {
    await checkRestartRecommendation();
    setShowRestartModal(true);
    setRestartResult(null);
  };

  // Restart tournament
  const handleRestartTournament = async () => {
    setRestartingTournament(true);
    
    // Create matches function to pass to restart
    const createMatches = async (tournamentId, activeParticipants) => {
      const generatedGroups = generateTournamentGroups(
        activeParticipants,
        tournament.groupSize || 4
      );
      
      for (let i = 0; i < generatedGroups.length; i++) {
        const groupName = `Group ${String.fromCharCode(65 + i)}`;
        const specificFormat = getGroupFormat(groupName);
        
        await generateGroupMatches(
          tournamentId,
          specificFormat,
          generatedGroups[i],
          groupName
        );
      }
    };
    
    const result = await restartTournament(id, createMatches);
    setRestartingTournament(false);
    
    if (result.success) {
      setRestartResult(result);
      await loadTournamentData();
      
      // Auto-close after 4 seconds
      setTimeout(() => {
        setShowRestartModal(false);
        setRestartResult(null);
      }, 4000);
    } else {
      setRestartResult(result);
    }
  };

  // Delete tournament
  const handleDeleteTournament = async () => {
    setDeletingTournament(true);
    
    const result = await deleteTournament(id);
    setDeletingTournament(false);
    
    if (result.success) {
      setDeleteResult(result);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } else {
      setDeleteResult(result);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, player, groupIndex) => {
    setDraggedItem({ player, groupIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetGroupIndex) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const { player, groupIndex: sourceGroupIndex } = draggedItem;
    
    if (sourceGroupIndex === targetGroupIndex) {
      setDraggedItem(null);
      return;
    }

    const newGroups = [...groups];
    
    // Remove from source
    newGroups[sourceGroupIndex] = newGroups[sourceGroupIndex].filter(p => p.userId !== player.userId);
    
    // Add to target
    newGroups[targetGroupIndex] = [...newGroups[targetGroupIndex], player];
    
    // Sort target group by ELO
    newGroups[targetGroupIndex].sort((a, b) => (b.elo || 1200) - (a.elo || 1200));
    
    setGroups(newGroups);
    setDraggedItem(null);
  };

  // Add Guest Handler
  const handleAddGuest = (groupIndex, groupName) => {
    setSelectedGroupForGuest({ index: groupIndex, name: groupName });
    setShowGuestModal(true);
  };
  const confirmAddGuest = async (guestName) => {
  if (!selectedGroupForGuest) return;
  
  const result = await addGuestPlayer(id, guestName);
  if (result.success) {
    // Update local state to reflect change immediately
    const newParticipant = result.participant;
    
    // Update groups
    const newGroups = [...groups];
    if (!newGroups[selectedGroupForGuest.index]) {
      newGroups[selectedGroupForGuest.index] = [];
    }
    newGroups[selectedGroupForGuest.index].push(newParticipant);
    setGroups(newGroups);
    
    setShowGuestModal(false);
    setSelectedGroupForGuest(null);
  } else {
    alert("Failed to add guest: " + result.error);
  }
};

  // Start tournament manually (owner only)
const handleStartTournament = async () => {
  if (!isOwner || activeParticipants.length < 2) return;
  
  setStartingTournament(true);
  
  try {
    const now = new Date();
    
    // Format date as YYYY-MM-DD using local time
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    // Format time as HH:MM
    const currentTime = now.toTimeString().slice(0, 5);
    
    // Update status, date, and time to current system time
    await updateTournament(id, { 
      status: 'active',
      date: currentDate,
      time: currentTime
    });
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
      // Use current groups state (which might have been manually rearranged)
      const groupsToUse = groups;
      
      for (let i = 0; i < groupsToUse.length; i++) {
        const groupName = `Group ${String.fromCharCode(65 + i)}`;
        const specificFormat = getGroupFormat(groupName);

        await generateGroupMatches(
          id,
          specificFormat,
          groupsToUse[i],
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
  // UPDATED: Now allows editing completed matches (only tournament completion prevents editing)
  const canEditMatch = (match) => {
    if (tournament.status === 'completed') return false;
    // Removed the check for match.status === 'completed' to allow re-editing scores
    if (isOwner) return true;
    return match.players?.includes(currentUserId);
  };

  // Handle score submission from modal
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
    const settings = newFormat === 'default' ? null : { format: newFormat };
    await updateTournamentGroupSettings(id, groupName, settings);
    await loadTournamentData();
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

  // Get active participants (excluding no-shows)
  const activeParticipants = tournament.participants?.filter(p => p.status !== 'no-show') || [];
  const noShowParticipants = tournament.participants?.filter(p => p.status === 'no-show') || [];

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
              <span>{activeParticipants.length} / {tournament.maxParticipants} players</span>
            </div>
            <div className="info-item">
              <Trophy className="w-5 h-5" />
              <span>{tournament.format}</span>
            </div>
            <div className="info-item">
              {tournament.password && <Lock className="w-5 h-5 text-warning" title="Password Protected" />}
              {tournament.requiresApproval && <ShieldAlert className="w-5 h-5 text-info" title="Requires Approval" />}
            </div>
          </div>

          {/* No-Show Warning Banner */}
          {isOwner && restartRecommendation?.shouldRestart && (
            <motion.div 
              className="no-show-warning"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertTriangle className="w-5 h-5" />
              <div className="warning-content">
                <strong>High no-show rate detected!</strong>
                <p>
                  {restartRecommendation.stats.noShowPercentage}% of players are no-shows 
                  ({restartRecommendation.stats.noShowCount}/{restartRecommendation.stats.totalParticipants})
                </p>
                <button 
                  className="btn btn-small btn-warning"
                  onClick={handleRestartClick}
                >
                  <RotateCcw className="w-4 h-4" />
                  Consider Restarting
                </button>
              </div>
            </motion.div>
          )}

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
                {isPending ? (
                  <div className="pending-status">
                    <Clock className="w-5 h-5" />
                    <span>Request Pending</span>
                  </div>
                ) : isParticipant ? (
                  <button 
                    className="btn btn-outline"
                    onClick={handleLeaveTournament}
                  >
                    <XCircle className="w-5 h-5" />
                    Leave Tournament
                  </button>
                ) : (
                  <div className="join-section">
                    {showPasswordInput && (
                      <div className="password-input-wrapper">
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Enter tournament password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    )}
                    <button 
                      className="btn btn-primary"
                      onClick={handleJoinClick}
                      disabled={tournament.participants?.length >= tournament.maxParticipants}
                    >
                      {tournament.requiresApproval ? (
                        <>
                          <UserPlus className="w-5 h-5" />
                          Request to Join
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Join Tournament
                        </>
                      )}
                    </button>
                    {joinError && <span className="error-text">{joinError}</span>}
                  </div>
                )}
              </>
            )}

            {/* Owner Actions */}
            {isOwner && (
              <div className="owner-actions">
                {tournament.status === 'upcoming' && activeParticipants.length >= 2 && (
                  <>
                    <button 
                      className="btn btn-primary"
                      onClick={handleStartTournament}
                      disabled={startingTournament}
                    >
                      <Play className="w-5 h-5" />
                      {startingTournament ? 'Starting...' : 'Start Tournament'}
                    </button>

                    <button 
                      className="btn btn-danger"
                      onClick={() => setShowDeleteModal(true)}
                      title="Delete this tournament"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete
                    </button>
                  </>
                )}
                
                {tournament.status === 'active' && matches.length === 0 && activeParticipants.length >= 2 && (
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
                  <>
                    <button 
                      className="btn btn-complete"
                      onClick={handleCompleteTournament}
                      disabled={completingTournament || !allMatchesCompleted()}
                      title={!allMatchesCompleted() ? 'Complete all matches first' : 'End tournament and calculate ELO'}
                    >
                      <Flag className={`w-5 h-5 ${completingTournament ? 'spin' : ''}`} />
                      {completingTournament ? 'Completing...' : 'Complete Tournament'}
                    </button>
                    
                    <button 
                      className="btn btn-warning"
                      onClick={handleRestartClick}
                      title="Restart tournament and recreate matches"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Restart Tournament
                    </button>

                    <button 
                      className="btn btn-danger"
                      onClick={() => setShowDeleteModal(true)}
                      title="Delete this tournament permanently"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete Tournament
                    </button>
                  </>
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
            
            {groupWinners && Object.keys(groupWinners).length > 0 ? (
              <div className="group-winners-grid">
                {Object.entries(groupWinners).sort().map(([groupName, winner]) => (
                  <div key={groupName} className="group-winner-card">
                    <div className="winner-crown">👑</div>
                    <div className="winner-group">{groupName} Winner</div>
                    <div className="winner-name">{winner.name}</div>
                    <div className="winner-stats">
                      {winner.wins} Wins ({winner.pointsDiff > 0 ? '+' : ''}{winner.pointsDiff})
                    </div>
                  </div>
                ))}
              </div>
            ) : (
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
            )}

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
                    <th>ELO Change</th>
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
                      <td className={`diff-cell ${(player.eloChange || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {(player.eloChange || 0) > 0 ? '+' : ''}{player.eloChange || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Pending Participants (Owner Only) */}
        {isOwner && tournament.pendingParticipants?.length > 0 && (
          <motion.div 
            className="pending-section card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2>Pending Requests ({tournament.pendingParticipants.length})</h2>
            <div className="pending-list">
              {tournament.pendingParticipants.map((participant) => (
                <div key={participant.userId} className="pending-item">
                  <div className="participant-info">
                    <span className="participant-name">{participant.name}</span>
                    <span className="participant-elo">ELO: {participant.elo}</span>
                  </div>
                  <div className="pending-actions">
                    <button className="btn-icon btn-success" onClick={() => handleApprove(participant)} title="Approve">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => handleReject(participant)} title="Reject">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Active Participants List */}
        <motion.div 
          className="participants-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2>Active Participants ({activeParticipants.length})</h2>
          <div className="participants-grid">
            {activeParticipants.length > 0 ? (
              activeParticipants.map((participant, index) => (
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
                  {/* Add Remove Button - Only visible to owner when tournament is active with matches */}
                  {isOwner && tournament.status === 'active' && matches.length > 0 && (
                    <button 
                      className="btn-icon btn-remove"
                      onClick={() => handleRemovePlayerClick(participant)}
                      title="Mark as no-show"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-state">No participants yet</p>
            )}
          </div>
        </motion.div>

        {/* No-Show Participants Section */}
        {noShowParticipants.length > 0 && (
          <motion.div 
            className="no-show-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2>
              <UserMinus className="w-6 h-6" />
              No-Show Players ({noShowParticipants.length})
            </h2>
            <div className="no-show-grid">
              {noShowParticipants.map((participant) => (
                <div key={participant.userId} className="no-show-card">
                  <UserMinus className="w-5 h-5 text-danger" />
                  <div className="participant-info">
                    <span className="participant-name">{participant.name}</span>
                    <span className="participant-elo">ELO: {participant.elo}</span>
                  </div>
                  {participant.removedAt && (
                    <span className="removed-date">
                      {new Date(participant.removedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

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
                const hasMatches = matches.some(m => m.groupName === groupName);
                const canDrag = isOwner && matches.length === 0;

                return (
                  <div 
                    key={groupIndex} 
                    className={`group-card card ${canDrag && draggedItem && draggedItem.groupIndex !== groupIndex ? 'drop-target' : ''}`}
                    onDragOver={(e) => canDrag ? handleDragOver(e) : null}
                    onDrop={(e) => canDrag ? handleDrop(e, groupIndex) : null}
                  >
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
                      
                      {/* Add Guest Button (Owner only, before matches) */}
                      {isOwner && matches.length === 0 && (
                        <button 
                          className="btn-icon btn-add-guest"
                          onClick={() => handleAddGuest(groupIndex, groupName)}
                          title="Add Guest Player"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}

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
                          className={`group-player ${player.userId === currentUserId ? 'is-me' : ''} ${canDrag ? 'draggable' : ''}`}
                          draggable={canDrag}
                          onDragStart={(e) => canDrag ? handleDragStart(e, player, groupIndex) : null}
                        >
                          <div className="player-left">
                            {canDrag && <GripVertical className="w-4 h-4 text-gray-400 mr-2 cursor-grab" />}
                            <span className="player-seed">{playerIndex + 1}</span>
                          </div>
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
                                {match.status === 'completed' ? 'Edit Score' : 'Enter Score'}
                              </button>
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

      {/* Player Removal Modal */}
      <PlayerRemovalModal
        isOpen={showRemovalModal}
        onClose={() => setShowRemovalModal(false)}
        player={selectedPlayerForRemoval}
        onConfirm={handleRemovePlayer}
        isRemoving={removingPlayer}
        result={removalResult}
      />

      {/* Tournament Restart Modal */}
      <TournamentRestartModal
        isOpen={showRestartModal}
        onClose={() => setShowRestartModal(false)}
        onConfirm={handleRestartTournament}
        isRestarting={restartingTournament}
        result={restartResult}
        recommendation={restartRecommendation}
      />
      
      {/* Guest Player Modal */}
      <GuestPlayerModal
        isOpen={showGuestModal}
        onClose={() => {
          setShowGuestModal(false);
          setSelectedGroupForGuest(null);
        }}
        onConfirm={confirmAddGuest}
        groupName={selectedGroupForGuest?.name || ''}
      />

      {/* Tournament Delete Modal */}
      <TournamentDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteResult(null);
        }}
        onConfirm={handleDeleteTournament}
        tournamentName={tournament.name}
        matchCount={matches.length}
        participantCount={activeParticipants.length + noShowParticipants.length}
        isDeleting={deletingTournament}
        result={deleteResult}
      />

      <style>{`
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

      .badge {
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .badge-upcoming {
        background: rgba(33, 150, 243, 0.1);
        color: #2196F3;
      }

      .badge-active {
        background: rgba(76, 175, 80, 0.1);
        color: var(--success);
      }

      .badge-completed {
        background: rgba(158, 158, 158, 0.1);
        color: var(--gray);
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

      .text-warning { color: #f59e0b; }
      .text-info { color: #3b82f6; }

      /* Pending Participants Section */
      .pending-section {
        margin-bottom: var(--spacing-2xl);
        padding: var(--spacing-xl);
        background: var(--white);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }

      .pending-section h3 {
        margin: 0 0 var(--spacing-lg) 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        color: var(--secondary);
      }

      .pending-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);
        border-bottom: 1px solid var(--light-gray);
        background: rgba(255, 152, 0, 0.05);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-sm);
        transition: all 0.2s;
      }

      .pending-item:hover {
        background: rgba(255, 152, 0, 0.08);
      }

      .pending-item:last-child {
        margin-bottom: 0;
      }

      .pending-player-info {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .pending-player-name {
        font-weight: 600;
        color: var(--secondary);
        font-size: 1rem;
      }

      .pending-player-elo {
        font-size: 0.875rem;
        color: var(--gray);
      }

      .pending-actions {
        display: flex;
        gap: var(--spacing-sm);
      }

      .btn-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        border: none;
        cursor: pointer;
        transition: all 0.2s;
        background: transparent;
      }

      .btn-icon:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }

      .btn-icon:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .btn-icon.btn-success {
        background: var(--success);
        color: var(--white);
      }

      .btn-icon.btn-success:hover:not(:disabled) {
        background: #43a047;
      }

      .btn-icon.btn-danger {
        background: var(--danger);
        color: var(--white);
      }

      .btn-icon.btn-danger:hover:not(:disabled) {
        background: #d32f2f;
      }

      /* Group Header & Settings */
      .group-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--spacing-md);
      }

      .group-title-stack h3 {
        margin: 0;
        line-height: 1.2;
      }

      .group-rules-text {
        font-size: 0.75rem;
      }

      .text-muted { 
        color: var(--gray); 
      }

      .text-highlight { 
        color: var(--primary); 
        font-weight: 600; 
      }

      .settings-wrapper {
        position: relative;
      }

      .btn-icon.settings-btn {
        background: transparent;
        color: var(--gray);
        width: 32px;
        height: 32px;
      }

      .btn-icon.settings-btn:hover, 
      .btn-icon.settings-btn.active {
        background: var(--light-gray);
        color: var(--primary);
      }

      .btn-icon.btn-add-guest {
        background: rgba(33, 150, 243, 0.1);
        color: #2196F3;
        margin-right: var(--spacing-sm);
      }

      .btn-icon.btn-add-guest:hover {
        background: rgba(33, 150, 243, 0.2);
      }

      /* Popover Styles */
      .settings-popover {
        position: absolute;
        top: 100%;
        right: 0;
        width: 220px;
        background: white;
        border-radius: var(--radius-md);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        border: 1px solid var(--light-gray);
        z-index: 100;
        padding: var(--spacing-sm) 0;
        margin-top: 4px;
      }

      .settings-popover h4 {
        margin: 0;
        padding: 6px var(--spacing-md);
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--gray);
        letter-spacing: 0.05em;
        border-bottom: 1px solid var(--light-gray);
        margin-bottom: 4px;
      }

      .popover-options {
        display: flex;
        flex-direction: column;
        max-height: 250px;
        overflow-y: auto;
      }

      .popover-option {
        background: none;
        border: none;
        text-align: left;
        padding: 10px var(--spacing-md);
        font-size: 0.875rem;
        cursor: pointer;
        color: var(--dark-gray);
        transition: background 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .popover-option:hover {
        background: var(--light-gray);
      }

      .popover-option.selected {
        background: rgba(255, 107, 53, 0.1);
        color: var(--primary);
        font-weight: 600;
      }

      .popover-option .checkmark {
        color: var(--primary);
        font-size: 1rem;
      }

      .divider {
        height: 1px;
        background: var(--light-gray);
        margin: 4px 0;
      }

      .match-progress {
        margin-bottom: var(--spacing-xl);
      }

      .progress-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: var(--spacing-sm);
        font-size: 0.875rem;
        color: var(--gray);
      }

      .progress-bar {
        height: 8px;
        background: var(--light-gray);
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--success);
        transition: width 0.3s ease;
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
        margin-bottom: var(--spacing-lg);
        align-items: center;
      }

      .join-section {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }

      .password-input-wrapper input {
        padding: 8px 12px;
        border: 1px solid var(--light-gray);
        border-radius: var(--radius-md);
      }

      .error-text {
        color: var(--danger);
        font-size: 0.875rem;
      }

      .pending-status {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        color: #f59e0b;
        font-weight: 600;
        padding: var(--spacing-sm) var(--spacing-md);
        background: rgba(245, 158, 11, 0.1);
        border-radius: var(--radius-md);
      }

      .owner-actions {
        display: flex;
        gap: var(--spacing-md);
        flex-wrap: wrap;
      }

      .btn-success {
        background: var(--success);
        color: var(--white);
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-md);
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-success:hover:not(:disabled) {
        background: #43a047;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
      }

      .btn-complete {
        background: linear-gradient(135deg, #9c27b0, #673ab7);
        color: var(--white);
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-md);
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-complete:hover:not(:disabled) {
        background: linear-gradient(135deg, #7b1fa2, #512da8);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(156, 39, 176, 0.3);
      }

      .btn-complete:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .spin {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .completion-error {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
        background: rgba(244, 67, 54, 0.1);
        border: 1px solid #f44336;
        border-radius: var(--radius-md);
        color: #f44336;
        margin-bottom: var(--spacing-lg);
      }

      .owner-info-banner {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-md);
        padding: var(--spacing-md);
        background: rgba(33, 150, 243, 0.1);
        border: 1px solid #2196F3;
        border-radius: var(--radius-md);
        color: #1976D2;
      }

      .owner-info-banner.warning {
        background: rgba(255, 152, 0, 0.1);
        border-color: #FF9800;
        color: #F57C00;
      }

      .owner-info-banner.success {
        background: rgba(76, 175, 80, 0.1);
        border-color: var(--success);
        color: #388E3C;
      }

      .owner-info-banner strong {
        display: block;
        margin-bottom: var(--spacing-xs);
      }

      .owner-info-banner p {
        margin: 0;
        font-size: 0.875rem;
      }

      /* Tournament Summary Styles */
      .tournament-summary {
        background: var(--white);
        border-radius: var(--radius-lg);
        padding: var(--spacing-2xl);
        margin-bottom: var(--spacing-2xl);
      }

      .summary-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-xl);
        color: var(--primary);
      }

      .summary-header h2 {
        margin: 0;
      }

      .standings-podium {
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: var(--spacing-lg);
        margin-bottom: var(--spacing-2xl);
        padding: var(--spacing-xl);
      }

      .podium-place {
        text-align: center;
        padding: var(--spacing-lg);
        border-radius: var(--radius-lg);
        min-width: 120px;
      }

      .place-1 {
        background: linear-gradient(135deg, #FFD700, #FFA500);
        order: 2;
        transform: scale(1.1);
      }

      .place-2 {
        background: linear-gradient(135deg, #C0C0C0, #A8A8A8);
        order: 1;
      }

      .place-3 {
        background: linear-gradient(135deg, #CD7F32, #8B4513);
        order: 3;
      }

      .podium-rank {
        font-size: 2rem;
        margin-bottom: var(--spacing-sm);
      }

      .podium-name {
        font-weight: 700;
        color: var(--white);
        margin-bottom: var(--spacing-xs);
      }

      .podium-stats {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.9);
      }

      .group-winners-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacing-lg);
        margin-bottom: var(--spacing-2xl);
        padding: var(--spacing-md);
      }

      .group-winner-card {
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        border-radius: var(--radius-lg);
        padding: var(--spacing-lg);
        text-align: center;
        color: white;
        box-shadow: var(--shadow-md);
        transform: translateY(0);
        transition: transform 0.2s;
      }

      .group-winner-card:hover {
        transform: translateY(-5px);
      }

      .winner-crown {
        font-size: 2rem;
        margin-bottom: var(--spacing-xs);
      }

      .winner-group {
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--spacing-xs);
        opacity: 0.9;
      }

      .winner-name {
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: var(--spacing-xs);
      }

      .winner-stats {
        font-size: 0.875rem;
        opacity: 0.9;
      }

      .full-standings {
        margin-top: var(--spacing-xl);
      }

      .full-standings h3 {
        margin-bottom: var(--spacing-md);
      }

      .standings-table {
        width: 100%;
        border-collapse: collapse;
      }

      .standings-table th,
      .standings-table td {
        padding: var(--spacing-md);
        text-align: left;
        border-bottom: 1px solid var(--light-gray);
      }

      .standings-table th {
        background: var(--light-gray);
        font-weight: 600;
        font-size: 0.875rem;
        text-transform: uppercase;
      }

      .standings-table tr.is-me {
        background: rgba(76, 175, 80, 0.1);
      }

      .standings-table .rank-cell {
        font-weight: 700;
        color: var(--primary);
      }

      .standings-table .name-cell {
        font-weight: 600;
      }

      .standings-table .won-cell {
        color: var(--success);
        font-weight: 600;
      }

      .standings-table .lost-cell {
        color: #f44336;
      }

      .standings-table .diff-cell.positive {
        color: var(--success);
        font-weight: 600;
      }

      .standings-table .diff-cell.negative {
        color: #f44336;
      }

      .participants-section,
      .groups-section,
      .matches-section {
        margin-bottom: var(--spacing-2xl);
      }

      .participants-section h2,
      .groups-section h2 {
        margin-bottom: var(--spacing-lg);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--spacing-lg);
      }

      .section-header h2 {
        margin: 0;
      }

      .format-info {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        color: var(--gray);
        font-size: 0.875rem;
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

      .participant-card.is-me {
        background: rgba(76, 175, 80, 0.05);
        border: 1px solid var(--success);
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
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-weight: 600;
        color: var(--secondary);
      }

      .me-badge {
        font-size: 0.625rem;
        padding: 2px 6px;
        background: var(--success);
        color: white;
        border-radius: var(--radius-sm);
        text-transform: uppercase;
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

      .drop-target {
        border: 2px dashed var(--primary);
        background: rgba(255, 107, 53, 0.05);
      }

      .group-player {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-sm);
        background: var(--light-gray);
        border-radius: var(--radius-sm);
      }

      .group-player.draggable {
        cursor: grab;
      }

      .group-player.draggable:active {
        cursor: grabbing;
      }

      .group-player.is-me {
        background: rgba(76, 175, 80, 0.15);
        border: 1px solid var(--success);
      }

      .player-left {
        display: flex;
        align-items: center;
        min-width: 30px;
      }

      .player-seed {
        font-weight: 700;
        color: var(--secondary);
      }

      .player-name {
        font-weight: 500;
        flex: 1;
      }

      .player-elo {
        font-weight: 600;
        color: var(--primary);
      }

      /* Matches Table Styles */
      .group-matches {
        margin-bottom: var(--spacing-xl);
      }

      .group-matches-title {
        margin-bottom: var(--spacing-md);
        color: var(--primary);
        font-size: 1.125rem;
      }

      .matches-table-container {
        background: var(--white);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }

      .matches-table {
        width: 100%;
        border-collapse: collapse;
      }

      .matches-table thead {
        background: var(--secondary);
        color: var(--white);
      }

      .matches-table th {
        padding: var(--spacing-md);
        text-align: left;
        font-weight: 600;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .matches-table td {
        padding: var(--spacing-md);
        border-bottom: 1px solid var(--light-gray);
        vertical-align: middle;
      }

      .matches-table tbody tr:last-child td {
        border-bottom: none;
      }

      .matches-table tbody tr:hover {
        background: var(--off-white);
      }

      .matches-table tbody tr.my-match {
        background: rgba(76, 175, 80, 0.05);
      }

      .matches-table tbody tr.my-match:hover {
        background: rgba(76, 175, 80, 0.1);
      }

      .matches-table tbody tr.completed {
        opacity: 0.8;
      }

      .player-cell {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .winner-cell {
        font-weight: 600;
        color: var(--success);
      }

      .winner-icon {
        color: #FFD700;
      }

      .score-cell {
        font-weight: 600;
        font-family: monospace;
        font-size: 1rem;
      }

      .winner-name-cell {
        font-weight: 500;
        color: var(--secondary);
      }

      .status-badge {
        display: inline-block;
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: capitalize;
      }

      .status-pending {
        background: rgba(255, 152, 0, 0.1);
        color: #FF9800;
      }

      .status-completed {
        background: rgba(76, 175, 80, 0.1);
        color: var(--success);
      }

      .completed-text {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        color: var(--success);
        font-size: 0.875rem;
      }

      .pending-text {
        color: var(--gray);
      }

      .table-legend {
        display: flex;
        gap: var(--spacing-lg);
        margin-top: var(--spacing-md);
        padding: var(--spacing-sm);
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: 0.75rem;
        color: var(--gray);
      }

      .legend-color {
        width: 16px;
        height: 16px;
        border-radius: var(--radius-sm);
      }

      .my-match-color {
        background: rgba(76, 175, 80, 0.2);
        border: 1px solid var(--success);
      }

      .completed-color {
        background: var(--light-gray);
        border: 1px solid var(--gray);
      }

      .no-matches-message,
      .tournament-not-started {
        text-align: center;
        padding: var(--spacing-2xl);
        background: var(--white);
        border-radius: var(--radius-lg);
        color: var(--gray);
      }

      .no-matches-message svg,
      .tournament-not-started svg {
        margin-bottom: var(--spacing-md);
        color: var(--gray);
      }

      .no-matches-message .hint,
      .tournament-not-started .hint {
        font-size: 0.875rem;
        margin-top: var(--spacing-sm);
        color: var(--primary);
      }

      .empty-state {
        text-align: center;
        color: var(--gray);
        padding: var(--spacing-xl);
      }

      @media (max-width: 968px) {
        .matches-table-container {
          overflow-x: auto;
        }

        .matches-table {
          min-width: 700px;
        }

        .standings-podium {
          flex-direction: column;
          align-items: center;
        }

        .place-1 {
          order: 1;
          transform: scale(1);
        }

        .place-2 {
          order: 2;
        }

        .place-3 {
          order: 3;
        }
      }

      @media (max-width: 768px) {
        .tournament-info-grid {
          grid-template-columns: 1fr;
        }

        .groups-grid {
          grid-template-columns: 1fr;
        }

        .section-header {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-sm);
        }

        .tournament-actions {
          flex-direction: column;
        }

        .owner-actions {
          flex-direction: column;
          width: 100%;
        }

        .owner-actions .btn,
        .owner-actions .btn-success,
        .owner-actions .btn-complete {
          width: 100%;
          justify-content: center;
        }
        
        .pending-item {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-md);
        }
        
        .pending-actions {
          align-self: flex-end;
        }

        /* No-Show Warning Banner */
        .no-show-warning {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
          background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 193, 7, 0.05) 100%);
          border: 2px solid var(--warning);
          border-radius: var(--radius-lg);
          margin-bottom: var(--spacing-lg);
        }

        .no-show-warning svg {
          color: var(--warning);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .warning-content {
          flex: 1;
        }

        .warning-content strong {
          display: block;
          color: var(--secondary);
          margin-bottom: var(--spacing-xs);
          font-size: 1.1rem;
        }

        .warning-content p {
          color: var(--gray);
          margin-bottom: var(--spacing-sm);
          font-size: 0.9rem;
        }

        /* Participant Card with Remove Button */
        .participant-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--white);
          border: 2px solid var(--light-gray);
          border-radius: var(--radius-md);
          transition: all var(--transition-base);
        }

        .participant-card:hover .btn-remove {
          opacity: 1;
        }

        .btn-remove {
          position: absolute;
          top: var(--spacing-sm);
          right: var(--spacing-sm);
          opacity: 0;
          transition: opacity var(--transition-base);
          padding: var(--spacing-xs);
          background: rgba(244, 67, 54, 0.1);
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--danger);
        }

        .btn-remove:hover {
          background: var(--danger);
          color: var(--white);
        }

        /* No-Show Section */
        .no-show-section {
          margin-top: var(--spacing-xl);
          padding: var(--spacing-lg);
          background: rgba(244, 67, 54, 0.05);
          border-radius: var(--radius-lg);
        }

        .no-show-section h2 {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--danger);
          margin-bottom: var(--spacing-md);
        }

        .no-show-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: var(--spacing-md);
        }

        .no-show-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--white);
          border: 2px solid rgba(244, 67, 54, 0.3);
          border-radius: var(--radius-md);
          opacity: 0.7;
        }

        .no-show-card .participant-name {
          text-decoration: line-through;
          color: var(--gray);
        }

        /* Warning Button Style */
        .btn-warning {
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: var(--white);
          border: none;
        }

        .btn-warning:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .btn-warning:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-danger {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: var(--white);
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-danger:hover:not(:disabled) {
          background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
        }

        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @media (max-width: 768px) {
          .no-show-grid {
            grid-template-columns: 1fr;
          }
        }
      }
      `}</style>
    </div>
  );
};

export default TournamentDetails;