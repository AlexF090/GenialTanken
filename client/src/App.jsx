import React from 'react';
import styled from 'styled-components';
import Header from './components/Header';
import NavBar from './components/NavBar';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <Wrapper>
      <Header />
      <Main>
        <LandingPage />
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
