import React from 'react';
import styled from 'styled-components';
import Header from '../components/Header.jsx';
import GasStationList from '../components/GasStationList.jsx';
import stations from '../data/db.js';

function Favorites({ gasInfoHead, title, fuelValue, favoriteIDs, toggleFavorite }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      {favoriteIDs.length > 0 ? (
        <GasStationList
          favoriteIDs={favoriteIDs}
          toggleFavorite={toggleFavorite}
          fuelValue={fuelValue}
          stations={stations.filter(station => favoriteIDs.includes(station.id))}
        />
      ) : (
        <Empty>Keine Favoriten gespeichert</Empty>
      )}
    </>
  );
}

const Empty = styled.h3`
  margin-top: 10rem;
  text-align: center;
`;

export default Favorites;
