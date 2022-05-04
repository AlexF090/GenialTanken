import React from 'react';
import styled from 'styled-components';
import Header from '../components/Header.jsx';
import GasStationList from '../components/GasStationList.jsx';
import stations from '../data/dbnew.js';

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
        <Empty>Keine Favoriten gespeichert</Empty>
      )}
    </>
  );
}

export default Favorites;

const Empty = styled.h2`
  margin-top: 10rem;
`;
