import React, { useState, useEffect } from 'react';
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
  const [sortedStations, setSortedStations] = useState(stations);
  const [isManuallySorted, setIsManuallySorted] = useState(false);

  function sortByPrice() {
    const copy = [...stations];

    isManuallySorted
      ? setSortedStations(
          copy.sort((a, b) =>
            a.fuelPrices[fuelValue].price > b.fuelPrices[fuelValue].price ? 1 : -1
          )
        )
      : setSortedStations(stations);
  }

  useEffect(() => {
    sortByPrice();
  }, [isManuallySorted]);

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
            buttonTitle={isManuallySorted === false ? 'Sortiert nach: km' : 'Sortiert nach: Preis'}
            myFunction={() => {
              setIsManuallySorted(!isManuallySorted);
            }}
          />
        </ButtonWrapper>

        <GasStationList
          stations={sortedStations.length === 0 ? stations : sortedStations}
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
