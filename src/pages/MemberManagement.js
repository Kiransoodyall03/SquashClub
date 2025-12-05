// src/pages/MemberManagement.js

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  UserX, 
  UserCheck,
  Shield,
  AlertTriangle,
  X,
  ChevronDown,
  Trophy,
  TrendingUp,
  Calendar,
  MoreVertical,
  Ban,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { 
  getAllUsers, 
  disableUser, 
  enableUser, 
  removeUserFromClub,
  getUserProfile
} from '../firebase/firestore';
import { auth } from '../firebase/config';

const MemberManagement = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, disabled
  const [filterRole, setFilterRole] = useState('all'); // all, player, owner
  const [sortBy, setSortBy] = useState('name'); // name, elo, matches, joined
  const [selectedMember, setSelectedMember] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const users = await getAllUsers();
      setMembers(users);
    } catch (error) {
      console.error('Error loading members:', error);
    }
    setLoading(false);
  };

  // Filter and sort members
  const filteredMembers = members
    .filter(member => {
      // Search filter
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      const email = (member.email || '').toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                           email.includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && !member.disabled) ||
        (filterStatus === 'disabled' && member.disabled);
      
      // Role filter
      const matchesRole = filterRole === 'all' || member.role === filterRole;
      
      return matchesSearch && matchesStatus && matchesRole;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case 'elo':
          return (b.elo || 1200) - (a.elo || 1200);
        case 'matches':
          return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
        case 'joined':
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        default:
          return 0;
      }
    });

  const handleDisableUser = (member) => {
    setSelectedMember(member);
    setConfirmAction('disable');
    setShowConfirmModal(true);
    setActionError('');
  };

  const handleEnableUser = (member) => {
    setSelectedMember(member);
    setConfirmAction('enable');
    setShowConfirmModal(true);
    setActionError('');
  };

  const handleRemoveUser = (member) => {
    setSelectedMember(member);
    setConfirmAction('remove');
    setShowConfirmModal(true);
    setActionError('');
  };

  const executeAction = async () => {
    if (!selectedMember || !confirmAction) return;
    
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    
    try {
      let result;
      
      switch (confirmAction) {
        case 'disable':
          result = await disableUser(selectedMember.id);
          if (result.success) {
            setActionSuccess(`${selectedMember.firstName} ${selectedMember.lastName} has been disabled`);
          }
          break;
        case 'enable':
          result = await enableUser(selectedMember.id);
          if (result.success) {
            setActionSuccess(`${selectedMember.firstName} ${selectedMember.lastName} has been enabled`);
          }
          break;
        case 'remove':
          result = await removeUserFromClub(selectedMember.id);
          if (result.success) {
            setActionSuccess(`${selectedMember.firstName} ${selectedMember.lastName} has been removed`);
          }
          break;
        default:
          break;
      }
      
      if (result && !result.success) {
        setActionError(result.error);
      } else {
        // Reload members after action
        await loadMembers();
        setShowConfirmModal(false);
        setSelectedMember(null);
        setConfirmAction(null);
        
        // Clear success message after 3 seconds
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (error) {
      setActionError(error.message);
    }
    
    setActionLoading(false);
  };

  const getActionDetails = () => {
    switch (confirmAction) {
      case 'disable':
        return {
          title: 'Disable Member',
          message: `Are you sure you want to disable ${selectedMember?.firstName} ${selectedMember?.lastName}? They will not be able to log in or participate in tournaments.`,
          buttonText: 'Disable Member',
          buttonClass: 'btn-warning',
          icon: <Ban className="w-6 h-6" />
        };
      case 'enable':
        return {
          title: 'Enable Member',
          message: `Re-enable ${selectedMember?.firstName} ${selectedMember?.lastName}? They will be able to log in and participate normally.`,
          buttonText: 'Enable Member',
          buttonClass: 'btn-success',
          icon: <UserCheck className="w-6 h-6" />
        };
      case 'remove':
        return {
          title: 'Remove Member',
          message: `Are you sure you want to permanently remove ${selectedMember?.firstName} ${selectedMember?.lastName}? This action cannot be undone and will delete all their data.`,
          buttonText: 'Remove Permanently',
          buttonClass: 'btn-danger',
          icon: <Trash2 className="w-6 h-6" />
        };
      default:
        return {};
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading members...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container member-management">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="page-header">
            <div>
              <h1>
                <Users className="w-8 h-8" />
                Member Management
              </h1>
              <p className="page-subtitle">
                Manage club members, disable accounts, or remove users
              </p>
            </div>
            <button 
              className="btn btn-outline"
              onClick={loadMembers}
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {/* Success Message */}
          {actionSuccess && (
            <motion.div 
              className="success-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <UserCheck className="w-5 h-5" />
              {actionSuccess}
            </motion.div>
          )}

          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Users className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{members.length}</span>
                <span className="stat-label">Total Members</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon active">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">
                  {members.filter(m => !m.disabled).length}
                </span>
                <span className="stat-label">Active Members</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon disabled">
                <UserX className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">
                  {members.filter(m => m.disabled).length}
                </span>
                <span className="stat-label">Disabled</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon owner">
                <Shield className="w-6 h-6" />
              </div>
              <div className="stat-content">
                <span className="stat-value">
                  {members.filter(m => m.role === 'owner').length}
                </span>
                <span className="stat-label">Owners</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section card">
            <div className="search-bar">
              <Search className="w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-controls">
              <div className="filter-group">
                <label>Status</label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Role</label>
                <select 
                  value={filterRole} 
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Roles</option>
                  <option value="player">Players</option>
                  <option value="owner">Owners</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Sort By</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="filter-select"
                >
                  <option value="name">Name</option>
                  <option value="elo">ELO Rating</option>
                  <option value="matches">Matches Played</option>
                  <option value="joined">Date Joined</option>
                </select>
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="members-table-container card">
            {filteredMembers.length === 0 ? (
              <div className="empty-state">
                <Users className="w-16 h-16 opacity-20" />
                <h3>No members found</h3>
                <p>Try adjusting your search or filters</p>
              </div>
            ) : (
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>ELO</th>
                    <th>Matches</th>
                    <th>Win Rate</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr 
                      key={member.id}
                      className={`
                        ${member.disabled ? 'disabled-row' : ''}
                        ${member.id === currentUserId ? 'current-user-row' : ''}
                      `}
                    >
                      <td className="member-cell">
                        <div className="member-info">
                          {member.photoURL ? (
                            <img 
                              src={member.photoURL} 
                              alt={member.firstName}
                              className="member-avatar"
                            />
                          ) : (
                            <div className="member-avatar-placeholder">
                              {member.firstName?.[0]}{member.lastName?.[0]}
                            </div>
                          )}
                          <div className="member-details">
                            <span className="member-name">
                              {member.firstName} {member.lastName}
                              {member.id === currentUserId && (
                                <span className="you-badge">You</span>
                              )}
                            </span>
                            <span className="member-email">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge role-${member.role}`}>
                          {member.role === 'owner' && <Shield className="w-3 h-3" />}
                          {member.role}
                        </span>
                      </td>
                      <td className="elo-cell">
                        <TrendingUp className="w-4 h-4" />
                        {member.elo || 1200}
                      </td>
                      <td>{member.matchesPlayed || 0}</td>
                      <td>
                        {member.matchesPlayed > 0 
                          ? `${Math.round((member.matchesWon / member.matchesPlayed) * 100)}%`
                          : '-'
                        }
                      </td>
                      <td className="date-cell">
                        {formatDate(member.createdAt)}
                      </td>
                      <td>
                        <span className={`status-badge status-${member.disabled ? 'disabled' : 'active'}`}>
                          {member.disabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {member.id !== currentUserId && (
                          <div className="action-buttons">
                            {member.disabled ? (
                              <button 
                                className="btn btn-small btn-success"
                                onClick={() => handleEnableUser(member)}
                                title="Enable user"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            ) : (
                              <button 
                                className="btn btn-small btn-warning"
                                onClick={() => handleDisableUser(member)}
                                title="Disable user"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              className="btn btn-small btn-danger"
                              onClick={() => handleRemoveUser(member)}
                              title="Remove user permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Results count */}
          <div className="results-count">
            Showing {filteredMembers.length} of {members.length} members
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && selectedMember && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div 
              className="modal-content confirm-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`modal-icon ${confirmAction}`}>
                {getActionDetails().icon}
              </div>
              
              <h2>{getActionDetails().title}</h2>
              <p>{getActionDetails().message}</p>
              
              {actionError && (
                <div className="modal-error">
                  <AlertTriangle className="w-5 h-5" />
                  {actionError}
                </div>
              )}
              
              <div className="modal-actions">
                <button 
                  className="btn btn-outline"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button 
                  className={`btn ${getActionDetails().buttonClass}`}
                  onClick={executeAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    getActionDetails().buttonText
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .member-management {
          min-height: calc(100vh - 70px);
          padding: var(--spacing-2xl) 0;
          background: var(--off-white);
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-xl);
        }

        .page-header h1 {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-xs);
        }

        .success-banner {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid var(--success);
          border-radius: var(--radius-md);
          color: var(--success);
          margin-bottom: var(--spacing-xl);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .stat-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          box-shadow: var(--shadow-sm);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          background: var(--light-gray);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray);
        }

        .stat-icon.active {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .stat-icon.disabled {
          background: rgba(244, 67, 54, 0.1);
          color: var(--danger);
        }

        .stat-icon.owner {
          background: rgba(255, 107, 53, 0.1);
          color: var(--primary);
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--secondary);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--gray);
        }

        .filters-section {
          padding: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--light-gray);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-md);
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 1rem;
        }

        .filter-controls {
          display: flex;
          gap: var(--spacing-lg);
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .filter-group label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--gray);
          text-transform: uppercase;
        }

        .filter-select {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--light-gray);
          border-radius: var(--radius-md);
          background: var(--white);
          min-width: 150px;
          cursor: pointer;
        }

        .members-table-container {
          overflow-x: auto;
        }

        .members-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        .members-table th {
          text-align: left;
          padding: var(--spacing-md);
          background: var(--light-gray);
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--gray);
        }

        .members-table td {
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--light-gray);
          vertical-align: middle;
        }

        .members-table tr:hover {
          background: var(--off-white);
        }

        .members-table tr.disabled-row {
          opacity: 0.6;
          background: rgba(244, 67, 54, 0.03);
        }

        .members-table tr.current-user-row {
          background: rgba(76, 175, 80, 0.05);
        }

        .member-cell {
          min-width: 250px;
        }

        .member-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .member-avatar {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          object-fit: cover;
        }

        .member-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          background: var(--gradient-primary);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .member-details {
          display: flex;
          flex-direction: column;
        }

        .member-name {
          font-weight: 600;
          color: var(--secondary);
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .you-badge {
          font-size: 0.625rem;
          padding: 2px 6px;
          background: var(--success);
          color: var(--white);
          border-radius: var(--radius-sm);
          font-weight: 600;
        }

        .member-email {
          font-size: 0.875rem;
          color: var(--gray);
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .role-player {
          background: rgba(33, 150, 243, 0.1);
          color: #2196F3;
        }

        .role-owner {
          background: rgba(255, 107, 53, 0.1);
          color: var(--primary);
        }

        .elo-cell {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-weight: 600;
          color: var(--primary);
        }

        .date-cell {
          color: var(--gray);
          font-size: 0.875rem;
        }

        .status-badge {
          display: inline-block;
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-active {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .status-disabled {
          background: rgba(244, 67, 54, 0.1);
          color: var(--danger);
        }

        .actions-cell {
          width: 120px;
        }

        .action-buttons {
          display: flex;
          gap: var(--spacing-xs);
        }

        .btn-small {
          padding: var(--spacing-xs) var(--spacing-sm);
          min-width: auto;
        }

        .btn-warning {
          background: #FF9800;
          color: var(--white);
        }

        .btn-warning:hover {
          background: #F57C00;
        }

        .btn-danger {
          background: var(--danger);
          color: var(--white);
        }

        .btn-danger:hover {
          background: #d32f2f;
        }

        .btn-success {
          background: var(--success);
          color: var(--white);
        }

        .btn-success:hover {
          background: #43a047;
        }

        .results-count {
          text-align: center;
          color: var(--gray);
          font-size: 0.875rem;
          margin-top: var(--spacing-md);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-2xl);
          text-align: center;
          color: var(--gray);
        }

        .empty-state h3 {
          margin: var(--spacing-md) 0 var(--spacing-xs);
          color: var(--secondary);
        }

        /* Modal Styles */
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
          padding: var(--spacing-xl);
        }

        .confirm-modal {
          background: var(--white);
          border-radius: var(--radius-lg);
          padding: var(--spacing-2xl);
          max-width: 450px;
          width: 100%;
          text-align: center;
        }

        .modal-icon {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--spacing-lg);
        }

        .modal-icon.disable {
          background: rgba(255, 152, 0, 0.1);
          color: #FF9800;
        }

        .modal-icon.enable {
          background: rgba(76, 175, 80, 0.1);
          color: var(--success);
        }

        .modal-icon.remove {
          background: rgba(244, 67, 54, 0.1);
          color: var(--danger);
        }

        .confirm-modal h2 {
          margin-bottom: var(--spacing-md);
        }

        .confirm-modal p {
          color: var(--gray);
          margin-bottom: var(--spacing-xl);
          line-height: 1.6;
        }

        .modal-error {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: rgba(244, 67, 54, 0.1);
          border-radius: var(--radius-md);
          color: var(--danger);
          margin-bottom: var(--spacing-lg);
        }

        .modal-actions {
          display: flex;
          gap: var(--spacing-md);
          justify-content: center;
        }

        .modal-actions .btn {
          min-width: 140px;
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

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: var(--spacing-md);
          color: var(--gray);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--light-gray);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            gap: var(--spacing-md);
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filter-controls {
            flex-direction: column;
          }

          .filter-group {
            width: 100%;
          }

          .filter-select {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default MemberManagement;