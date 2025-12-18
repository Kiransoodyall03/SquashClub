// src/components/Register.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Calendar, 
  UserPlus, 
  AlertCircle, 
  Shield,
  Key,
  CheckCircle
} from 'lucide-react';
import { 
  registerWithEmail, 
  loginWithGoogle, 
  completeGoogleRegistration,
  validateRegistrationPassword 
} from '../../firebase/auth';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    role: 'player',
    registrationPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Google sign-up states
  const [googleUser, setGoogleUser] = useState(null);
  const [showGoogleCompletion, setShowGoogleCompletion] = useState(false);
  const [googleFormData, setGoogleFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    role: 'player',
    registrationPassword: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleGoogleFormChange = (e) => {
    setGoogleFormData({
      ...googleFormData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    const age = parseInt(formData.age);
    if (age < 16 || age > 100) {
      setError('Age must be between 16 and 100');
      return false;
    }
    // Validate registration password
    if (!validateRegistrationPassword(formData.role, formData.registrationPassword)) {
      setError(`Invalid registration password for ${formData.role === 'owner' ? 'Club Owner' : 'Player'} account`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');

    const profileData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      age: parseInt(formData.age),
      role: formData.role
    };

    const result = await registerWithEmail(formData.email, formData.password, profileData);
    
    if (result.success) {
      if (formData.role === 'owner') {
        navigate('/owner-dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

const handleGoogleSignup = async () => {
  setLoading(true);
  setError('');
  
  console.log('=== handleGoogleSignup START ===');
  
  const result = await loginWithGoogle();
  
  console.log('=== loginWithGoogle result ===');
  console.log('Success:', result.success);
  console.log('isNewUser:', result.isNewUser);
  console.log('Has user:', !!result.user);
  console.log('Has profile:', !!result.profile);
  console.log('Full result:', result);
  
  if (result.success) {
    console.log('Login successful');
    
    if (result.isNewUser) {
      console.log('🆕 NEW USER DETECTED - showing completion form');
      // New user - show completion form
      setGoogleUser(result.user);
      
      // Pre-fill form with Google data
      const displayName = result.user.displayName || '';
      const nameParts = displayName.split(' ');
      
      console.log('Display name:', displayName);
      console.log('Name parts:', nameParts);
      
      setGoogleFormData({
        ...googleFormData,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || ''
      });
      
      setShowGoogleCompletion(true);
      console.log('✅ Completion form state set to TRUE');
    } else {
      console.log('👤 EXISTING USER - redirecting');
      console.log('Profile role:', result.profile?.role);
      
      // Existing user - redirect based on role
      if (result.profile?.role === 'owner') {
        console.log('→ Redirecting to owner dashboard');
        navigate('/owner-dashboard');
      } else {
        console.log('→ Redirecting to player dashboard');
        navigate('/dashboard');
      }
    }
  } else {
    console.error('❌ Login failed:', result.error);
    setError(result.error);
  }
  
  setLoading(false);
  console.log('=== handleGoogleSignup END ===');
};

  const handleGoogleCompletion = async (e) => {
    e.preventDefault();
    
    // Validate registration password
    if (!validateRegistrationPassword(googleFormData.role, googleFormData.registrationPassword)) {
      setError(`Invalid registration password for ${googleFormData.role === 'owner' ? 'Club Owner' : 'Player'} account`);
      return;
    }
    
    // Validate age if provided
    if (googleFormData.age) {
      const age = parseInt(googleFormData.age);
      if (age < 16 || age > 100) {
        setError('Age must be between 16 and 100');
        return;
      }
    }
    
    setLoading(true);
    setError('');
    
    const result = await completeGoogleRegistration(googleUser.uid, {
      firstName: googleFormData.firstName,
      lastName: googleFormData.lastName,
      age: googleFormData.age ? parseInt(googleFormData.age) : null,
      role: googleFormData.role
    });
    
    if (result.success) {
      if (googleFormData.role === 'owner') {
        navigate('/owner-dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  // Google Completion Form
  if (showGoogleCompletion && googleUser) {
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
              <p>Just a few more details to get you started</p>
            </div>

            {/* Google Account Info */}
            <div className="google-account-banner">
              {googleUser.photoURL ? (
                <img 
                  src={googleUser.photoURL} 
                  alt="Profile" 
                  className="google-avatar"
                />
              ) : (
                <div className="google-avatar-placeholder">
                  <User className="w-6 h-6" />
                </div>
              )}
              <div className="google-account-details">
                <span className="google-name">{googleUser.displayName}</span>
                <span className="google-email">{googleUser.email}</span>
              </div>
              <CheckCircle className="w-5 h-5 google-verified" />
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

            <form onSubmit={handleGoogleCompletion} className="auth-form">
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
                      value={googleFormData.firstName}
                      onChange={handleGoogleFormChange}
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
                      value={googleFormData.lastName}
                      onChange={handleGoogleFormChange}
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
                      value={googleFormData.age}
                      onChange={handleGoogleFormChange}
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
                      value={googleFormData.role}
                      onChange={handleGoogleFormChange}
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
                    ({googleFormData.role === 'owner' ? 'Club Owner' : 'Player'} password)
                  </span>
                </label>
                <div className="input-wrapper">
                  <Key className="input-icon" />
                  <input
                    type="password"
                    name="registrationPassword"
                    className="form-input with-icon"
                    placeholder="Enter registration password"
                    value={googleFormData.registrationPassword}
                    onChange={handleGoogleFormChange}
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
              <p>
                <button 
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setShowGoogleCompletion(false);
                    setGoogleUser(null);
                    setError('');
                  }}
                >
                  ← Back to registration options
                </button>
              </p>
            </div>
          </div>
        </motion.div>

        <style>{`
          .auth-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--spacing-xl);
            background: linear-gradient(135deg, var(--light-gray) 0%, rgba(255, 107, 53, 0.1) 100%);
          }

          .auth-container-large {
            max-width: 550px;
          }

          .auth-card {
            padding: var(--spacing-2xl);
          }

          .auth-header {
            text-align: center;
            margin-bottom: var(--spacing-2xl);
          }

          .auth-header h2 {
            margin-bottom: var(--spacing-sm);
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--spacing-md);
          }

          .google-account-banner {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            padding: var(--spacing-md);
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid var(--success);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-lg);
          }

          .google-avatar {
            width: 48px;
            height: 48px;
            border-radius: var(--radius-full);
            object-fit: cover;
          }

          .google-avatar-placeholder {
            width: 48px;
            height: 48px;
            border-radius: var(--radius-full);
            background: var(--light-gray);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--gray);
          }

          .google-account-details {
            flex: 1;
            display: flex;
            flex-direction: column;
          }

          .google-name {
            font-weight: 600;
            color: var(--secondary);
          }

          .google-email {
            font-size: 0.875rem;
            color: var(--gray);
          }

          .google-verified {
            color: var(--success);
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
            margin-bottom: var(--spacing-lg);
          }

          .input-wrapper {
            position: relative;
          }

          .input-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            color: var(--gray);
          }

          .form-input.with-icon {
            padding-left: 3rem;
          }

          .label-hint {
            font-weight: 400;
            color: var(--gray);
            font-size: 0.75rem;
            margin-left: var(--spacing-xs);
          }

          .form-hint {
            font-size: 0.75rem;
            color: var(--gray);
            margin-top: var(--spacing-xs);
          }

          .link-button {
            background: none;
            border: none;
            color: var(--primary);
            cursor: pointer;
            font-size: inherit;
            padding: 0;
          }

          .link-button:hover {
            text-decoration: underline;
          }

          .btn-full {
            width: 100%;
          }

          .auth-footer {
            text-align: center;
            margin-top: var(--spacing-xl);
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
          }
        `}</style>
      </div>
    );
  }

  // Main Registration Form
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
            <h2>Join the Club</h2>
            <p>Create your account to start tracking your ELO</p>
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

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input
                  type="email"
                  name="email"
                  className="form-input with-icon"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    type="password"
                    name="password"
                    className="form-input with-icon"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-input with-icon"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Age</label>
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
                    required
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
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignup}
            className="btn btn-google btn-full"
            disabled={loading}
          >
            <svg className="google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;