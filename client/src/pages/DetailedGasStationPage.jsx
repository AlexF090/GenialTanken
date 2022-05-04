import React from 'react';
import { useParams } from 'react-router-dom';
import GasStationDetail from '../components/GasStationDetail.jsx';
import Header from '../components/Header.jsx';
import stations from '../data/db';

function DetailedGasStationPage({ title, toggleFavorite, favoriteIDs }) {
  const { id: uuid } = useParams();
  const currentStation = stations.find(station => station.uuid === uuid);

  return (
    <>
      <Header title={title} />
      {currentStation ? (
        <GasStationDetail
          currentStation={currentStation}
          stations={stations}
          toggleFavorite={toggleFavorite}
          favoriteIDs={favoriteIDs}
        />
      ) : (
        <h2>This gas station does not exist </h2>
      )}
    </>
  );
}

export default DetailedGasStationPage;
