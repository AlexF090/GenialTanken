import React from 'react';
import { Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import NavBar from './components/NavBar';
import LandingPage from './pages/LandingPage';
import MapPage from '../src/pages/MapPage';
import SettingsPage from '../src/pages/SettingsPage';
import FavoritePage from '../src/pages/FavoritePage';

function App() {
  return (
    <Wrapper>
      <Routes>
        <Route path="/" element={<LandingPage title="Start" />} />
        <Route path="map" element={<MapPage title="Karte" />} />
        <Route path="settings" element={<SettingsPage title="Einstellungen" />} />
        <Route path="favorites" element={<FavoritePage title="Favoriten" />} />
      </Routes>
      <NavBar />
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
`;

export default App;
