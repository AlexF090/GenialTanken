import React from 'react';
import Header from '../components/Header.jsx';
import Settings from '../components/Settings.jsx';

function SettingsPage({ gasInfoHead, title, fuelValue, setFuelValue, radius, setRadius }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Settings
        radius={radius}
        setRadius={setRadius}
        fuelValue={fuelValue}
        setFuelValue={setFuelValue}
      />
    </>
  );
}

export default SettingsPage;
