//CreateTournamentModal.js

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, Users, Trophy, Settings } from 'lucide-react';

const CreateTournamentModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: 'Wednesday Social Tournament',
    date: '',
    time: '18:00',
    format: '1 game to 21',
    groupSize: 4,
    maxParticipants: 16,
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatOptions = [
    '1 game to 21',
    '2 games to 15',
    '3 games to 11',
    'Best of 3 to 11',
    'Best of 3 to 15',
    'Best of 5 to 11',
    'Best of 5 to 15',
    'Best of 7 to 11',
    'Custom'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await onSubmit(formData);
    
    if (!result.success) {
      setError(result.error || 'Failed to create tournament');
    }
    
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        className="modal-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Create Tournament</h2>
          <button className="close-btn" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">
              <Trophy className="w-4 h-4" />
              Tournament Name
            </label>
            <input
              type="text"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              <input
                type="date"
                name="date"
                className="form-input"
                value={formData.date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Clock className="w-4 h-4" />
                Time
              </label>
              <input
                type="time"
                name="time"
                className="form-input"
                value={formData.time}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <Settings className="w-4 h-4" />
              Scoring Format
            </label>
            <select
              name="format"
              className="form-input form-select"
              value={formData.format}
              onChange={handleChange}
              required
            >
              {formatOptions.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <Users className="w-4 h-4" />
                Group Size
              </label>
              <input
                type="number"
                name="groupSize"
                className="form-input"
                value={formData.groupSize}
                onChange={handleChange}
                min="2"
                max="8"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Users className="w-4 h-4" />
                Max Participants
              </label>
              <input
                type="number"
                name="maxParticipants"
                className="form-input"
                value={formData.maxParticipants}
                onChange={handleChange}
                min="4"
                max="32"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              name="description"
              className="form-input"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              placeholder="Any special instructions or notes..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </motion.div>

      <style jsx>{`
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
          padding: var(--spacing-lg);
        }

        .modal-content {
          background: var(--white);
          border-radius: var(--radius-lg);
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-xl);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-xl);
          border-bottom: 1px solid var(--light-gray);
        }

        .modal-header h2 {
          margin: 0;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--gray);
          cursor: pointer;
          padding: var(--spacing-sm);
          border-radius: var(--radius-sm);
          transition: all var(--transition-base);
        }

        .close-btn:hover {
          background: var(--light-gray);
          color: var(--secondary);
        }

        .modal-form {
          padding: var(--spacing-xl);
        }

        .form-label {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-md);
          margin-top: var(--spacing-xl);
        }

        .error-message {
          margin: var(--spacing-md) var(--spacing-xl) 0;
          padding: var(--spacing-md);
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid var(--danger);
          border-radius: var(--radius-md);
          color: var(--danger);
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

export default CreateTournamentModal;
