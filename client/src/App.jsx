import React from 'react';
import styled from 'styled-components';
import Header from './components/Header';
import NavBar from './components/NavBar';
import './App.css';
import data from './data/db';
import FavoriteIconDeactivated from './icons/favorite_icon_deactivated.svg';

function App() {
  console.log(data);

  return (
    <Wrapper>
      <Header />
      <Main>
      <StyledUList>
        {data.map(station => (
          <StyledGasStationItem className="ListItems" key={station.uuid}>
            {station.e5}{' '}
            {station.name.length > 14 ? `${station.name.substring(0, 14)}...` : station.name}{' '}
            {station.street} {station.post_code} {station.city}
            <img src={FavoriteIconDeactivated} alt="Favorite icon deactivated" />
          </StyledGasStationItem>
        ))}
      </StyledUList>
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
  width: 70vw;y<
  justify-content: center;
  
`;

const StyledUList = styled.ul`
display: flex;
margin-top: 120px;
margin-bottom: 100px;
flex-direction: column;
gap: 10px;
`;

const StyledGasStationItem = styled.li`
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  margin-bottom: 4px;
  padding: 15px;
  list-style: none;
  /* border: 1px solid black; */
`;

//
//

export default App;
