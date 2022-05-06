import React from 'react';
import Header from '../components/Header.jsx';
import Settings from '../components/Settings.jsx';

function SettingsPage({ gasInfoHead, title, fuelValue, setFuelValue }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Settings fuelValue={fuelValue} setFuelValue={setFuelValue} />
    </>
  );
}

export default SettingsPage;
