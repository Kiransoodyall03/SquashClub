import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Calendar, TrendingUp, ArrowRight, Star } from 'lucide-react';
import './Landing.css';
const Landing = () => {
  const features = [
    {
      icon: <Trophy className="w-8 h-8" />,
      title: "Smart Tournaments",
      description: "Automatically generate balanced groups based on ELO ratings for fair competition"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "ELO Rating System",
      description: "Track your progress with a chess-style rating system that adjusts after every match"
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Easy Scheduling",
      description: "Quick tournament setup and WhatsApp invitations for Wednesday socials"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "All Ages Welcome",
      description: "Simple, intuitive interface designed for players aged 16 to 75"
    }
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section court-pattern">
        <div className="container">
          <motion.div 
            className="hero-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="hero-title">
              SQUASH CLUB TOURNAMENT MANAGER
            </h1>
            <p className="hero-subtitle">
              Transform your Wednesday socials with smart ELO-based matchmaking
            </p>
            <div className="hero-buttons">
              <Link to="/register" className="btn btn-primary btn-large">
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="btn btn-outline btn-large">
                Sign In
              </Link>
            </div>
          </motion.div>
          
          <motion.div 
            className="hero-image"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="court-visual">
              <div className="court-lines">
                <div className="service-box"></div>
                <div className="front-wall"></div>
                <div className="tin"></div>
              </div>
              <div className="elo-display">
                <span className="elo-badge">ELO 1450</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2>Everything Your Club Needs</h2>
            <p>Streamline tournament management and enhance player experience</p>
          </motion.div>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                className="feature-card card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="feature-icon">
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2>How It Works</h2>
            <p>Get your tournament up and running in minutes</p>
          </motion.div>
          
          <div className="steps-container">
            <motion.div 
              className="step"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="step-number">1</div>
              <h3>Create Tournament</h3>
              <p>Set up your Wednesday tournament with custom scoring formats</p>
            </motion.div>
            
            <motion.div 
              className="step"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="step-number">2</div>
              <h3>Invite Players</h3>
              <p>Send WhatsApp and email invitations with one click</p>
            </motion.div>
            
            <motion.div 
              className="step"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="step-number">3</div>
              <h3>Play & Track</h3>
              <p>Players log scores and ELO ratings update automatically</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <motion.div 
          className="container"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="cta-content">
            <h2>Ready to Elevate Your Club?</h2>
            <p>Join clubs using smart tournament management</p>
            <Link to="/register" className="btn btn-primary btn-large">
              Start Free Today
              <Star className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default Landing;
