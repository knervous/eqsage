import * as React from 'react';
import './Loading.css';

const LoadingSpinner = () => {
  return (
    <div className="spinner-container"> 
      <p>Initializing Runtime...</p>
      <div className="spinner"></div>
    </div>
  );
};

export default LoadingSpinner;