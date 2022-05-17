import React from 'react';
import Header from '../components/Header.jsx';
import Map from '../components/map/Map.jsx';

function MapPage({ title, gasInfoHead, stations, fuelValue }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Map stations={stations} fuelValue={fuelValue} />
    </>
  );
}

export default MapPage;
