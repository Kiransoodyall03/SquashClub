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
  TrendingUp,
  Ban,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { 
  getAllUsers, 
  disableUser, 
  enableUser, 
  removeUserFromClub,
} from '../../firebase/firestore';
import { auth } from '../../firebase/config';
import './MemberManagement.css';

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
    </div>
  );
};

export default MemberManagement;