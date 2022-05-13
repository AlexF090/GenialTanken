import React from 'react';
import { useParams } from 'react-router-dom';
import GasStationDetail from '../components/GasStationDetail.jsx';
import Header from '../components/Header.jsx';
import stations from '../data/db.js';
import DetailMap from '../components/map/DetailMap.jsx';

function DetailedGasStationPage({ title, fuelValue, toggleFavorite, favoriteIDs }) {
  const { id } = useParams();
  const currentStation = stations.find(station => station.id === id);

  return (
    <>
      <Header title={title} fuelValue={fuelValue} />
      {/* <DetailMap currentStation={currentStation} /> */}
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
