import React from 'react';
import Header from '../components/Header.jsx';
import styled from 'styled-components';
import stations from '../data/db.js';
import GasStation from '../components/GasStation.jsx';

export default function Favorites({ title, favoriteIDs, toggleFavorite }) {
  console.log(title, favoriteIDs);
  return (
    <>
      <Header title={title} />
      {favoriteIDs.length > 0 ? (
        <GasStation
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
