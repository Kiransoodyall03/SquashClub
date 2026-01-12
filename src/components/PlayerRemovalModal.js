// src/components/PlayerRemovalModal.js

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserMinus, AlertTriangle } from 'lucide-react';

const PlayerRemovalModal = ({ isOpen, onClose, player, onConfirm, isRemoving, result }) => {
  if (!isOpen || !player) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={() => !isRemoving && onClose()}>
        <motion.div 
          className="removal-modal"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <UserMinus />
            <h2>Remove Player</h2>
          </div>

          <div className="modal-body">
            {result ? (
              <div className={`removal-result ${result.success ? 'success' : 'error'}`}>
                {result.success ? (
                  <>
                    <strong>✓ Player removed successfully</strong>
                    <p>{result.message}</p>
                  </>
                ) : (
                  <>
                    <strong>✗ Removal failed</strong>
                    <p>{result.error}</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="player-removal-info">
                  <UserMinus />
                  <div className="player-details">
                    <strong>{player.name}</strong>
                    <span>ELO: {player.elo}</span>
                  </div>
                </div>

                <div className="modal-warning">
                  <AlertTriangle />
                  <div>
                    <p>
                      <strong>This will mark the player as a no-show:</strong>
                    </p>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      <li>All their pending matches will be forfeited</li>
                      <li>Opponents will receive automatic wins (walkover)</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>
                </div>

                <p style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>
                  Only use this for players who confirmed they cannot attend. 
                  If many players are no-shows, consider restarting the tournament.
                </p>
              </>
            )}
          </div>

          <div className="modal-actions">
            <button 
              className="btn btn-outline"
              onClick={onClose}
              disabled={isRemoving}
            >
              Cancel
            </button>
            {!result && (
              <button 
                className="btn btn-danger"
                onClick={onConfirm}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <>
                    <span className="loading-spinner"></span>
                    Removing...
                  </>
                ) : (
                  <>
                    <UserMinus className="w-5 h-5" />
                    Confirm Removal
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
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
            padding: var(--spacing-lg);
          }

          .removal-modal {
            background: var(--white);
            border-radius: var(--radius-lg);
            padding: var(--spacing-2xl);
            max-width: 500px;
            width: 100%;
            box-shadow: var(--shadow-xl);
          }

          .modal-header {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
          }

          .modal-header svg {
            width: 32px;
            height: 32px;
            color: var(--warning);
          }

          .modal-header h2 {
            margin: 0;
            color: var(--secondary);
          }

          .modal-body {
            margin-bottom: var(--spacing-xl);
          }

          .player-removal-info {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            padding: var(--spacing-md);
            background: var(--light-gray);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-md);
          }

          .player-removal-info svg {
            width: 24px;
            height: 24px;
            color: var(--danger);
          }

          .player-details strong {
            display: block;
            color: var(--secondary);
            margin-bottom: var(--spacing-xs);
          }

          .player-details span {
            color: var(--gray);
            font-size: 0.9rem;
          }

          .modal-warning {
            display: flex;
            gap: var(--spacing-sm);
            padding: var(--spacing-md);
            background: rgba(255, 152, 0, 0.1);
            border: 1px solid var(--warning);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-md);
          }

          .modal-warning svg {
            width: 20px;
            height: 20px;
            color: var(--warning);
            flex-shrink: 0;
            margin-top: 2px;
          }

          .modal-warning p {
            margin: 0;
            color: var(--gray);
            font-size: 0.9rem;
          }

          .modal-actions {
            display: flex;
            gap: var(--spacing-md);
            justify-content: flex-end;
          }

          .modal-actions .btn {
            min-width: 120px;
          }

          .removal-result {
            padding: var(--spacing-md);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-lg);
          }

          .removal-result.success {
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid var(--success);
            color: var(--success);
          }

          .removal-result.error {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid var(--danger);
            color: var(--danger);
          }

          .removal-result strong {
            display: block;
            margin-bottom: var(--spacing-xs);
          }
          
          .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          @media (max-width: 768px) {
            .modal-actions {
              flex-direction: column-reverse;
            }
            .modal-actions .btn {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
};

export default PlayerRemovalModal;
