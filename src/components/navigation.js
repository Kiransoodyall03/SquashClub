import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home, 
  Trophy, 
  User, 
  LogOut, 
  Menu,
  X,
  BarChart3,
  Swords,
  Users,
  Shield
} from 'lucide-react';
import { logout } from '../firebase/auth';

const Navigation = ({ user, userProfile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate('/');
    }
  };

  const isOwner = userProfile?.role === 'owner';

  // Base nav items for all users
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
    { path: '/tournaments', label: 'Tournaments', icon: <Trophy className="w-5 h-5" /> },
    { path: '/matches', label: 'Matches', icon: <Swords className="w-5 h-5" /> },
    { path: '/leaderboard', label: 'Leaderboard', icon: <BarChart3 className="w-5 h-5" /> },
    { path: '/profile', label: 'Profile', icon: <User className="w-5 h-5" /> }
  ];

  // Add Members link for owners only
  if (isOwner) {
    navItems.splice(4, 0, { 
      path: '/members', 
      label: 'Members', 
      icon: <Users className="w-5 h-5" />,
      ownerOnly: true
    });
  }

  return (
    <nav className="navigation">
      <div className="container">
        <div className="nav-content">
          <Link to="/dashboard" className="nav-brand">
            <Trophy className="w-6 h-6" />
            <span>Squash Club</span>
          </Link>

          <div className="nav-menu desktop-menu">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''} ${item.ownerOnly ? 'owner-link' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.ownerOnly && <Shield className="w-3 h-3 owner-badge" />}
              </Link>
            ))}
          </div>

          <div className="nav-actions">
            <div className="user-info">
              <span className="user-name">
                {userProfile?.firstName}
                {isOwner && <span className="role-tag">Owner</span>}
              </span>
              <span className="user-elo">ELO: {userProfile?.elo || 1200}</span>
            </div>
            <button onClick={handleLogout} className="btn btn-ghost btn-small">
              <LogOut className="w-4 h-4" />
              <span className="desktop-only">Logout</span>
            </button>
            
            <button 
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div 
          className="mobile-menu"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''} ${item.ownerOnly ? 'owner-link' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.ownerOnly && <Shield className="w-3 h-3 owner-badge" />}
            </Link>
          ))}
        </motion.div>
      )}

      <style>{`
        .navigation {
          background: var(--white);
          box-shadow: var(--shadow-sm);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 70px;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          text-decoration: none;
          color: var(--secondary);
          font-family: var(--font-display);
          font-size: 1.5rem;
          letter-spacing: 0.02em;
        }

        .nav-menu {
          display: flex;
          gap: var(--spacing-xs);
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-sm) var(--spacing-md);
          color: var(--dark-gray);
          text-decoration: none;
          border-radius: var(--radius-md);
          transition: all var(--transition-base);
          font-size: 0.9rem;
          position: relative;
        }

        .nav-link:hover {
          background: var(--light-gray);
          color: var(--primary);
        }

        .nav-link.active {
          background: var(--gradient-primary);
          color: var(--white);
        }

        .nav-link.owner-link {
          border: 1px solid transparent;
        }

        .nav-link.owner-link:not(.active) {
          border-color: rgba(255, 107, 53, 0.3);
          background: rgba(255, 107, 53, 0.05);
        }

        .owner-badge {
          margin-left: 2px;
          opacity: 0.7;
        }

        .nav-link.active .owner-badge {
          opacity: 1;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          margin-right: var(--spacing-md);
        }

        .user-name {
          font-weight: 600;
          color: var(--secondary);
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .role-tag {
          font-size: 0.625rem;
          padding: 2px 6px;
          background: var(--gradient-primary);
          color: var(--white);
          border-radius: var(--radius-sm);
          font-weight: 600;
          text-transform: uppercase;
        }

        .user-elo {
          font-size: 0.75rem;
          color: var(--primary);
          font-weight: 600;
        }

        .mobile-menu-toggle {
          display: none;
          background: transparent;
          border: none;
          color: var(--secondary);
          cursor: pointer;
        }

        .mobile-menu {
          position: absolute;
          top: 70px;
          left: 0;
          right: 0;
          background: var(--white);
          box-shadow: var(--shadow-md);
          padding: var(--spacing-md);
        }

        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          color: var(--dark-gray);
          text-decoration: none;
          border-radius: var(--radius-md);
          transition: all var(--transition-base);
        }

        .mobile-nav-link:hover {
          background: var(--light-gray);
        }

        .mobile-nav-link.active {
          background: var(--gradient-primary);
          color: var(--white);
        }

        .mobile-nav-link.owner-link:not(.active) {
          background: rgba(255, 107, 53, 0.05);
          border-left: 3px solid var(--primary);
        }

        @media (max-width: 900px) {
          .nav-link span {
            display: none;
          }
          
          .nav-link {
            padding: var(--spacing-sm);
          }

          .owner-badge {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .desktop-menu {
            display: none;
          }

          .desktop-only {
            display: none;
          }

          .mobile-menu-toggle {
            display: block;
          }

          .user-info {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
};

export default Navigation;