import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import NavBar from './components/NavBar';
import LandingPage from './pages/LandingPage';
import MapPage from '../src/pages/MapPage';
import SettingsPage from '../src/pages/SettingsPage';
import FavoritePage from '../src/pages/FavoritePage';
import DetailedGasStationPage from '../src/pages/DetailedGasStationPage';

const stationsApiKey = process.env.REACT_APP_STATIONS_API_KEY;

function App() {
  const [stations, setStations] = useState([]);
  const [radius, setRadius] = useState(15);
  const [apiRadius, setApiRadius] = useState(15000);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [position, setPosition] = useState(null);
  const [fuelValue, setFuelValue] = useState('e5');
  const [favoriteIDs, setFavoriteIDs] = useState(
    () => JSON.parse(localStorage.getItem('favoriteIDs')) ?? []
  );
  
  const url = `https://api.tankentanken.de/gas-stations?latitude=${latitude}&longitude=${longitude}&radius=${apiRadius}`;

  const FuelInfo = fuelValue.charAt(0).toUpperCase() + fuelValue.slice(1);

  //Calculate radius for API
    function calculateApiRadius (radius) {
  const calculate = radius*1000;
    setApiRadius(calculate)
  };

  
  useEffect(() => {
    calculateApiRadius(radius)
  }, [radius]);
 

  //Toggle favorites
  function toggleFavorite(id) {
    if (favoriteIDs.includes(id)) {
      const updatedFavoriteIDs = favoriteIDs.filter(favID => favID !== id);
      setFavoriteIDs(updatedFavoriteIDs);
    } else {
      setFavoriteIDs([...favoriteIDs, id]);
    }
  }

  // Fetch Stations
  function fetchStations() {
    fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stationsApiKey}`,
      },
    })
      .then(response => response.json())
      .then(json => console.log(json));
  }

  

  useEffect(() => {
    fetchStations(url);
  }, []);


//Location query
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setLatitude(position.coords.latitude)
      setLongitude(position.coords.longitude)
    })
  }, []);
  // componentDidMount() => {
  //   navigator.geolocation.getCurrentPosition(function(position) {
  //     console.log("Latitude is :", position.coords.latitude);
  //     console.log("Longitude is :", position.coords.longitude);
  //   });

  // }

  //Set Favorites to localStorage
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
            toggleFavorite={toggleFavorite}
              favoriteIDs={favoriteIDs}
              fuelValue={fuelValue}
              gasInfoHead={FuelInfo}
              setPosition={setPosition}
              fetchStations={fetchStations}

            />
          }
        />
        <Route
          path="map"
          element={
            <MapPage
              title="Karte"
              fuelValue={fuelValue}
              gasInfoHead={FuelInfo}
              position={position}
              setPosition={setPosition}
            />
          }
        />
        <Route
          path="settings"
          element={
            <SettingsPage
              title="Einstellungen"
              setFuelValue={setFuelValue}
              fuelValue={fuelValue}
              gasInfoHead={FuelInfo}
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
              gasInfoHead={FuelInfo}
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
              gasInfoHead={FuelInfo}
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
