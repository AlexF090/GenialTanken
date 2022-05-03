import React from 'react';
import GasStationList from '../components/GasStationList.jsx';
import Header from '../components/Header.jsx';
import stations from '../data/db';

function LandingPage({ title, toggleFavorite, favoriteIDs }) {
  return (
    <>
      <Header title={title} />
      <GasStationList
        stations={stations}
        toggleFavorite={toggleFavorite}
        favoriteIDs={favoriteIDs}
      />
    </>
  );
}
export default LandingPage;
