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
      <Header />
      <Main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="Karte" element={<MapPage />} />
          <Route path="Einstellungen" element={<SettingsPage />} />
          <Route path="Favoriten" element={<FavoritePage />} />
        </Routes>
      </Main>
      <NavBar />
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
`;

const Main = styled.main`
  display: flex;
  width: 70vw;
  justify-content: center;
`;

export default App;
