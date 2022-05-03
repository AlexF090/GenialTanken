import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { MdStar, MdStarOutline } from 'react-icons/md';

function GasStation({ stations, toggleFavorite, favoriteIDs }) {
  return (
    <GasStationList role="list">
      {stations.map(station => (
        <GasStationItem className="ListItems" key={station.uuid}>
          <CustomLink to={`/${station.uuid}`}>
            <Price>{station.e5}</Price>
            <Brand>{station.brand}</Brand>
            <Name>
              {station.name.length > 14 ? `${station.name.substring(0, 14)}...` : station.name}
            </Name>
            <Street>{station.street}</Street>
            <Adress>
              {station.post_code} {station.city}
            </Adress>
          </CustomLink>
          <FavoriteStarWrapper>
            {favoriteIDs?.includes(station.uuid) ? (
              <ActiveStar
                onClick={() => toggleFavorite(station.uuid)}
                isFavorite={favoriteIDs.includes(station.uuid)}
              />
            ) : (
              <InactiveStar
                onClick={() => toggleFavorite(station.uuid)}
                isFavorite={favoriteIDs.includes(station.uuid)}
              />
            )}
          </FavoriteStarWrapper>
        </GasStationItem>
      ))}
    </GasStationList>
  );
}

const GasStationList = styled.ul`
  display: flex;
  margin-top: 7rem;
  margin-bottom: 100px;
  flex-direction: column;
  gap: 10px;
  width: 100%;
`;

const GasStationItem = styled.li`
  position: relative;
  list-style: none;
`;

const CustomLink = styled(Link)`
  display: grid;
  width: 100%;
  grid-template-columns: 0.1fr 1fr 0.1fr 1fr 1fr 0.1fr;
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-areas:
    '. gasStationName . brand . .'
    'price street . . . .'
    '. adress city . . .';
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  margin-bottom: 4px;
  padding: 15px;
  
`;

const Price = styled.p`
  grid-area: price;
  align-self: center;
  margin-right: 1em;
  font-size: 1.5rem;
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
  position: absolute;
  top: calc(50% - 1rem);
  right: 5%;
`;

const ActiveStar = styled(MdStar)`
  font-size: 2rem;
  color: blue;
`;

const InactiveStar = styled(MdStarOutline)`
  font-size: 2rem;
  color: blue;
`;

export default GasStation;
