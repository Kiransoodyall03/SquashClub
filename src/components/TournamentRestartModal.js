// src/components/TournamentRestartModal.js

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const TournamentRestartModal = ({ isOpen, onClose, onConfirm, isRestarting, result, recommendation }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={() => !isRestarting && onClose()}>
        <motion.div 
          className="restart-modal"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <RotateCcw />
            <h2>Restart Tournament</h2>
          </div>

          <div className="modal-body">
            {result ? (
              <div className={`restart-result ${result.success ? 'success' : 'error'}`}>
                <div className="restart-result-header">
                  {result.success ? (
                    <>
                      <CheckCircle />
                      <h3>Tournament Restarted!</h3>
                    </>
                  ) : (
                    <>
                      <XCircle />
                      <h3>Restart Failed</h3>
                    </>
                  )}
                </div>

                {result.success ? (
                  <>
                    <p style={{ marginBottom: '16px', color: 'var(--gray)' }}>
                      {result.message}
                    </p>
                    <div className="restart-result-stats">
                      <div className="result-stat">
                        <span className="result-stat-value">{result.deletedMatches}</span>
                        <span className="result-stat-label">Matches Deleted</span>
                      </div>
                      <div className="result-stat">
                        <span className="result-stat-value">{result.activeParticipants}</span>
                        <span className="result-stat-label">Active Players</span>
                      </div>
                      <div className="result-stat">
                        <span className="result-stat-value">{result.removedPlayers}</span>
                        <span className="result-stat-label">Removed No-Shows</span>
                      </div>
                      <div className="result-stat">
                        <span className="result-stat-value">{result.newMatches || 0}</span>
                        <span className="result-stat-label">New Matches</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--danger)' }}>{result.error}</p>
                )}
              </div>
            ) : (
              <>
                {recommendation && (
                  <>
                    <div className="restart-stats">
                      <div className="stat-card">
                        <span className="stat-value">{recommendation.stats.totalParticipants}</span>
                        <span className="stat-label">Total Players</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-value danger">{recommendation.stats.noShowCount}</span>
                        <span className="stat-label">No-Shows</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-value">{recommendation.stats.activeCount}</span>
                        <span className="stat-label">Active Players</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-value danger">{recommendation.stats.noShowPercentage}%</span>
                        <span className="stat-label">No-Show Rate</span>
                      </div>
                    </div>

                    <div className={`restart-recommendation ${recommendation.shouldRestart ? 'warning' : ''}`}>
                      <strong>
                        {recommendation.shouldRestart ? '⚠️ Restart Recommended' : 'ℹ️ Status Check'}
                      </strong>
                      <p>{recommendation.recommendation}</p>
                    </div>
                  </>
                )}

                <div className="modal-warning">
                  <AlertTriangle />
                  <div>
                    <p>
                      <strong>Restarting will:</strong>
                    </p>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      <li>Delete all existing matches</li>
                      <li>Remove all no-show players permanently</li>
                      <li>Reset tournament to "not started" status</li>
                      <li>Recreate matches with only active players</li>
                      <li>This cannot be undone</li>
                    </ul>
                  </div>
                </div>

                <p style={{ color: 'var(--gray)', fontSize: '0.9rem', marginTop: '12px' }}>
                  Only restart if the tournament cannot continue fairly with current no-shows. 
                  After restart, you'll need to manually start the tournament again and generate new matches.
                </p>
              </>
            )}
          </div>

          <div className="modal-actions">
            <button 
              className="btn btn-outline"
              onClick={onClose}
              disabled={isRestarting}
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button 
                className="btn btn-danger"
                onClick={onConfirm}
                disabled={isRestarting}
              >
                {isRestarting ? (
                  <>
                    <span className="loading-spinner"></span>
                    Restarting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-5 h-5" />
                    Confirm Restart
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

          .restart-modal {
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

          .restart-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
          }

          .stat-card {
            padding: var(--spacing-md);
            background: var(--light-gray);
            border-radius: var(--radius-md);
            text-align: center;
          }

          .stat-value {
            display: block;
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: var(--spacing-xs);
          }

          .stat-value.danger {
            color: var(--danger);
          }

          .stat-label {
            display: block;
            font-size: 0.85rem;
            color: var(--gray);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .restart-recommendation {
            padding: var(--spacing-md);
            background: rgba(33, 150, 243, 0.1);
            border: 1px solid var(--info);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-lg);
          }

          .restart-recommendation.warning {
            background: rgba(255, 152, 0, 0.1);
            border-color: var(--warning);
          }

          .restart-recommendation strong {
            display: block;
            color: var(--secondary);
            margin-bottom: var(--spacing-xs);
          }

          .restart-recommendation p {
            margin: 0;
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

          .restart-result {
            padding: var(--spacing-lg);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-lg);
          }

          .restart-result.success {
            background: rgba(76, 175, 80, 0.1);
            border: 2px solid var(--success);
          }

          .restart-result.error {
            background: rgba(244, 67, 54, 0.1);
            border: 2px solid var(--danger);
          }

          .restart-result-header {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-md);
          }

          .restart-result-header svg {
            width: 32px;
            height: 32px;
          }

          .restart-result.success .restart-result-header svg {
            color: var(--success);
          }

          .restart-result.error .restart-result-header svg {
            color: var(--danger);
          }

          .restart-result-header h3 {
            margin: 0;
            color: var(--secondary);
          }

          .restart-result-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--spacing-sm);
          }

          .result-stat {
            padding: var(--spacing-sm);
            background: var(--white);
            border-radius: var(--radius-sm);
            text-align: center;
          }

          .result-stat-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--primary);
          }

          .result-stat-label {
            display: block;
            font-size: 0.75rem;
            color: var(--gray);
            margin-top: var(--spacing-xs);
          }

          .modal-actions {
            display: flex;
            gap: var(--spacing-md);
            justify-content: flex-end;
          }

          .modal-actions .btn {
            min-width: 120px;
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
            .restart-stats {
              grid-template-columns: 1fr;
            }
            
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

export default TournamentRestartModal;
