import React from 'react';
import GasStationList from '../components/GasStationList.jsx';
import Header from '../components/Header.jsx';
import stations from '../data/db.js';

function LandingPage({ gasInfoHead, title, toggleFavorite, favoriteIDs, fuelValue }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <GasStationList
        stations={stations}
        toggleFavorite={toggleFavorite}
        favoriteIDs={favoriteIDs}
        fuelValue={fuelValue}
      />
    </>
  );
}
export default LandingPage;
