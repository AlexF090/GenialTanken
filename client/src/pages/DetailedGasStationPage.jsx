import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GasStationDetail from '../components/GasStationDetail.jsx';
import Header from '../components/Header.jsx';

const stationsApiKey = process.env.REACT_APP_STATIONS_API_KEY;

function DetailedGasStationPage({ title, fuelValue, toggleFavorite, favoriteIDs }) {
  const { id } = useParams();
  const [currentStation, setCurrentStation] = useState();
  const url = 'https://api.tankentanken.de/gas-stations/' + id;

  function fetchStation() {
    fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stationsApiKey}`,
      },
    })
    
      .then(response => response.json())
      .then(json => setCurrentStation(json))
      .catch(error => {
        console.log('There has been a problem with your fetch operation:', error);
  })}

  useEffect(() => {
    fetchStation();
  }, []);

  return (
    <>
      <Header title={title} fuelValue={fuelValue} />
      {currentStation ? (
        <GasStationDetail
          currentStation={currentStation}
          toggleFavorite={toggleFavorite}
          favoriteIDs={favoriteIDs}
        />
      ) : (
        ''
      )}
    </>
  );
}

export default DetailedGasStationPage;
