import React from 'react';
import styled from 'styled-components';
import { IoReload } from 'react-icons/io5';
import GasStationList from '../components/GasStationList.jsx';
import Header from '../components/Header.jsx';
import Button from '../components/Button.jsx';

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
        <ButtonWrapper>
          <Button
            buttonTitle={<IoReload />}
            myFunction={() => {
              getCurrentPosition();
            }}
          />
          <Button
            buttonTitle={'Sortiert nach: km'}
            myFunction={() => {
              getCurrentPosition();
            }}
          />
        </ButtonWrapper>
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

const ButtonWrapper = styled.main`
  display: flex;
  justify-content: space-around;
`;

export default LandingPage;
