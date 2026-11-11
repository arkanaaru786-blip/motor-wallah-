import React from 'react';
import './PageLoader.css';
const PageLoader = () => {
  return (
    <div className="loader-overlay">
      <div className="orbit-container">
        {/* Center Logo */}
        <div className="center-logo">
          <img src="/images/MW-logo.png" alt="Motor Wallah" />
        </div>
        
        {/* Orbiting Vehicles */}
        <div className="orbit">
          <img src="/images/car.png" alt="Car" className="vehicle pos-1" />
          <img src="/images/bike.png" alt="Bike" className="vehicle pos-2" />
          <img src="/images/auto.png" alt="Auto" className="vehicle pos-3" />
          <img src="/images/scv.png" alt="SCV" className="vehicle pos-4" />
          <img src="/images/truck.png" alt="Truck" className="vehicle pos-5" />
          <img src="/images/bus.png" alt="Bus" className="vehicle pos-6" />
          <img src="/images/tractor.png" alt="Tractor" className="vehicle pos-7" />
          <img src="/images/taxi.png" alt="Taxi" className="vehicle pos-8" />
        </div>
      </div>
      <p className="loading-text">LOADING YOUR MARKETPLACE...</p>
      <button className="close-btn" onClick={() => window.location.href='/'}>CLOSE DEMO</button>
    </div>
  );
};
export default PageLoader;
