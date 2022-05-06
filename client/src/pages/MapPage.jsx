import React from 'react';
import Header from '../components/Header.jsx';
import Map from '../components/Map.jsx';

function MapPage({ gasInfoHead, title, fuelValue }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Map />
    </>
  );
}

export default MapPage;
