import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Calendar, 
  Trophy, 
  Target, 
  Activity,
  Edit,
  Save,
  X
} from 'lucide-react';
import { updateUserProfile } from '../firebase/firestore';

const Profile = ({ user, userProfile }) => {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    age: userProfile?.age || ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    setLoading(true);
    
    await updateUserProfile(user.uid, formData);
    
    setEditMode(false);
    setLoading(false);
    window.location.reload(); // Reload to get updated profile
  };

  const handleCancel = () => {
    setFormData({
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || '',
      age: userProfile?.age || ''
    });
    setEditMode(false);
  };

  const winRate = userProfile?.matchesPlayed > 0 
    ? Math.round((userProfile.matchesWon / userProfile.matchesPlayed) * 100)
    : 0;

  return (
    <div className="profile-page">
      <div className="container">
        <motion.div 
          className="profile-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>My Profile</h1>
          {!editMode && (
            <button 
              className="btn btn-primary"
              onClick={() => setEditMode(true)}
            >
              <Edit className="w-5 h-5" />
              Edit Profile
            </button>
          )}
        </motion.div>

        <div className="profile-content">
          {/* Personal Information */}
          <motion.div 
            className="profile-section card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2>Personal Information</h2>
            
            {editMode ? (
              <div className="edit-form">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    className="form-input"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    className="form-input"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input
                    type="number"
                    name="age"
                    className="form-input"
                    value={formData.age}
                    onChange={handleChange}
                    min="16"
                    max="100"
                  />
                </div>
                
                <div className="edit-actions">
                  <button 
                    className="btn btn-outline"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <X className="w-5 h-5" />
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    <Save className="w-5 h-5" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-info">
                <div className="info-row">
                  <User className="w-5 h-5" />
                  <div>
                    <span className="info-label">Full Name</span>
                    <span className="info-value">
                      {userProfile?.firstName} {userProfile?.lastName}
                    </span>
                  </div>
                </div>
                
                <div className="info-row">
                  <Mail className="w-5 h-5" />
                  <div>
                    <span className="info-label">Email</span>
                    <span className="info-value">{user?.email}</span>
                  </div>
                </div>
                
                <div className="info-row">
                  <Calendar className="w-5 h-5" />
                  <div>
                    <span className="info-label">Age</span>
                    <span className="info-value">{userProfile?.age} years</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Performance Stats */}
          <motion.div 
            className="profile-section card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2>Performance Statistics</h2>
            
            <div className="stats-grid">
              <div className="stat-item">
                <Trophy className="stat-icon" />
                <div className="stat-details">
                  <span className="stat-label">Current ELO</span>
                  <span className="stat-value">{userProfile?.elo || 1200}</span>
                </div>
              </div>
              
              <div className="stat-item">
                <Target className="stat-icon" />
                <div className="stat-details">
                  <span className="stat-label">Win Rate</span>
                  <span className="stat-value">{winRate}%</span>
                </div>
              </div>
              
              <div className="stat-item">
                <Activity className="stat-icon" />
                <div className="stat-details">
                  <span className="stat-label">Matches Played</span>
                  <span className="stat-value">{userProfile?.matchesPlayed || 0}</span>
                </div>
              </div>
              
              <div className="stat-item">
                <Trophy className="stat-icon" />
                <div className="stat-details">
                  <span className="stat-label">Matches Won</span>
                  <span className="stat-value">{userProfile?.matchesWon || 0}</span>
                </div>
              </div>
            </div>
            
            {userProfile?.lastEloChange && (
              <div className="recent-change">
                <span>Last ELO Change:</span>
                <span className={`elo-change ${userProfile.lastEloChange > 0 ? 'positive' : 'negative'}`}>
                  {userProfile.lastEloChange > 0 ? '+' : ''}{userProfile.lastEloChange}
                </span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Account Details */}
        <motion.div 
          className="account-section card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2>Account Details</h2>
          <div className="account-info">
            <div className="account-item">
              <span className="account-label">Account Type:</span>
              <span className="badge badge-primary">
                {userProfile?.role === 'owner' ? 'Club Owner' : 'Player'}
              </span>
            </div>
            <div className="account-item">
              <span className="account-label">Member Since:</span>
              <span>{new Date(userProfile?.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</span>
            </div>
            <div className="account-item">
              <span className="account-label">Tournaments Played:</span>
              <span>{userProfile?.tournamentsPlayed || 0}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        .profile-page {
          min-height: calc(100vh - 70px);
          padding: var(--spacing-2xl) 0;
          background: var(--off-white);
        }

        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-2xl);
        }

        .profile-header h1 {
          margin: 0;
        }

        .profile-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-xl);
          margin-bottom: var(--spacing-xl);
        }

        .profile-section {
          padding: var(--spacing-xl);
        }

        .profile-section h2 {
          margin-bottom: var(--spacing-lg);
          font-size: 1.5rem;
        }

        .profile-info {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .info-row {
          display: flex;
          align-items: start;
          gap: var(--spacing-md);
        }

        .info-row > div {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .info-label {
          font-size: 0.875rem;
          color: var(--gray);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .info-value {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--secondary);
        }

        .edit-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .edit-actions {
          display: flex;
          gap: var(--spacing-md);
          margin-top: var(--spacing-lg);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-lg);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          padding: var(--spacing-sm);
          background: var(--gradient-primary);
          border-radius: var(--radius-md);
          color: var(--white);
        }

        .stat-details {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--gray);
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--secondary);
        }

        .recent-change {
          margin-top: var(--spacing-lg);
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .account-section {
          padding: var(--spacing-xl);
        }

        .account-section h2 {
          margin-bottom: var(--spacing-lg);
          font-size: 1.5rem;
        }

        .account-info {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .account-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md) 0;
          border-bottom: 1px solid var(--light-gray);
        }

        .account-item:last-child {
          border-bottom: none;
        }

        .account-label {
          font-weight: 500;
          color: var(--dark-gray);
        }

        @media (max-width: 768px) {
          .profile-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-md);
          }

          .profile-content {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Profile;
