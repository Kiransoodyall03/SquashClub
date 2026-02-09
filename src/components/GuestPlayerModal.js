// src/components/GuestPlayerModal.js

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X } from 'lucide-react';

const GuestPlayerModal = ({ isOpen, onClose, onConfirm, groupName }) => {
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGuestName('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const trimmedName = guestName.trim();
    
    if (!trimmedName) {
      setError('Please enter a guest name');
      return;
    }
    
    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    
    if (trimmedName.length > 50) {
      setError('Name must be less than 50 characters');
      return;
    }
    
    onConfirm(trimmedName);
    setGuestName('');
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div 
          className="guest-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title">
              <UserPlus className="w-6 h-6" />
              <h3>Add Guest Player</h3>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="modal-body">
            <p className="modal-description">
              Add a guest player to <strong>{groupName}</strong>
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="guestName">Guest Name</label>
                <input
                  id="guestName"
                  type="text"
                  className={`guest-input ${error ? 'error' : ''}`}
                  placeholder="Enter guest player name"
                  value={guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value);
                    setError('');
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  maxLength={50}
                />
                {error && <span className="error-message">{error}</span>}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <UserPlus className="w-4 h-4" />
                  Add Guest
                </button>
              </div>
            </form>
          </div>

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
              padding: var(--spacing-md);
            }

            .guest-modal {
              background: var(--white);
              border-radius: var(--radius-lg);
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              max-width: 480px;
              width: 100%;
              overflow: hidden;
            }

            .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: var(--spacing-lg) var(--spacing-xl);
              border-bottom: 1px solid var(--light-gray);
              background: linear-gradient(135deg, rgba(33, 150, 243, 0.05), rgba(33, 150, 243, 0.02));
            }

            .modal-title {
              display: flex;
              align-items: center;
              gap: var(--spacing-sm);
              color: var(--secondary);
            }

            .modal-title h3 {
              margin: 0;
              font-size: 1.25rem;
              font-weight: 700;
            }

            .modal-title svg {
              color: #2196F3;
            }

            .close-btn {
              background: transparent;
              border: none;
              cursor: pointer;
              padding: var(--spacing-xs);
              border-radius: var(--radius-sm);
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--gray);
              transition: all 0.2s;
            }

            .close-btn:hover {
              background: var(--light-gray);
              color: var(--secondary);
            }

            .modal-body {
              padding: var(--spacing-xl);
            }

            .modal-description {
              margin: 0 0 var(--spacing-lg) 0;
              color: var(--dark-gray);
              font-size: 0.95rem;
              line-height: 1.5;
            }

            .modal-description strong {
              color: var(--primary);
              font-weight: 600;
            }

            .form-group {
              margin-bottom: var(--spacing-xl);
            }

            .form-group label {
              display: block;
              margin-bottom: var(--spacing-sm);
              font-weight: 600;
              color: var(--secondary);
              font-size: 0.875rem;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }

            .guest-input {
              width: 100%;
              padding: var(--spacing-md) var(--spacing-lg);
              border: 2px solid var(--light-gray);
              border-radius: var(--radius-md);
              font-size: 1rem;
              font-family: inherit;
              transition: all 0.2s;
              background: var(--white);
              color: var(--secondary);
            }

            .guest-input:focus {
              outline: none;
              border-color: var(--primary);
              box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
            }

            .guest-input.error {
              border-color: var(--danger);
            }

            .guest-input.error:focus {
              box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.1);
            }

            .guest-input::placeholder {
              color: var(--gray);
              opacity: 0.6;
            }

            .error-message {
              display: block;
              margin-top: var(--spacing-xs);
              color: var(--danger);
              font-size: 0.875rem;
              font-weight: 500;
            }

            .modal-actions {
              display: flex;
              gap: var(--spacing-md);
              justify-content: flex-end;
            }

            .modal-actions .btn {
              min-width: 120px;
              justify-content: center;
            }

            @media (max-width: 768px) {
              .guest-modal {
                max-width: 100%;
                margin: var(--spacing-md);
              }

              .modal-actions {
                flex-direction: column-reverse;
              }

              .modal-actions .btn {
                width: 100%;
              }
            }
          `}</style>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GuestPlayerModal;