import React from 'react';
import stations from '../data/db.js';
import Header from '../components/Header.jsx';
import Map from '../components/map/Map.jsx';

function MapPage({map, gasInfoHead, title, fuelValue, position, setPosition}) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Map position={position} setPosition={setPosition} stations={stations} fuelValue={fuelValue} />
    </>
  );
}

export default MapPage;
