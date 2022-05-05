import React from 'react';
import Header from '../components/Header.jsx';
import Settings from '../components/Settings.jsx';

function SettingsPage({ title, fuelValue, setFuelValue }) {
  return (
    <>
      <Header title={title} />
      <Settings fuelValue={fuelValue} setFuelValue={setFuelValue} />
    </>
  );
}

export default SettingsPage;
