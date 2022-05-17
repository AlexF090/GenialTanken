import React from 'react';
import styled from 'styled-components';
import GasStationList from '../components/GasStationList.jsx';
import Header from '../components/Header.jsx';
import Button from '../components/Button';

function LandingPage({
  title,
  gasInfoHead,
  stations,
  fuelValue,
  toggleFavorite,
  favoriteIDs,
  getCurrentPosition,
}) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Wrapper>
        <Button
          buttonTitle={'Aktualisieren'}
          myFunction={() => {
            getCurrentPosition();
          }}
        />
        <GasStationList
          stations={stations}
          toggleFavorite={toggleFavorite}
          favoriteIDs={favoriteIDs}
          fuelValue={fuelValue}
        />
      </Wrapper>
    </>
  );
}

const Wrapper = styled.main`
  display: flex;
  flex-direction: column;
  margin-bottom: 0.25rem;
  gap: 1rem;
`;

export default LandingPage;
