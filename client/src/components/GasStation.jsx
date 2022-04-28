import React from 'react';
import styled from 'styled-components';
import data from '../data/db';
import FavoriteIconDeactivated from '../icons/favorite_icon_deactivated.svg';

function GasStation() {
  return (
    // <StyledMain>
    <GasStationList role="list">
      {data.map(station => (
        <GasStationItem className="ListItems" key={station.uuid}>
          <p>{station.e5}</p>
          <h2>{station.brand}</h2>
          <h3>{station.name.length > 14 ? `${station.name.substring(0, 14)}...` : station.name}</h3>
          <p>{station.street}</p>
          <p>{station.post_code}</p>
          <p>{station.city}</p>
          <img src={FavoriteIconDeactivated} alt="Favorite icon deactivated" />
        </GasStationItem>
      ))}
    </GasStationList>
    // </StyledMain>
  );
}

const GasStationList = styled.ul`
  display: flex;
  margin-top: 120px;
  margin-bottom: 100px;
  flex-direction: column;
  gap: 10px;
`;

const GasStationItem = styled.li`
  display: grid;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  margin-bottom: 4px;
  padding: 15px;
  list-style: none;
`;

export default GasStation;
