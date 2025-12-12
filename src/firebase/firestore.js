// src/firebase/firestore.js

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  arrayUnion,
  increment,
  addDoc
} from 'firebase/firestore';
import { db, auth } from './config';
import { 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { googleProvider } from './config';

// User Profile Operations
export const createUserProfile = async (userId, profileData) => {
  try {
    console.log('createUserProfile called for:', userId);
    console.log('Profile data:', profileData);
    
    const userRef = doc(db, 'users', userId);
    const userData = {
      ...profileData,
      elo: 1200,
      matchesPlayed: 0,
      matchesWon: 0,
      tournamentsPlayed: 0,
      tournaments: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('Writing user data to Firestore:', userData);
    await setDoc(userRef, userData);
    console.log('✅ User profile created successfully');
    
    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return { success: false, error: error.message };
  }
};

export const getUserProfile = async (userId) => {
  try {
    console.log('getUserProfile called for:', userId);
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      console.log('✅ User profile found');
      return { id: userSnap.id, ...userSnap.data() };
    }
    
    console.log('❌ User profile not found');
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

export const createClub = async (clubData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const clubRef = await addDoc(collection(db, 'clubs'), {
      ...clubData,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('Club created successfully:', clubRef.id);
    return { success: true, id: clubRef.id };
  } catch (error) {
    console.error('Error creating club:', error);
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (userId, updates) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

// Get all users (for member management)
export const getAllUsers = async () => {
  try {
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const users = [];
    
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
};

// Disable a user account
export const disableUser = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      disabled: true,
      disabledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('User disabled successfully:', userId);
    return { success: true };
  } catch (error) {
    console.error('Error disabling user:', error);
    return { success: false, error: error.message };
  }
};

// Enable a disabled user account
export const enableUser = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      disabled: false,
      disabledAt: null,
      updatedAt: serverTimestamp()
    });
    
    console.log('User enabled successfully:', userId);
    return { success: true };
  } catch (error) {
    console.error('Error enabling user:', error);
    return { success: false, error: error.message };
  }
};

// Remove a user from the club (permanent deletion)
export const removeUserFromClub = async (userId) => {
  try {
    // Delete user document
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    
    console.log('User removed successfully:', userId);
    return { success: true };
  } catch (error) {
    console.error('Error removing user:', error);
    return { success: false, error: error.message };
  }
};

// Tournament Status Helper
// FIXED: Respect manually completed tournaments
export const calculateTournamentStatus = (tournament) => {
  // If tournament was manually completed, respect that status
  // Check for completedAt field which is set when owner clicks "Complete Tournament"
  if (tournament.status === 'completed' && tournament.completedAt) {
    return 'completed';
  }
  
  if (!tournament.date || !tournament.time) return tournament.status;
  
  const now = new Date();
  const tournamentDate = new Date(tournament.date);
  const [hours, minutes] = tournament.time.split(':').map(Number);
  
  // Set tournament start time
  const tournamentStart = new Date(tournamentDate);
  tournamentStart.setHours(hours, minutes, 0, 0);
  
  // Next day at midnight
  const nextDay = new Date(tournamentDate);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);
  
  if (now < tournamentStart) {
    return 'upcoming';
  } else if (now >= tournamentStart && now < nextDay) {
    return 'active';
  } else {
    return 'completed';
  }
};

// Add this to src/firebase/firestore.js

export const updateTournamentGroupSettings = async (tournamentId, groupName, settings) => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const updateData = {
      [`groupSettings.${groupName}`]: settings,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(tournamentRef, updateData);
    console.log(`Updated settings for ${groupName}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating group settings:', error);
    return { success: false, error: error.message };
  }
};

export const updateTournamentStatusIfNeeded = async (tournamentId, tournament) => {
  // If already manually completed, don't change status
  if (tournament.status === 'completed' && tournament.completedAt) {
    return 'completed';
  }
  
  const calculatedStatus = calculateTournamentStatus(tournament);
  
  if (calculatedStatus !== tournament.status) {
    try {
      const tournamentRef = doc(db, 'tournaments', tournamentId);
      await updateDoc(tournamentRef, {
        status: calculatedStatus,
        updatedAt: serverTimestamp()
      });
      return calculatedStatus;
    } catch (error) {
      console.error('Error updating tournament status:', error);
      return tournament.status;
    }
  }
  
  return tournament.status;
};

export const createTournament = async (tournamentData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const tournamentRef = doc(collection(db, 'tournaments'));
    const tournamentId = tournamentRef.id;
    
    await setDoc(tournamentRef, {
      ...tournamentData,
      id: tournamentId,
      createdBy: user.uid,
      status: 'upcoming',
      participants: [],
      matches: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('Tournament created successfully:', tournamentId);
    return { success: true, tournamentId };
  } catch (error) {
    console.error('Error creating tournament:', error);
    return { success: false, error: error.message };
  }
};

export const getTournament = async (tournamentId) => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (tournamentSnap.exists()) {
      const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() };
      
      // Check and update status if needed (won't override manually completed)
      const updatedStatus = await updateTournamentStatusIfNeeded(tournamentId, tournament);
      tournament.status = updatedStatus;
      
      return tournament;
    }
    return null;
  } catch (error) {
    console.error('Error getting tournament:', error);
    return null;
  }
};

export const getTournamentsByOwner = async (ownerId) => {
  try {
    const q = query(
      collection(db, 'tournaments'),
      where('createdBy', '==', ownerId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const tournaments = [];
    
    for (const docSnap of querySnapshot.docs) {
      const tournament = { id: docSnap.id, ...docSnap.data() };
      tournament.status = await updateTournamentStatusIfNeeded(docSnap.id, tournament);
      tournaments.push(tournament);
    }
    
    return tournaments;
  } catch (error) {
    console.error('Error getting tournaments by owner:', error);
    return [];
  }
};

export const getTournaments = async (filters = {}) => {
  try {
    let q;
    const constraints = [];
    
    if (filters.date) {
      constraints.push(where('date', '==', filters.date));
    }
    
    constraints.push(orderBy('date', 'desc'));
    
    q = query(collection(db, 'tournaments'), ...constraints);
    
    const querySnapshot = await getDocs(q);
    const tournaments = [];
    
    for (const docSnap of querySnapshot.docs) {
      const tournament = { id: docSnap.id, ...docSnap.data() };
      
      // Update status based on current date/time (won't override manually completed)
      tournament.status = await updateTournamentStatusIfNeeded(docSnap.id, tournament);
      
      // Filter by status AFTER calculating current status
      if (filters.status && tournament.status !== filters.status) {
        continue;
      }
      
      tournaments.push(tournament);
    }
    
    return tournaments;
  } catch (error) {
    console.error('Error getting tournaments:', error);
    return [];
  }
};

export const updateTournament = async (tournamentId, updates) => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(tournamentRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    console.log('Tournament updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Error updating tournament:', error);
    return { success: false, error: error.message };
  }
};

// Player Tournament Operations
export const joinTournament = async (tournamentId, userId, userProfile) => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(tournamentRef, {
      participants: arrayUnion({
        userId,
        name: `${userProfile.firstName} ${userProfile.lastName}`,
        elo: userProfile.elo || 1200,
        joinedAt: new Date().toISOString()
      }),
      updatedAt: serverTimestamp()
    });
    
    // Update user's tournaments
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      tournaments: arrayUnion(tournamentId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error joining tournament:', error);
    return { success: false, error: error.message };
  }
};

export const leaveTournament = async (tournamentId, userId) => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      return { success: false, error: 'Tournament not found' };
    }
    
    const tournamentData = tournamentSnap.data();
    
    const updatedParticipants = (tournamentData.participants || []).filter(
      p => p.userId !== userId
    );
    
    await updateDoc(tournamentRef, {
      participants: updatedParticipants,
      updatedAt: serverTimestamp()
    });
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const updatedTournaments = (userData.tournaments || []).filter(
        t => t !== tournamentId
      );
      
      await updateDoc(userRef, {
        tournaments: updatedTournaments,
        updatedAt: serverTimestamp()
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error leaving tournament:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// CHESS.COM STYLE ELO CALCULATION
// ============================================
// K-factor varies based on player's rating and games played:
// - K = 40 for new players (< 30 games) - ratings change faster
// - K = 20 for players rated 2400+ - ratings more stable
// - K = 32 for everyone else (standard)
// ============================================
export const calculateEloChange = (playerElo, opponentElo, playerWon, matchesPlayed = 0) => {
  // Determine K-factor based on Chess.com rules
  let K = 32; // Default K-factor
  
  if (matchesPlayed < 30) {
    // New players: Higher K-factor means ratings change faster
    // This helps new players find their true rating quickly
    K = 40;
  } else if (playerElo >= 2400) {
    // High-rated players: Lower K-factor means ratings are more stable
    // This prevents wild swings at the top of the rating pool
    K = 20;
  }
  
  // Expected score formula (same as Chess.com and standard ELO)
  // This calculates the probability of winning based on rating difference
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  
  // Actual score: 1 for win, 0 for loss
  // (Chess.com also uses 0.5 for draws, but squash doesn't have draws)
  const actualScore = playerWon ? 1 : 0;
  
  // ELO change calculation
  const eloChange = Math.round(K * (actualScore - expectedScore));
  
  return eloChange;
};

// ============================================
// COMPLETE TOURNAMENT - FIXED VERSION
// ============================================
export const completeTournament = async (tournamentId) => {
  try {
    console.log('=== Starting completeTournament ===');
    console.log('Tournament ID:', tournamentId);
    
    // Get tournament data
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      console.error('Tournament not found');
      return { success: false, error: 'Tournament not found' };
    }
    
    const tournament = tournamentSnap.data();
    console.log('Tournament:', tournament.name);
    
    // Check if already completed
    if (tournament.status === 'completed') {
      console.log('Tournament already completed');
      return { success: false, error: 'Tournament is already completed' };
    }
    
    // Get all matches for this tournament
    const matches = await getMatchesByTournament(tournamentId);
    console.log('Total matches:', matches.length);
    
    // Check if all matches are completed
    const pendingMatches = matches.filter(m => m.status !== 'completed');
    if (pendingMatches.length > 0) {
      console.error('Pending matches:', pendingMatches.length);
      return { 
        success: false, 
        error: `${pendingMatches.length} match(es) still pending. Complete all matches first.` 
      };
    }
    
    // Build a map of player starting ELOs from tournament participants
    const playerStartingElos = {};
    tournament.participants?.forEach(p => {
      playerStartingElos[p.userId] = p.elo || 1200;
    });
    
    // Get current matches played for each participant (for K-factor calculation)
    const playerMatchesBefore = {};
    for (const participant of tournament.participants || []) {
      try {
        const userProfile = await getUserProfile(participant.userId);
        if (userProfile) {
          playerMatchesBefore[participant.userId] = userProfile.matchesPlayed || 0;
        } else {
          playerMatchesBefore[participant.userId] = 0;
        }
      } catch (err) {
        console.warn('Could not get profile for', participant.userId);
        playerMatchesBefore[participant.userId] = 0;
      }
    }
    
    // Calculate ELO changes for each player based on ALL their matches
    const playerEloChanges = {};
    const playerMatchStats = {};
    
    // Initialize stats for each participant
    tournament.participants?.forEach(p => {
      playerEloChanges[p.userId] = 0;
      playerMatchStats[p.userId] = { played: 0, won: 0 };
    });
    
    console.log('Processing matches for ELO calculation...');
    
    // Process each match
    matches.forEach(match => {
      if (!match.winner || !match.player1Id || !match.player2Id) {
        console.warn('Skipping invalid match:', match.id);
        return;
      }
      
      const player1Id = match.player1Id;
      const player2Id = match.player2Id;
      const winnerId = match.winner;
      const loserId = winnerId === player1Id ? player2Id : player1Id;
      
      // Get starting ELOs (use tournament registration ELO for fairness)
      const player1Elo = playerStartingElos[player1Id] || 1200;
      const player2Elo = playerStartingElos[player2Id] || 1200;
      
      // Calculate ELO changes using Chess.com formula
      const winnerElo = winnerId === player1Id ? player1Elo : player2Elo;
      const loserElo = loserId === player1Id ? player1Elo : player2Elo;
      
      // Get matches played before tournament for K-factor
      const winnerMatchesBefore = playerMatchesBefore[winnerId] || 0;
      const loserMatchesBefore = playerMatchesBefore[loserId] || 0;
      
      // Calculate ELO changes with Chess.com K-factor
      const winnerChange = calculateEloChange(winnerElo, loserElo, true, winnerMatchesBefore);
      const loserChange = calculateEloChange(loserElo, winnerElo, false, loserMatchesBefore);
      
      console.log(`Match: ${match.player1Name} vs ${match.player2Name}`);
      console.log(`  Winner: ${winnerId === player1Id ? match.player1Name : match.player2Name} (ELO: ${winnerElo})`);
      console.log(`  Winner K-factor: ${winnerMatchesBefore < 30 ? 40 : (winnerElo >= 2400 ? 20 : 32)}`);
      console.log(`  ELO changes: Winner +${winnerChange}, Loser ${loserChange}`);
      
      // Accumulate ELO changes
      if (playerEloChanges[winnerId] !== undefined) {
        playerEloChanges[winnerId] += winnerChange;
        playerMatchStats[winnerId].played += 1;
        playerMatchStats[winnerId].won += 1;
      }
      
      if (playerEloChanges[loserId] !== undefined) {
        playerEloChanges[loserId] += loserChange;
        playerMatchStats[loserId].played += 1;
      }
    });
    
    console.log('Final ELO changes:', playerEloChanges);
    console.log('Match stats:', playerMatchStats);
    
    // Update each player's ELO in the database
    const updatePromises = [];
    
    for (const [userId, eloChange] of Object.entries(playerEloChanges)) {
      const stats = playerMatchStats[userId];
      const userRef = doc(db, 'users', userId);
      
      console.log(`Updating player ${userId}: ELO change ${eloChange}, matches played ${stats.played}, won ${stats.won}`);
      
      updatePromises.push(
        updateDoc(userRef, {
          elo: increment(eloChange),
          matchesPlayed: increment(stats.played),
          matchesWon: increment(stats.won),
          tournamentsPlayed: increment(1),
          lastEloChange: eloChange,
          updatedAt: serverTimestamp()
        })
      );
    }
    
    // Wait for all player updates
    await Promise.all(updatePromises);
    console.log('All player ELOs updated');
    
    // Mark tournament as completed with completedAt timestamp
    // The completedAt field is CRITICAL - it prevents status from being overridden
    await updateDoc(tournamentRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      eloChanges: playerEloChanges, // Store for reference
      finalStandings: Object.entries(playerMatchStats)
        .map(([id, stats]) => ({ 
          id, 
          ...stats, 
          eloChange: playerEloChanges[id] 
        }))
        .sort((a, b) => b.won - a.won || b.played - a.played)
    });
    
    console.log('=== Tournament completed successfully ===');
    
    return { 
      success: true, 
      eloChanges: playerEloChanges,
      matchStats: playerMatchStats
    };
  } catch (error) {
    console.error('=== Error completing tournament ===');
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
};

// Get tournaments a player has participated in
export const getPlayerTournaments = async (userId) => {
  try {
    const allTournaments = await getTournaments();
    
    const playerTournaments = allTournaments.filter(tournament => 
      tournament.participants?.some(p => p.userId === userId)
    );
    
    playerTournaments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return playerTournaments;
  } catch (error) {
    console.error('Error getting player tournaments:', error);
    return [];
  }
};

// Get detailed player match history with opponent info
export const getPlayerMatchHistory = async (userId) => {
  try {
    const tournamentMatches = await getMatchesByPlayer(userId);
    const individualMatches = await getIndividualMatchesByPlayer(userId);

    const allMatches = [...tournamentMatches, ...individualMatches];

    const enhancedMatches = allMatches.map(match => {
      // Tournament match
      if (match.tournamentId) {
        const isPlayer1 = match.player1Id === userId;
        const won = match.winner === userId;
        const opponentName = isPlayer1 ? match.player2Name : match.player1Name;
        
        let playerScore = 0;
        let opponentScore = 0;
        
        match.scores?.forEach(score => {
          if (isPlayer1) {
            playerScore += score.player1 || 0;
            opponentScore += score.player2 || 0;
          } else {
            playerScore += score.player2 || 0;
            opponentScore += score.player1 || 0;
          }
        });

        return {
          ...match,
          won,
          opponentName,
          playerScore,
          opponentScore,
          scoreDisplay: match.scores?.map(s => 
            isPlayer1 ? `${s.player1}-${s.player2}` : `${s.player2}-${s.player1}`
          ).join(', ') || '-',
          contextDisplay: match.groupName || 'Tournament'
        };
      } 
      // Individual match
      else {
        const isUserInTeam1 = match.team1.some(p => p.id === userId);
        const won = (isUserInTeam1 && match.winner === 'team1') || (!isUserInTeam1 && match.winner === 'team2');
        
        const opponentTeam = isUserInTeam1 ? match.team2 : match.team1;
        const opponentName = opponentTeam.map(p => p.name).join(' & ');

        let playerScore = 0;
        let opponentScore = 0;

        match.scores?.forEach(score => {
          if (isUserInTeam1) {
            playerScore += score.team1 || 0;
            opponentScore += score.team2 || 0;
          } else {
            playerScore += score.team2 || 0;
            opponentScore += score.team1 || 0;
          }
        });

        return {
          ...match,
          won,
          opponentName,
          playerScore,
          opponentScore,
          scoreDisplay: match.scores?.map(s => 
            isUserInTeam1 ? `${s.team1}-${s.team2}` : `${s.team2}-${s.team1}`
          ).join(', ') || '-',
          contextDisplay: `${match.matchMode.charAt(0).toUpperCase() + match.matchMode.slice(1)} ${match.matchType}`
        };
      }
    });

    // Sort all matches by date
    enhancedMatches.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    return enhancedMatches;
  } catch (error) {
    console.error('Error getting player match history:', error);
    return [];
  }
};

export const getTournamentSummary = async (tournamentId) => {
  try {
    const tournament = await getTournament(tournamentId);
    const matches = await getMatchesByTournament(tournamentId);
    
    if (!tournament) {
      return null;
    }
    
    // Calculate stats for each participant
    const playerStats = {};
    
    tournament.participants?.forEach(p => {
      playerStats[p.userId] = {
        userId: p.userId,
        name: p.name,
        startingElo: p.elo || 1200,
        matchesPlayed: 0,
        matchesWon: 0,
        pointsScored: 0,
        pointsConceded: 0
      };
    });
    
    // Process matches
    matches.forEach(match => {
      if (match.status !== 'completed') return;
      
      const p1 = match.player1Id;
      const p2 = match.player2Id;
      
      if (playerStats[p1]) {
        playerStats[p1].matchesPlayed += 1;
        if (match.winner === p1) playerStats[p1].matchesWon += 1;
        
        match.scores?.forEach(score => {
          playerStats[p1].pointsScored += score.player1 || 0;
          playerStats[p1].pointsConceded += score.player2 || 0;
        });
      }
      
      if (playerStats[p2]) {
        playerStats[p2].matchesPlayed += 1;
        if (match.winner === p2) playerStats[p2].matchesWon += 1;
        
        match.scores?.forEach(score => {
          playerStats[p2].pointsScored += score.player2 || 0;
          playerStats[p2].pointsConceded += score.player1 || 0;
        });
      }
    });
    
    // Convert to array and sort by wins, then point difference
    const standings = Object.values(playerStats)
      .map(stats => ({
        ...stats,
        pointDifference: stats.pointsScored - stats.pointsConceded
      }))
      .sort((a, b) => {
        if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
        return b.pointDifference - a.pointDifference;
      });
    
    return {
      tournament,
      matches,
      standings,
      totalMatches: matches.length,
      completedMatches: matches.filter(m => m.status === 'completed').length
    };
  } catch (error) {
    console.error('Error getting tournament summary:', error);
    return null;
  }
};

// Match Operations
export const createMatch = async (matchData, tournamentFormat) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const matchRef = doc(collection(db, 'matches'));
    const matchId = matchRef.id;
    
    await setDoc(matchRef, {
      ...matchData,
      id: matchId,
      format: tournamentFormat,
      players: [matchData.player1Id, matchData.player2Id],
      createdBy: user.uid,
      status: 'pending',
      scores: [],
      winner: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    if (matchData.tournamentId) {
      const tournamentRef = doc(db, 'tournaments', matchData.tournamentId);
      await updateDoc(tournamentRef, {
        matches: arrayUnion(matchId),
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('Match created successfully:', matchId);
    return { success: true, matchId };
  } catch (error) {
    console.error('Error creating match:', error);
    return { success: false, error: error.message };
  }
};

export const updateMatchScore = async (matchId, scores, winner) => {
  try {
    const matchRef = doc(db, 'matches', matchId);
    await updateDoc(matchRef, {
      scores,
      winner,
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('Match score updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Error updating match score:', error);
    return { success: false, error: error.message };
  }
};

export const getMatchesByTournament = async (tournamentId) => {
  try {
    const q = query(
      collection(db, 'matches'),
      where('tournamentId', '==', tournamentId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const matches = [];
    querySnapshot.forEach((doc) => {
      matches.push({ id: doc.id, ...doc.data() });
    });
    
    return matches;
  } catch (error) {
    console.error('Error getting matches:', error);
    return [];
  }
};

export const getMatchesByPlayer = async (userId) => {
  try {
    const q = query(
      collection(db, 'matches'),
      where('players', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const matches = [];
    querySnapshot.forEach((doc) => {
      matches.push({ id: doc.id, ...doc.data() });
    });
    
    return matches;
  } catch (error) {
    console.error('Error getting player matches:', error);
    return [];
  }
};

export const updatePlayerElo = async (userId, eloChange, won) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      elo: increment(eloChange),
      matchesPlayed: increment(1),
      matchesWon: won ? increment(1) : increment(0),
      lastEloChange: eloChange,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating player ELO:', error);
    return { success: false, error: error.message };
  }
};

// Leaderboard Operations
export const getLeaderboard = async (limit = 10) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'player'),
      orderBy('elo', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const leaderboard = [];
    let rank = 1;
    
    querySnapshot.forEach((doc) => {
      if (rank <= limit) {
        const userData = doc.data();
        leaderboard.push({
          id: doc.id,
          rank,
          name: `${userData.firstName} ${userData.lastName}`,
          elo: userData.elo,
          matchesPlayed: userData.matchesPlayed,
          matchesWon: userData.matchesWon,
          winRate: userData.matchesPlayed > 0 
            ? Math.round((userData.matchesWon / userData.matchesPlayed) * 100) 
            : 0
        });
        rank++;
      }
    });
    
    return leaderboard;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
};

export const generateTournamentGroups = (participants, groupSize = 4) => {
  if (!participants || participants.length === 0) return [];
  
  // Sort by ELO descending (highest first)
  const sortedParticipants = [...participants].sort((a, b) => (b.elo || 1200) - (a.elo || 1200));
  
  const numParticipants = sortedParticipants.length;
  
  // If everyone fits in one group, return them all
  if (numParticipants <= groupSize) {
    return [sortedParticipants];
  }
  
  // Calculate number of groups needed
  let numGroups = Math.floor(numParticipants / groupSize);
  if (numGroups === 0) numGroups = 1;
  
  // Adjust if groups would be too large
  while (numGroups < numParticipants) {
    const maxGroupSize = Math.ceil(numParticipants / numGroups);
    if (maxGroupSize <= groupSize + 1) break;
    numGroups++;
  }
  
  console.log(`Generating ${numGroups} groups for ${numParticipants} participants (target size: ${groupSize})`);

  // Calculate base size and how many groups need an extra player
  const baseSize = Math.floor(numParticipants / numGroups);
  const groupsWithExtra = numParticipants % numGroups;
  
  // Create groups array
  const groups = Array.from({ length: numGroups }, () => []);
  
  // Fill groups in descending order
  let participantIndex = 0;
  
  for (let groupIndex = 0; groupIndex < numGroups; groupIndex++) {
    // Determine size of this group (some groups get +1 player)
    const thisGroupSize = groupIndex < groupsWithExtra ? baseSize + 1 : baseSize;
    
    // Add players to this group
    for (let i = 0; i < thisGroupSize && participantIndex < numParticipants; i++) {
      groups[groupIndex].push(sortedParticipants[participantIndex]);
      participantIndex++;
    }
  }
  
  console.log('Group sizes:', groups.map(g => g.length).join(', '));
  console.log('Group ELO ranges:', groups.map((g, i) => {
    const highest = g[0]?.elo || 0;
    const lowest = g[g.length - 1]?.elo || 0;
    return `Group ${String.fromCharCode(65 + i)}: ${highest}-${lowest}`;
  }).join(', '));
  
  return groups;
};

// Generate all matches for a group (round-robin)
export const generateGroupMatches = async (tournamentId, tournamentFormat, group, groupName) => {
  const matches = [];
  
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const matchData = {
        tournamentId,
        player1Id: group[i].userId,
        player1Name: group[i].name,
        player2Id: group[j].userId,
        player2Name: group[j].name,
        groupName
      };
      
      const result = await createMatch(matchData, tournamentFormat);
      if (result.success) {
        matches.push(result.matchId);
      }
    }
  }
  
  return matches;
};

// Statistics Operations
export const getPlayerStatistics = async (userId) => {
  try {
 const tournamentMatches = await getMatchesByPlayer(userId);
    const individualMatches = await getIndividualMatchesByPlayer(userId);

    const allMatches = [...tournamentMatches, ...individualMatches];

    const enhancedMatches = allMatches.map(match => {
      // Tournament match
      if (match.tournamentId) {
        const isPlayer1 = match.player1Id === userId;
        const won = match.winner === userId;
        const opponentName = isPlayer1 ? match.player2Name : match.player1Name;
        
        let playerScore = 0;
        let opponentScore = 0;
        
        match.scores?.forEach(score => {
          if (isPlayer1) {
            playerScore += score.player1 || 0;
            opponentScore += score.player2 || 0;
          } else {
            playerScore += score.player2 || 0;
            opponentScore += score.player1 || 0;
          }
        });

        return {
          ...match,
          won,
          opponentName,
          playerScore,
          opponentScore,
          scoreDisplay: match.scores?.map(s => 
            isPlayer1 ? `${s.player1}-${s.player2}` : `${s.player2}-${s.player1}`
          ).join(', ') || '-',
          contextDisplay: match.groupName || 'Tournament'
        };
      } 
      // Individual match
      else {
        const isUserInTeam1 = match.team1.some(p => p.id === userId);
        const won = (isUserInTeam1 && match.winner === 'team1') || (!isUserInTeam1 && match.winner === 'team2');
        
        const opponentTeam = isUserInTeam1 ? match.team2 : match.team1;
        const opponentName = opponentTeam.map(p => p.name).join(' & ');

        let playerScore = 0;
        let opponentScore = 0;

        match.scores?.forEach(score => {
          if (isUserInTeam1) {
            playerScore += score.team1 || 0;
            opponentScore += score.team2 || 0;
          } else {
            playerScore += score.team2 || 0;
            opponentScore += score.team1 || 0;
          }
        });

        return {
          ...match,
          won,
          opponentName,
          playerScore,
          opponentScore,
          scoreDisplay: match.scores?.map(s => 
            isUserInTeam1 ? `${s.team1}-${s.team2}` : `${s.team2}-${s.team1}`
          ).join(', ') || '-',
          contextDisplay: `${match.matchMode.charAt(0).toUpperCase() + match.matchMode.slice(1)} ${match.matchType}`
        };
      }
    });

    // Sort all matches by date
    enhancedMatches.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    return enhancedMatches;
  } catch (error) {
    console.error('Error getting player statistics:', error);
    return null;
  }
};

// Generate WhatsApp link for tournament invitation
export const generateWhatsAppLink = (tournamentId, tournamentName, date) => {
  const baseUrl = window.location.origin;
  const joinUrl = `${baseUrl}/join/${tournamentId}`;
  const message = encodeURIComponent(
    `🏸 You're invited to ${tournamentName}!\n\n` +
    `📅 Date: ${date}\n` +
    `🏆 Join our Wednesday Social Tournament\n\n` +
    `Click here to confirm your attendance:\n${joinUrl}`
  );
  
  return `https://wa.me/?text=${message}`;
};

// ============================================
// INDIVIDUAL MATCH FUNCTIONS
// ============================================

// Create an individual match (outside of tournaments)
export const createIndividualMatch = async (matchData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const matchRef = doc(collection(db, 'individualMatches'));
    const matchId = matchRef.id;
    
    // Calculate average ELO for each team (for 2v2)
    const team1AvgElo = matchData.team1.reduce((sum, p) => sum + (p.elo || 1200), 0) / matchData.team1.length;
    const team2AvgElo = matchData.team2.reduce((sum, p) => sum + (p.elo || 1200), 0) / matchData.team2.length;
    
    // Get all player IDs for querying
    const allPlayerIds = [
      ...matchData.team1.map(p => p.id),
      ...matchData.team2.map(p => p.id)
    ];
    
    const matchDocument = {
      id: matchId,
      matchType: matchData.matchType, // '1v1' or '2v2'
      matchMode: matchData.matchMode, // 'ranked' or 'casual'
      format: matchData.format, // 'best-of-1', 'best-of-3', etc.
      pointsPerGame: matchData.pointsPerGame,
      team1: matchData.team1,
      team2: matchData.team2,
      team1AvgElo,
      team2AvgElo,
      players: allPlayerIds, // Array for querying
      createdBy: matchData.createdBy || user.uid,
      status: 'pending', // pending, in-progress, completed, cancelled
      scores: [], // Array of game scores
      winner: null, // 'team1' or 'team2'
      eloChanges: null, // Will be populated on completion
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(matchRef, matchDocument);
    
    console.log('Individual match created successfully:', matchId);
    return { success: true, matchId };
  } catch (error) {
    console.error('Error creating individual match:', error);
    return { success: false, error: error.message };
  }
};

// Get individual matches for a player
export const getIndividualMatchesByPlayer = async (userId) => {
  try {
    const q = query(
      collection(db, 'individualMatches'),
      where('players', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const matches = [];
    
    querySnapshot.forEach((doc) => {
      matches.push({ id: doc.id, ...doc.data() });
    });
    
    return matches;
  } catch (error) {
    console.error('Error getting individual matches:', error);
    return [];
  }
};

// Get a single individual match
export const getIndividualMatch = async (matchId) => {
  try {
    const matchRef = doc(db, 'individualMatches', matchId);
    const matchSnap = await getDoc(matchRef);
    
    if (matchSnap.exists()) {
      return { id: matchSnap.id, ...matchSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting individual match:', error);
    return null;
  }
};

// Update individual match score
export const updateIndividualMatchScore = async (matchId, scores, winner) => {
  try {
    const matchRef = doc(db, 'individualMatches', matchId);
    
    await updateDoc(matchRef, {
      scores,
      winner,
      status: winner ? 'completed' : 'in-progress',
      completedAt: winner ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
    
    console.log('Individual match score updated');
    return { success: true };
  } catch (error) {
    console.error('Error updating individual match score:', error);
    return { success: false, error: error.message };
  }
};

// Complete an individual match and update ELO (for ranked matches)
export const completeIndividualMatch = async (matchId, scores, winningTeam) => {
  try {
    const matchRef = doc(db, 'individualMatches', matchId);
    const matchSnap = await getDoc(matchRef);
    
    if (!matchSnap.exists()) {
      return { success: false, error: 'Match not found' };
    }
    
    const match = matchSnap.data();
    
    // Check if match is already completed
    if (match.status === 'completed') {
      return { success: false, error: 'Match is already completed' };
    }
    
    const eloChanges = {};
    
    // Only calculate ELO for ranked matches
    if (match.matchMode === 'ranked') {
      const team1 = match.team1;
      const team2 = match.team2;
      
      // Calculate team average ELOs
      const team1AvgElo = team1.reduce((sum, p) => sum + (p.elo || 1200), 0) / team1.length;
      const team2AvgElo = team2.reduce((sum, p) => sum + (p.elo || 1200), 0) / team2.length;
      
      // Get matches played for each player (for K-factor)
      const playerMatchesBefore = {};
      for (const player of [...team1, ...team2]) {
        try {
          const profile = await getUserProfile(player.id);
          playerMatchesBefore[player.id] = profile?.matchesPlayed || 0;
        } catch (err) {
          playerMatchesBefore[player.id] = 0;
        }
      }
      
      // Calculate ELO changes for each player
      const winners = winningTeam === 'team1' ? team1 : team2;
      const losers = winningTeam === 'team1' ? team2 : team1;
      const winnerAvgElo = winningTeam === 'team1' ? team1AvgElo : team2AvgElo;
      const loserAvgElo = winningTeam === 'team1' ? team2AvgElo : team1AvgElo;
      
      // Update winners
      for (const player of winners) {
        const matchesBefore = playerMatchesBefore[player.id] || 0;
        const eloChange = calculateEloChange(player.elo || 1200, loserAvgElo, true, matchesBefore);
        eloChanges[player.id] = eloChange;
        
        const userRef = doc(db, 'users', player.id);
        await updateDoc(userRef, {
          elo: increment(eloChange),
          matchesPlayed: increment(1),
          matchesWon: increment(1),
          lastEloChange: eloChange,
          updatedAt: serverTimestamp()
        });
      }
      
      // Update losers
      for (const player of losers) {
        const matchesBefore = playerMatchesBefore[player.id] || 0;
        const eloChange = calculateEloChange(player.elo || 1200, winnerAvgElo, false, matchesBefore);
        eloChanges[player.id] = eloChange;
        
        const userRef = doc(db, 'users', player.id);
        await updateDoc(userRef, {
          elo: increment(eloChange),
          matchesPlayed: increment(1),
          lastEloChange: eloChange,
          updatedAt: serverTimestamp()
        });
      }
    } else {
      // Casual match - just update matches played (no ELO change)
      for (const player of [...match.team1, ...match.team2]) {
        eloChanges[player.id] = 0;
        
        const userRef = doc(db, 'users', player.id);
        const isWinner = (winningTeam === 'team1' && match.team1.some(p => p.id === player.id)) ||
                        (winningTeam === 'team2' && match.team2.some(p => p.id === player.id));
        
        await updateDoc(userRef, {
          matchesPlayed: increment(1),
          matchesWon: isWinner ? increment(1) : increment(0),
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Update match document
    await updateDoc(matchRef, {
      scores,
      winner: winningTeam,
      status: 'completed',
      eloChanges,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('Individual match completed successfully');
    return { success: true, eloChanges };
  } catch (error) {
    console.error('Error completing individual match:', error);
    return { success: false, error: error.message };
  }
};

// Cancel an individual match
export const cancelIndividualMatch = async (matchId) => {
  try {
    const matchRef = doc(db, 'individualMatches', matchId);
    
    await updateDoc(matchRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('Match cancelled successfully');
    return { success: true };
  } catch (error) {
    console.error('Error cancelling match:', error);
    return { success: false, error: error.message };
  }
};

// Get all pending/in-progress individual matches
export const getPendingIndividualMatches = async () => {
  try {
    const q = query(
      collection(db, 'individualMatches'),
      where('status', 'in', ['pending', 'in-progress']),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const matches = [];
    
    querySnapshot.forEach((doc) => {
      matches.push({ id: doc.id, ...doc.data() });
    });
    
    return matches;
  } catch (error) {
    console.error('Error getting pending matches:', error);
    return [];
  }
};

// Get recent individual matches (for display)
export const getRecentIndividualMatches = async (limit = 10) => {
  try {
    const q = query(
      collection(db, 'individualMatches'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const matches = [];
    let count = 0;
    
    querySnapshot.forEach((doc) => {
      if (count < limit) {
        matches.push({ id: doc.id, ...doc.data() });
        count++;
      }
    });
    
    return matches;
  } catch (error) {
    console.error('Error getting recent matches:', error);
    return [];
  }
};