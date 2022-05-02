import React from 'react';
import Header from '../components/Header.jsx';
import GasStationList from '../components/GasStationList.jsx';
import stations from '../data/db.js';

function Favorites({ title, favoriteIDs, toggleFavorite }) {
  return (
    <>
      <Header title={title} />
      {favoriteIDs.length > 0 ? (
        <GasStationList
          favoriteIDs={favoriteIDs}
          toggleFavorite={toggleFavorite}
          stations={stations.filter(station => favoriteIDs.includes(station.uuid))}
        />
      ) : (
        ''
      )}
    </>
  );
}

export default Favorites;
