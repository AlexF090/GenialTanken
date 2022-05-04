import React from 'react';

const OpeningTimes = ({ currentStation }) => {
  const isOpen = currentStation.isOpen;

  return <>{isOpen ? 'Die Tankstelle ist geöffnet' : 'Die Tankstelle hat leider gesschlossen'}</>;
};

export default OpeningTimes;
