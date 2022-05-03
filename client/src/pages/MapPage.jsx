import React from 'react';
import Header from '../components/Header.jsx';
import GasStationDetail from '../components/GasStationDetail.jsx';

function MapPage({ title }) {
  return (
    <>
      <Header title={title} />
      <GasStationDetail />
    </>
  );
}

export default MapPage;
