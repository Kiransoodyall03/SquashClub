// src/components/CompleteProfile.js

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Calendar, 
  Shield, 
  Key, 
  UserPlus, 
  AlertCircle,
  LogOut
} from 'lucide-react';
import { validateRegistrationPassword, logout } from '../firebase/auth';
import { createUserProfile } from '../firebase/firestore';

const CompleteProfile = ({ user, onProfileComplete }) => {
  const [formData, setFormData] = useState({
    firstName: user?.displayName?.split(' ')[0] || '',
    lastName: user?.displayName?.split(' ').slice(1).join(' ') || '',
    age: '',
    role: 'player',
    registrationPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate registration password
    if (!validateRegistrationPassword(formData.role, formData.registrationPassword)) {
      setError(`Invalid registration password for ${formData.role === 'owner' ? 'Club Owner' : 'Player'} account`);
      return;
    }
    
    // Validate age if provided
    if (formData.age) {
      const age = parseInt(formData.age);
      if (age < 16 || age > 100) {
        setError('Age must be between 16 and 100');
        return;
      }
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('Creating profile for user:', user.uid);
      
      const profileData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: user.email,
        role: formData.role,
        age: formData.age ? parseInt(formData.age) : null,
        photoURL: user.photoURL || null,
        authProvider: user.providerData[0]?.providerId || 'unknown'
      };
      
      console.log('Profile data:', profileData);
      
      const result = await createUserProfile(user.uid, profileData);
      
      console.log('Create profile result:', result);
      
      if (result.success) {
        console.log(' Profile created successfully');
        // Call the callback to refresh the app state
        if (onProfileComplete) {
          await onProfileComplete();
        }
      } else {
        setError(result.error || 'Failed to create profile');
      }
    } catch (err) {
      console.error('Error creating profile:', err);
      setError(err.message);
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <div className="auth-page">
      <motion.div 
        className="auth-container auth-container-large"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-card card">
          <div className="auth-header">
            <h2>Complete Your Profile</h2>
            <p>We need a few more details to set up your account</p>
          </div>

          {/* Account Info Banner */}
          <div className="account-banner">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                className="account-avatar"
              />
            ) : (
              <div className="account-avatar-placeholder">
                <User className="w-6 h-6" />
              </div>
            )}
            <div className="account-details">
              <span className="account-name">{user?.displayName || 'User'}</span>
              <span className="account-email">{user?.email}</span>
            </div>
          </div>

          {error && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" />
                  <input
                    type="text"
                    name="firstName"
                    className="form-input with-icon"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" />
                  <input
                    type="text"
                    name="lastName"
                    className="form-input with-icon"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Age (Optional)</label>
                <div className="input-wrapper">
                  <Calendar className="input-icon" />
                  <input
                    type="number"
                    name="age"
                    className="form-input with-icon"
                    placeholder="25"
                    min="16"
                    max="100"
                    value={formData.age}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Account Type</label>
                <div className="input-wrapper">
                  <Shield className="input-icon" />
                  <select
                    name="role"
                    className="form-input form-select with-icon"
                    value={formData.role}
                    onChange={handleChange}
                    required
                  >
                    <option value="player">Player</option>
                    <option value="owner">Club Owner</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Registration Password
                <span className="label-hint">
                  ({formData.role === 'owner' ? 'Club Owner' : 'Player'} password)
                </span>
              </label>
              <div className="input-wrapper">
                <Key className="input-icon" />
                <input
                  type="password"
                  name="registrationPassword"
                  className="form-input with-icon"
                  placeholder="Enter registration password"
                  value={formData.registrationPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              <p className="form-hint">
                Contact your club administrator for the registration password
              </p>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Complete Registration
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <button 
              type="button"
              className="btn btn-outline btn-full"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              Sign Out & Try Different Account
            </button>
          </div>
        </div>
      </motion.div>

      <style>{`


        .auth-container-large {
          max-width: 550px;
        }



        .auth-header h2 {
          margin-bottom: var(--spacing-sm);
          color: var(--secondary);
        }


        .account-banner {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--light-gray);
          border-radius: 0;
          margin-bottom: var(--spacing-lg);
        }

        .account-avatar {
          width: 48px;
          height: 48px;
          border-radius: 0;
          object-fit: cover;
        }

        .account-avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 0;
          background: var(--gray);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--white);
        }

        .account-details {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .account-name {
          font-weight: 600;
          color: var(--secondary);
        }

        .account-email {
          font-size: 0.875rem;
          color: var(--gray);
        }



        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }





















        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default CompleteProfile;