import React from 'react';
import GasStation from '../components/GasStation.jsx';
import Header from '../components/Header.jsx';
import stations from '../data/db';

function LandingPage({ title, toggleFavorite, favoriteIDs }) {
  return (
    <>
      <Header title={title} />
      <GasStation  stations={stations} toggleFavorite={toggleFavorite} favoriteIDs={favoriteIDs} />
    </>
  );
}
export default LandingPage;
