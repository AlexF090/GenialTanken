import React from 'react';
import Header from '../components/Header/Header.jsx';
import Settings from '../components/Settings/Settings.jsx';

function SettingsPage({
  title,
  gasInfoHead,
  fuelValue,
  setFuelValue,
  getCurrentPosition,
  radius,
  setRadius,
}) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Settings
        fuelValue={fuelValue}
        setFuelValue={setFuelValue}
        getCurrentPosition={getCurrentPosition}
        radius={radius}
        setRadius={setRadius}
      />
    </>
  );
}

export default SettingsPage;
