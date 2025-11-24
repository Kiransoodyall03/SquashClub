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
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db } from './config';

// User Profile Operations
export const createUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...profileData,
      elo: 1200, // Starting ELO rating
      matchesPlayed: 0,
      matchesWon: 0,
      tournamentsPlayed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { success: false, error: error.message };
  }
};

export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
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

// Tournament Operations
export const createTournament = async (tournamentData) => {
  try {
    const tournamentRef = doc(collection(db, 'tournaments'));
    const tournamentId = tournamentRef.id;
    
    await setDoc(tournamentRef, {
      ...tournamentData,
      id: tournamentId,
      status: 'upcoming',
      participants: [],
      matches: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
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
      return { id: tournamentSnap.id, ...tournamentSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting tournament:', error);
    return null;
  }
};

export const getTournaments = async (filters = {}) => {
  try {
    let q = collection(db, 'tournaments');
    
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    
    if (filters.date) {
      q = query(q, where('date', '==', filters.date));
    }
    
    q = query(q, orderBy('date', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const tournaments = [];
    querySnapshot.forEach((doc) => {
      tournaments.push({ id: doc.id, ...doc.data() });
    });
    
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
        elo: userProfile.elo,
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

export const leaveTournament = async (tournamentId, userId, userProfile) => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const participant = {
      userId,
      name: `${userProfile.firstName} ${userProfile.lastName}`,
      elo: userProfile.elo
    };
    
    await updateDoc(tournamentRef, {
      participants: arrayRemove(participant),
      updatedAt: serverTimestamp()
    });
    
    // Update user's tournaments
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      tournaments: arrayRemove(tournamentId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error leaving tournament:', error);
    return { success: false, error: error.message };
  }
};

// Match Operations
export const createMatch = async (matchData) => {
  try {
    const matchRef = doc(collection(db, 'matches'));
    const matchId = matchRef.id;
    
    await setDoc(matchRef, {
      ...matchData,
      id: matchId,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Add match to tournament
    const tournamentRef = doc(db, 'tournaments', matchData.tournamentId);
    await updateDoc(tournamentRef, {
      matches: arrayUnion(matchId),
      updatedAt: serverTimestamp()
    });
    
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
  const K = 32; // K-factor for ELO calculation
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
export const generateTournamentGroups = (participants, groupSize = 4) => {
  // Sort participants by ELO rating
  const sortedParticipants = [...participants].sort((a, b) => b.elo - a.elo);
  
  const groups = [];
  const numGroups = Math.ceil(sortedParticipants.length / groupSize);
  
  // Snake draft distribution for balanced groups
  for (let i = 0; i < numGroups; i++) {
    groups.push([]);
  }
  
  let groupIndex = 0;
  let direction = 1;
  
  sortedParticipants.forEach((participant, index) => {
    groups[groupIndex].push(participant);
    
    if (groupIndex === numGroups - 1 && direction === 1) {
      direction = -1;
    } else if (groupIndex === 0 && direction === -1) {
      direction = 1;
    } else {
      groupIndex += direction;
    }
  });
  
  return groups;
};

// Statistics Operations
export const getPlayerStatistics = async (userId) => {
  try {
    const userProfile = await getUserProfile(userId);
    const matches = await getMatchesByPlayer(userId);
    
    const stats = {
      currentElo: userProfile.elo,
      matchesPlayed: userProfile.matchesPlayed,
      matchesWon: userProfile.matchesWon,
      winRate: userProfile.matchesPlayed > 0 
        ? Math.round((userProfile.matchesWon / userProfile.matchesPlayed) * 100) 
        : 0,
      recentMatches: matches.slice(0, 5),
      eloHistory: [], // This would need a separate collection to track ELO changes over time
      tournamentsPlayed: userProfile.tournamentsPlayed || 0
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
