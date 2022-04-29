import React from 'react';
import { Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import Header from './components/Header';
import NavBar from './components/NavBar';
import LandingPage from './pages/LandingPage';
import MapPage from '../src/pages/MapPage';
import SettingsPage from '../src/pages/SettingsPage';
import FavoritePage from '../src/pages/FavoritePage';

function App() {
  return (
    <Wrapper>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="favorites" element={<FavoritePage />} />
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
