# SquashClub# 🏸 Squash Club Tournament Management System

A modern web application for managing squash club tournaments with an ELO rating system. This system helps clubs organize Wednesday social tournaments, automatically create balanced groups based on player ratings, and track player progress over time.

## ✨ Features

### For Players
- **User Authentication**: Sign up/login with email or Google account
- **Player Profile**: Manage personal information and view statistics
- **ELO Rating System**: Track skill progression with chess-style ratings
- **Tournament Registration**: Join tournaments via web or WhatsApp links
- **Match Scoring**: Log match results directly in the app
- **Performance Stats**: View win rate, match history, and ranking
- **Leaderboard**: See club-wide player rankings

### For Club Owners
- **Tournament Creation**: Set up tournaments with custom formats
- **Smart Group Generation**: Automatically create balanced groups based on ELO
- **WhatsApp Integration**: Send tournament invitations via WhatsApp
- **Email Notifications**: Notify players about upcoming tournaments
- **Tournament Management**: Track participation and manage results
- **Flexible Scoring**: Support various game formats (1 game to 21, best of 3, etc.)

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Firebase account
- Modern web browser

### Installation

1. **Clone or Download the Project**
```bash
# If using git
git clone <repository-url>
cd squash-club

# Or extract the provided files
cd squash-club
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Firebase**

Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)

Enable the following services:
- Authentication (Email/Password and Google providers)
- Firestore Database
- Hosting (optional, for deployment)

4. **Update Firebase Configuration**

Edit `src/firebase/config.js` and replace the placeholder values with your Firebase project credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

5. **Set Up Firestore Security Rules**

In Firebase Console > Firestore > Rules, add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile and update it
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Tournaments are readable by all authenticated users
    match /tournaments/{tournamentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'owner';
      allow update: if request.auth != null && 
        (resource.data.ownerId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'owner');
    }
    
    // Matches are readable by all authenticated users
    match /matches/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

6. **Run the Development Server**
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## 📱 Usage Guide

### First Time Setup

1. **Register as Club Owner**
   - Navigate to the registration page
   - Fill in your details
   - Select "Club Owner" as account type
   - Complete registration

2. **Create Your First Tournament**
   - Go to Dashboard
   - Click "Create Tournament"
   - Set date, time, and format
   - Configure group size and max participants
   - Save tournament

3. **Invite Players**
   - Click "Send Invites" on the tournament
   - Share the WhatsApp link with players
   - Players can join via the link

### For Players

1. **Join a Tournament**
   - Click the WhatsApp invitation link
   - Register/login to your account
   - Confirm tournament participation

2. **Log Match Results**
   - Navigate to the tournament page
   - Find your match
   - Click "Enter Score"
   - Submit the results

3. **Track Progress**
   - View your dashboard for ELO rating
   - Check leaderboard for club ranking
   - Review match history and statistics

## 🌐 Deployment

### Deploy to Firebase Hosting

1. **Install Firebase CLI**
```bash
npm install -g firebase-tools
```

2. **Initialize Firebase**
```bash
firebase init
```
Select:
- Hosting
- Use existing project
- Build directory: `build`
- Single-page app: Yes

3. **Build and Deploy**
```bash
npm run build
firebase deploy
```

### Deploy to Other Platforms

**Vercel:**
```bash
npm install -g vercel
vercel
```

**Netlify:**
1. Build the project: `npm run build`
2. Drag the `build` folder to Netlify

## 🎮 ELO Rating System

The app uses a chess-style ELO rating system:
- New players start at 1200 ELO
- K-factor of 32 for rating adjustments
- Ratings update after each match
- Groups are balanced based on ELO

### ELO Calculation
```
Expected Score = 1 / (1 + 10^((OpponentELO - PlayerELO) / 400))
ELO Change = K * (ActualScore - ExpectedScore)
```

## 📋 Features Breakdown

### Tournament Formats
- 1 game to 21 points
- 2 games to 15 points
- 3 games to 11 points
- Best of 3 to 11
- Best of 5 to 9
- Custom formats

### Group Generation Algorithm
- Snake draft distribution for balanced groups
- Players sorted by ELO rating
- Configurable group sizes (2-8 players)

### WhatsApp Integration
- One-click invitation sending
- Custom message with tournament details
- Direct join links for players

## 🔧 Troubleshooting

### Common Issues

**Firebase Authentication Error:**
- Ensure authentication providers are enabled
- Check API keys are correct
- Verify domain is authorized

**Firestore Permission Denied:**
- Check security rules are properly set
- Ensure user is authenticated
- Verify user role for owner actions

**Build Errors:**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (16+ required)
- Ensure all environment variables are set

## 📊 Database Structure

```
users/
  - userId/
    - firstName
    - lastName
    - email
    - age
    - role (player/owner)
    - elo
    - matchesPlayed
    - matchesWon
    - tournamentsPlayed

tournaments/
  - tournamentId/
    - name
    - date
    - time
    - format
    - status
    - participants[]
    - matches[]
    - groupSize
    - maxParticipants

matches/
  - matchId/
    - tournamentId
    - players[]
    - scores[]
    - winner
    - status
```

## 🤝 Support

For questions or issues:
1. Check the troubleshooting section
2. Review Firebase documentation
3. Test with different browsers
4. Verify all configuration steps

## 📈 Future Enhancements

Potential features to add:
- Push notifications
- Tournament brackets visualization
- Historical ELO charts
- Season management
- Prize tracking
- Court scheduling
- Mobile app version
- Export to PDF reports

## 🎯 Best Practices

1. **Regular Backups**: Export Firestore data regularly
2. **Test Tournaments**: Create test events before going live
3. **User Training**: Brief introduction for older players
4. **Fair Play**: Monitor for accurate score reporting
5. **Active Management**: Update tournament status promptly

## 📄 License

This project is provided as-is for your squash club's use.

---

**Built with React + Firebase for modern squash club management** 🏸