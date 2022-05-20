import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import NavBar from './components/NavBar/NavBar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import MapPage from '../src/pages/MapPage.jsx';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import FavoritePage from '../src/pages/FavoritePage.jsx';
import DetailedGasStationPage from '../src/pages/DetailedGasStationPage.jsx';

const stationsApiKey = process.env.REACT_APP_STATIONS_API_KEY;

function App() {
  const [stations, setStations] = useState([]);
  const [radius, setRadius] = useState(5);
  const [apiRadius, setApiRadius] = useState(5000);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [position, setPosition] = useState(null);
  const [fuelValue, setFuelValue] = useState('e5');
  const [favoriteIDs, setFavoriteIDs] = useState(
    () => JSON.parse(localStorage.getItem('favoriteIDs')) ?? []
  );

  const url = `https://api.tankentanken.de/gas-stations?latitude=${latitude}&longitude=${longitude}&radius=${apiRadius}`;
  const fuelInfo = fuelValue.charAt(0).toUpperCase() + fuelValue.slice(1);

  function calculateRadius(radius) {
    const calculate = radius * 1000;
    setApiRadius(calculate);
  }

  useEffect(() => {
    calculateRadius(radius);
  }, [radius]);

  function toggleFavorite(id) {
    if (favoriteIDs.includes(id)) {
      const updatedFavoriteIDs = favoriteIDs.filter(favID => favID !== id);
      setFavoriteIDs(updatedFavoriteIDs);
    } else {
      setFavoriteIDs([...favoriteIDs, id]);
    }
  }

  function fetchStations() {
    fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stationsApiKey}`,
      },
    })
      .then(response => response.json())
      .then(json =>
        json.filter(item => {
          return item.fuelPrices[fuelValue];
        })
      )
      .then(json => setStations(json));
  }

  useEffect(() => {
    if (latitude && longitude !== null) {
      fetchStations();
    }
  }, [latitude, longitude]);

  function getCurrentPosition() {
    navigator.geolocation.getCurrentPosition(position => {
      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
      setPosition([position.coords.latitude, position.coords.longitude]);
    });
  }

  useEffect(() => {
    if (position === null) {
      getCurrentPosition();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('favoriteIDs', JSON.stringify(favoriteIDs));
  }, [favoriteIDs]);

  return (
    <Wrapper>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              title="GenialTanken"
              gasInfoHead={fuelInfo}
              stations={stations}
              fuelValue={fuelValue}
              toggleFavorite={toggleFavorite}
              favoriteIDs={favoriteIDs}
              getCurrentPosition={getCurrentPosition}
            />
          }
        />
        <Route
          path="map"
          element={
            <MapPage
              title="Karte"
              gasInfoHead={fuelInfo}
              stations={stations}
              fuelValue={fuelValue}
              getCurrentPosition={getCurrentPosition}
              position={position}
              setPosition={setPosition}
              latitude={latitude}
              longitude={longitude}
            />
          }
        />
        <Route
          path="settings"
          element={
            <SettingsPage
              title="Einstellungen"
              gasInfoHead={fuelInfo}
              fuelValue={fuelValue}
              setFuelValue={setFuelValue}
              getCurrentPosition={getCurrentPosition}
              radius={radius}
              setRadius={setRadius}
            />
          }
        />
        <Route
          path="favorites"
          element={
            <FavoritePage
              toggleFavorite={toggleFavorite}
              favoriteIDs={favoriteIDs}
              fuelValue={fuelValue}
              gasInfoHead={fuelInfo}
              title="Favoriten"
            />
          }
        />
        <Route
          path=":id"
          element={
            <DetailedGasStationPage
              title="Details"
              toggleFavorite={toggleFavorite}
              favoriteIDs={favoriteIDs}
              fuelValue={fuelValue}
              gasInfoHead={fuelInfo}
            />
          }
        />
      </Routes>
      <NavBar />
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
  margin-top: 7rem;
`;

export default App;
