import React from 'react';
import styled from 'styled-components';
import OpeningTimes from './OpeningTimes';
import { MdStar, MdStarOutline } from 'react-icons/md';

function GasStationDetail({ currentStation, toggleFavorite, favoriteIDs }) {
  return (
    <>
      <Wrapper>
        <Brand>{currentStation.brand}</Brand>
        <Name>{currentStation.name}</Name>
        <Street>
          {currentStation.street} {currentStation.house_number}
        </Street>
        <Adress>
          {currentStation.post_code} {currentStation.city}
        </Adress>
        <OpeningTimesWrapper>
          <OpeningTimes currentStation={currentStation} />
        </OpeningTimesWrapper>
        <FavoriteStarWrapper>
          {favoriteIDs?.includes(currentStation.uuid) ? (
            <ActiveStar onClick={() => toggleFavorite(currentStation.uuid)} />
          ) : (
            <InactiveStar onClick={() => toggleFavorite(currentStation.uuid)} />
          )}
        </FavoriteStarWrapper>
        <PriceWrapper className="ListItems" key={currentStation.uuid}>
          <Diesel>{currentStation.diesel} Diesel</Diesel>
          <SuperE5> {currentStation.e5} Super E5 </SuperE5>
          <SuperE10> {currentStation.e10} Super E10 </SuperE10>
        </PriceWrapper>
      </Wrapper>
    </>
  );
}

const Wrapper = styled.article`
  display: grid;
  width: 70vw;
  grid-template-columns: 1.5fr 0.5fr;
  grid-template-rows: auto auto auto auto auto auto auto auto;
  grid-template-areas:
    'brand .'
    'gasStationName .'
    'street favoriteIcon'
    'adress favoriteIcon'
    '. .'
    'openingTimes openingTimes'
    '. .'
    'priceWrapper priceWrapper';
  gap: 15px;
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
  gap: 20px;
`;

const Diesel = styled.li`
  grid-area: diesel;
  list-style: none;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);

  padding-left: 0.5em;
`;

const SuperE5 = styled.li`
  grid-area: superE5;
  list-style: none;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);

  padding-left: 0.5em;
`;

const SuperE10 = styled.li`
  grid-area: superE10;
  list-style: none;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);

  padding-left: 0.5em;
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

const OpeningTimesWrapper = styled.p`
  grid-area: openingTimes;
  border-top: 1px solid black;
  border-bottom: 1px solid black;
`;

export default GasStationDetail;
