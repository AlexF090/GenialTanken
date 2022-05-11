import React from 'react';
import stations from '../data/db.js';
import Header from '../components/Header.jsx';
import Map from '../components/map/Map.jsx';

function MapPage({ gasInfoHead, title, fuelValue }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Map stations={stations} fuelValue={fuelValue} />
    </>
  );
}

export default MapPage;
