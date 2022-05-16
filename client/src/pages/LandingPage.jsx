import React from 'react';
import GasStationList from '../components/GasStationList.jsx';
import Header from '../components/Header.jsx';
import stations from '../data/db.js';
import GeoButton from '../components/GeoButton'
import { MdGpsFixed } from 'react-icons/md';

function LandingPage({ gasInfoHead, title, toggleFavorite, favoriteIDs, fuelValue, fetchStations }) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <GeoButton buttonTitle={<MdGpsFixed />} myFunction={()=>{fetchStations()}} />
      <GasStationList
        stations={stations}
        toggleFavorite={toggleFavorite}
        favoriteIDs={favoriteIDs}
        fuelValue={fuelValue}
      />
    </>
  );
}
export default LandingPage;
