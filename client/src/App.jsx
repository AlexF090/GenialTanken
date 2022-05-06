import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import NavBar from './components/NavBar';
import LandingPage from './pages/LandingPage';
import MapPage from '../src/pages/MapPage';
import SettingsPage from '../src/pages/SettingsPage';
import FavoritePage from '../src/pages/FavoritePage';
import DetailedGasStationPage from '../src/pages/DetailedGasStationPage';

function App() {
  const [fuelValue, setFuelValue] = useState('e5');
  const [favoriteIDs, setFavoriteIDs] = useState(
    () => JSON.parse(localStorage.getItem('favoriteIDs')) ?? []
  );

  const FuelInfo = fuelValue.charAt(0).toUpperCase(0) + fuelValue.slice(1);

  function toggleFavorite(id) {
    if (favoriteIDs.includes(id)) {
      const updatedFavoriteIDs = favoriteIDs.filter(favID => favID !== id);
      setFavoriteIDs(updatedFavoriteIDs);
    } else {
      setFavoriteIDs([...favoriteIDs, id]);
    }
  }

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
              toggleFavorite={toggleFavorite}
              favoriteIDs={favoriteIDs}
              fuelValue={fuelValue}
              gasInfoHead={FuelInfo}
              title="Start"
            />
          }
        />
        <Route
          path="map"
          element={<MapPage title="Karte" fuelValue={fuelValue} gasInfoHead={FuelInfo} />}
        />
        <Route
          path="settings"
          element={
            <SettingsPage
              title="Einstellungen"
              setFuelValue={setFuelValue}
              fuelValue={fuelValue}
              gasInfoHead={FuelInfo}
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
