import React from 'react';
import Header from '../components/Header.jsx';

function MapPage({ gasInfoHead, title, fuelValue }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
    </>
  );
}

export default MapPage;
