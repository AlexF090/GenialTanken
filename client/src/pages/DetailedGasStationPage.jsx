import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GasStationDetail from '../components/GasStationDetail.jsx';
import Header from '../components/Header.jsx';

const stationsApiKey = process.env.REACT_APP_STATIONS_API_KEY;

function DetailedGasStationPage({ title, fuelValue, toggleFavorite, favoriteIDs }) {
  const { id } = useParams();
  const [currentStation, setCurrentStation] = useState();
  const [error, setError] = useState();
  const url = 'https://api.tankentanken.de/gas-stations/' + id;

  function fetchStation() {
    fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stationsApiKey}`,
      },
    })
      .then(response => response.json())
      .then(json => {
        json.message
          ? setError('Die Tankstelle konnte in unserer Datenbank nicht gefunden werden')
          : setCurrentStation(json);
      })
      .catch(error => {
        setError('Die Tankstelle konnte in unserer Datenbank nicht gefunden werden');
      });
  }

  useEffect(() => {
    fetchStation();
  }, []);

  return (
    <>
      <Header title={title} fuelValue={fuelValue} />
      {error && <h3>{error}</h3>}
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
