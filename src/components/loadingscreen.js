import React from 'react';
import { motion } from 'framer-motion';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <motion.div 
        className="loading-content"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="loading-spinner"></div>
        <h3>Loading...</h3>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
