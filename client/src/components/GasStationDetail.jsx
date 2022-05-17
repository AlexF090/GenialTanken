import React from 'react';
import styled from 'styled-components';
import OpeningTimes from './OpeningTimes';
import { MdStar, MdStarOutline } from 'react-icons/md';
import DetailMap from '../components/map/DetailMap.jsx';
import Price from './Price.jsx';

function GasStationDetail({ fuelValue, currentStation, toggleFavorite, favoriteIDs }) {
  const dieselPrice = currentStation.fuelPrices.diesel.price;
  const e5Price = currentStation.fuelPrices.e5.price;
  const e10Price = currentStation.fuelPrices.e10.price;
  return (
    <Wrapper>
      <DetailMap fuelValue={fuelValue} currentStation={currentStation} />
      <Brand>{currentStation.brand}</Brand>
      <Name>{currentStation.name}</Name>
      <Street>
        {currentStation.address.street} {currentStation.address.houseNumber}
      </Street>
      <Adress>
        {currentStation.address.postalCode} {currentStation.address.city}
      </Adress>
      <OpeningTimesWrapper>
        <OpeningTimes currentStation={currentStation} />
      </OpeningTimesWrapper>
      <FavoriteStarWrapper>
        {favoriteIDs?.includes(currentStation.id) ? (
          <ActiveStar onClick={() => toggleFavorite(currentStation.id)} />
        ) : (
          <InactiveStar onClick={() => toggleFavorite(currentStation.id)} />
        )}
      </FavoriteStarWrapper>
      <PriceWrapper className="ListItems" key={currentStation.id}>
        <Diesel><Price price={dieselPrice} /> Diesel</Diesel>
        <SuperE5><Price price={e5Price} /> Super E5 </SuperE5>
        <SuperE10>
          {currentStation.fuelPrices.e10 === null
            ? 'Kein Preis für Super E10 vorhanden'
            : currentStation.fuelPrices.e10.price + ' Super E10'}
        </SuperE10>
      </PriceWrapper>
    </Wrapper>
  );
}

const Wrapper = styled.article`
  display: grid;
  width: 80vw;
  max-width: 768px;
  grid-template-columns: 1.5fr 0.5fr;
  grid-template-rows: auto auto auto auto auto 1rem auto 1rem auto;
  grid-template-areas:
    'map map'
    'brand .'
    'gasStationName favoriteIcon'
    'street favoriteIcon'
    'adress favoriteIcon'
    '. .'
    'openingTimes openingTimes'
    '. .'
    'priceWrapper priceWrapper';
  box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.25), inset 0px 0px 5px rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 20px;
`;

const PriceWrapper = styled.ul`
  grid-area: priceWrapper;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-areas:
    'diesel'
    'superE5'
    'superE10';
  gap: 10px;
  margin-top: 0.8em;
`;

const Diesel = styled.li`
  grid-area: diesel;
  list-style: none;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);
  padding: 0.25em 0;
  padding-left: 1em;
`;

const SuperE5 = styled.li`
  grid-area: superE5;
  list-style: none;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);
  padding: 0.25em 0;
  padding-left: 1em;
`;

const SuperE10 = styled.li`
  grid-area: superE10;
  list-style: none;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);
  padding: 0.25em 0;
  padding-left: 1em;
`;

const Brand = styled.p`
  grid-area: brand;
  align-self: center;
`;

const Name = styled.p`
  grid-area: gasStationName;
  align-self: center;
`;

const Street = styled.p`
  grid-area: street;
  font-size: 0.75rem;
  align-self: end;
`;

const Adress = styled.p`
  grid-area: adress;
  font-size: 0.75rem;
`;

const FavoriteStarWrapper = styled.div`
  grid-area: favoriteIcon;
  align-self: center;
  justify-self: center;
`;

const ActiveStar = styled(MdStar)`
  font-size: 2rem;
  color: #0367b4;
`;

const InactiveStar = styled(MdStarOutline)`
  font-size: 2rem;
  color: #2196f3;
`;

const OpeningTimesWrapper = styled.section`
  grid-area: openingTimes;
  border-top: 1px solid #E0E0E0;
  border-bottom: 1px solid #E0E0E0;
`;

export default GasStationDetail;
