// src/components/TournamentDeleteModal.js
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Trash2, Check } from 'lucide-react';

const TournamentDeleteModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  tournamentName,
  matchCount,
  participantCount,
  isDeleting,
  result 
}) => {
  const [confirmText, setConfirmText] = useState('');
  const requiredText = 'DELETE';
  
  const isConfirmValid = confirmText === requiredText;

  const handleConfirm = () => {
    if (isConfirmValid && !isDeleting) {
      onConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 9999
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #fee2e2',
            background: 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                flex: 1
              }}>
                <div style={{
                  padding: '8px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertTriangle style={{ color: '#dc2626', width: '24px', height: '24px' }} />
                </div>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#991b1b'
                  }}>Delete Tournament</h2>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.875rem',
                    color: '#7f1d1d'
                  }}>This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isDeleting}
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '24px' }}>
            {!result ? (
              <>
                {/* Warning Message */}
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    color: '#7f1d1d',
                    lineHeight: '1.5'
                  }}>
                    You are about to permanently delete <strong>"{tournamentName}"</strong>. 
                    This will remove all tournament data and cannot be recovered.
                  </p>
                </div>

                {/* What Will Be Deleted */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#374151'
                  }}>What will be deleted:</h3>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px'
                    }}>
                      <Trash2 style={{ width: '16px', height: '16px', color: '#dc2626' }} />
                      <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                        Tournament details and settings
                      </span>
                    </div>
                    
                    {matchCount > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px'
                      }}>
                        <Trash2 style={{ width: '16px', height: '16px', color: '#dc2626' }} />
                        <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                          <strong>{matchCount}</strong> match{matchCount !== 1 ? 'es' : ''} and all scores
                        </span>
                      </div>
                    )}
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px'
                    }}>
                      <Trash2 style={{ width: '16px', height: '16px', color: '#dc2626' }} />
                      <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                        Participant registration data ({participantCount} player{participantCount !== 1 ? 's' : ''})
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px'
                    }}>
                      <Trash2 style={{ width: '16px', height: '16px', color: '#dc2626' }} />
                      <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                        Tournament groups and standings
                      </span>
                    </div>
                  </div>
                </div>

                {/* Important Note */}
                <div style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '20px'
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: '#78350f',
                    lineHeight: '1.4'
                  }}>
                    <strong>Note:</strong> Player ELO ratings will NOT be affected. 
                    This only removes the tournament record itself.
                  </p>
                </div>

                {/* Confirmation Input */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Type <strong style={{ color: '#dc2626' }}>{requiredText}</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE here"
                    disabled={isDeleting}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '0.875rem',
                      border: `2px solid ${isConfirmValid ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      backgroundColor: isDeleting ? '#f9fafb' : 'white'
                    }}
                    onFocus={(e) => !isConfirmValid && (e.target.style.borderColor = '#9ca3af')}
                    onBlur={(e) => !isConfirmValid && (e.target.style.borderColor = '#d1d5db')}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      color: '#374151',
                      backgroundColor: 'white',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      opacity: isDeleting ? 0.5 : 1
                    }}
                    onMouseOver={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = '#f9fafb')}
                    onMouseOut={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = 'white')}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!isConfirmValid || isDeleting}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      backgroundColor: isConfirmValid && !isDeleting ? '#dc2626' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: isConfirmValid && !isDeleting ? 'pointer' : 'not-allowed',
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => {
                      if (isConfirmValid && !isDeleting) {
                        e.currentTarget.style.backgroundColor = '#b91c1c';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (isConfirmValid && !isDeleting) {
                        e.currentTarget.style.backgroundColor = '#dc2626';
                      }
                    }}
                  >
                    <Trash2 style={{ width: '16px', height: '16px' }} />
                    {isDeleting ? 'Deleting...' : 'Delete Tournament'}
                  </button>
                </div>
              </>
            ) : (
              /* Success/Error Result */
              <div>
                {result.success ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px'
                  }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      margin: '0 auto 16px',
                      backgroundColor: '#dcfce7',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Check style={{ width: '32px', height: '32px', color: '#16a34a' }} />
                    </div>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: '#166534'
                    }}>Tournament Deleted</h3>
                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      color: '#4b5563'
                    }}>
                      {result.deletedMatches > 0 
                        ? `Successfully deleted the tournament and ${result.deletedMatches} match${result.deletedMatches !== 1 ? 'es' : ''}.`
                        : 'Tournament has been successfully deleted.'
                      }
                    </p>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <AlertTriangle style={{ width: '20px', height: '20px', color: '#dc2626', flexShrink: 0 }} />
                      <div>
                        <h4 style={{
                          margin: '0 0 4px 0',
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#991b1b'
                        }}>Deletion Failed</h4>
                        <p style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          color: '#7f1d1d'
                        }}>{result.error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TournamentDeleteModal;