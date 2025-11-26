// src/firebase/firestore.js

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
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
      tournaments: [], // Add this missing field
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

// Tournament Status Helper
export const calculateTournamentStatus = (tournament) => {
  if (!tournament.date || !tournament.time) return tournament.status;
  
  const now = new Date();
  const tournamentDate = new Date(tournament.date);
  const [hours, minutes] = tournament.time.split(':').map(Number);
  
  // Set tournament start time
  const tournamentStart = new Date(tournamentDate);
  tournamentStart.setHours(hours, minutes, 0, 0);
  
  // Set tournament end (assume 4 hours duration, or next day)
  const tournamentEnd = new Date(tournamentStart);
  tournamentEnd.setHours(tournamentEnd.getHours() + 4);
  
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

// Update tournament status if needed
export const updateTournamentStatusIfNeeded = async (tournamentId, tournament) => {
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
      
      // Check and update status if needed
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
      // Update status if needed
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
    
    // Only add date filter to query - status filtering happens client-side after calculation
    if (filters.date) {
      constraints.push(where('date', '==', filters.date));
    }
    
    constraints.push(orderBy('date', 'desc'));
    
    q = query(collection(db, 'tournaments'), ...constraints);
    
    const querySnapshot = await getDocs(q);
    const tournaments = [];
    
    for (const docSnap of querySnapshot.docs) {
      const tournament = { id: docSnap.id, ...docSnap.data() };
      
      // Update status based on current date/time
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

// Fixed leaveTournament - arrayRemove needs exact match, so we fetch and filter instead
export const leaveTournament = async (tournamentId, userId) => {
  try {
    // Get current tournament data
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      return { success: false, error: 'Tournament not found' };
    }
    
    const tournamentData = tournamentSnap.data();
    
    // Filter out the participant
    const updatedParticipants = (tournamentData.participants || []).filter(
      p => p.userId !== userId
    );
    
    // Update tournament with filtered participants
    await updateDoc(tournamentRef, {
      participants: updatedParticipants,
      updatedAt: serverTimestamp()
    });
    
    // Get current user data and update tournaments array
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

// Complete Tournament and Calculate Final ELOs
export const completeTournament = async (tournamentId) => {
  try {
    // Get tournament data
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      return { success: false, error: 'Tournament not found' };
    }
    
    const tournament = tournamentSnap.data();
    
    // Get all matches for this tournament
    const matches = await getMatchesByTournament(tournamentId);
    
    // Check if all matches are completed
    const pendingMatches = matches.filter(m => m.status !== 'completed');
    if (pendingMatches.length > 0) {
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
    
    // Calculate ELO changes for each player based on ALL their matches
    const playerEloChanges = {};
    const playerMatchStats = {};
    
    // Initialize stats for each participant
    tournament.participants?.forEach(p => {
      playerEloChanges[p.userId] = 0;
      playerMatchStats[p.userId] = { played: 0, won: 0 };
    });
    
    // Process each match
    matches.forEach(match => {
      if (!match.winner || !match.player1Id || !match.player2Id) return;
      
      const player1Id = match.player1Id;
      const player2Id = match.player2Id;
      const winnerId = match.winner;
      const loserId = winnerId === player1Id ? player2Id : player1Id;
      
      // Get starting ELOs (use tournament registration ELO for fairness)
      const player1Elo = playerStartingElos[player1Id] || 1200;
      const player2Elo = playerStartingElos[player2Id] || 1200;
      
      // Calculate ELO changes using chess formula
      const winnerElo = winnerId === player1Id ? player1Elo : player2Elo;
      const loserElo = loserId === player1Id ? player1Elo : player2Elo;
      
      const winnerChange = calculateEloChange(winnerElo, loserElo, true);
      const loserChange = calculateEloChange(loserElo, winnerElo, false);
      
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
    
    // Update each player's ELO in the database
    const updatePromises = [];
    
    for (const [userId, eloChange] of Object.entries(playerEloChanges)) {
      const stats = playerMatchStats[userId];
      const userRef = doc(db, 'users', userId);
      
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
    
    // Mark tournament as completed
    await updateDoc(tournamentRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('Tournament completed successfully');
    return { 
      success: true, 
      eloChanges: playerEloChanges,
      matchStats: playerMatchStats
    };
  } catch (error) {
    console.error('Error completing tournament:', error);
    return { success: false, error: error.message };
  }
};

// Get tournaments a player has participated in
export const getPlayerTournaments = async (userId) => {
  try {
    const allTournaments = await getTournaments();
    
    // Filter tournaments where user is a participant
    const playerTournaments = allTournaments.filter(tournament => 
      tournament.participants?.some(p => p.userId === userId)
    );
    
    // Sort by date (most recent first)
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
    const matches = await getMatchesByPlayer(userId);
    
    // Enhance matches with win/loss info
    const enhancedMatches = matches.map(match => {
      const isPlayer1 = match.player1Id === userId;
      const won = match.winner === userId;
      const opponentName = isPlayer1 ? match.player2Name : match.player1Name;
      const opponentId = isPlayer1 ? match.player2Id : match.player1Id;
      
      // Calculate player's score vs opponent's score
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
        opponentId,
        playerScore,
        opponentScore,
        scoreDisplay: match.scores?.map(s => 
          isPlayer1 ? `${s.player1}-${s.player2}` : `${s.player2}-${s.player1}`
        ).join(', ') || '-'
      };
    });
    
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
    const standings = Object.entries(playerStats)
      .map(([userId, stats]) => ({
        userId,
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
      format: tournamentFormat, // Include tournament format
      players: [matchData.player1Id, matchData.player2Id], // Array for querying
      createdBy: user.uid,
      status: 'pending',
      scores: [],
      winner: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Add match to tournament if tournamentId exists
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

// ELO Rating Calculation
export const calculateEloChange = (playerElo, opponentElo, playerWon) => {
  const K = 32;
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actualScore = playerWon ? 1 : 0;
  const eloChange = Math.round(K * (actualScore - expectedScore));
  
  return eloChange;
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

// Tournament Group Generation based on ELO
// Group A = highest ELO players, Group B = next tier, etc.
export const generateTournamentGroups = (participants, groupSize = 4) => {
  // Sort participants by ELO rating (highest first)
  const sortedParticipants = [...participants].sort((a, b) => (b.elo || 1200) - (a.elo || 1200));
  
  const groups = [];
  const numGroups = Math.ceil(sortedParticipants.length / groupSize);
  
  // Initialize empty groups
  for (let i = 0; i < numGroups; i++) {
    groups.push([]);
  }
  
  // Fill groups sequentially - Group A gets top players, Group B gets next tier, etc.
  sortedParticipants.forEach((participant, index) => {
    const groupIndex = Math.floor(index / groupSize);
    if (groupIndex < numGroups) {
      groups[groupIndex].push(participant);
    }
  });
  
  // Sort players within each group by ELO (highest first)
  groups.forEach(group => {
    group.sort((a, b) => (b.elo || 1200) - (a.elo || 1200));
  });
  
  return groups;
};

// Generate all matches for a group (round-robin)
export const generateGroupMatches = async (tournamentId, tournamentFormat, group, groupName) => {
  const matches = [];
  
  // Round-robin: each player plays every other player once
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
    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) {
      console.warn('User profile not found for userId:', userId);
      return {
        currentElo: 1200,
        matchesPlayed: 0,
        matchesWon: 0,
        winRate: 0,
        recentMatches: [],
        eloHistory: [],
        tournamentsPlayed: 0,
        lastEloChange: 0
      };
    }
    
    const matches = await getMatchesByPlayer(userId);
    
    const stats = {
      currentElo: userProfile.elo || 1200,
      matchesPlayed: userProfile.matchesPlayed || 0,
      matchesWon: userProfile.matchesWon || 0,
      winRate: userProfile.matchesPlayed > 0 
        ? Math.round((userProfile.matchesWon / userProfile.matchesPlayed) * 100) 
        : 0,
      recentMatches: matches.slice(0, 5),
      eloHistory: [],
      tournamentsPlayed: userProfile.tournamentsPlayed || 0,
      lastEloChange: userProfile.lastEloChange || 0
    };
    
    return stats;
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