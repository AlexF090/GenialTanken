import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import Header from '../components/Header.jsx';
import GasStationList from '../components/GasStationList.jsx';

const stationsApiKey = process.env.REACT_APP_STATIONS_API_KEY;

function FavoritesPage({ gasInfoHead, title, fuelValue, favoriteIDs, toggleFavorite }) {
  const [favoriteStations, setFavoriteStations] = useState([]);
  const url = 'https://api.tankentanken.de/gas-stations/';

  const getFavoriteObjects = () => {
    // const stations = [];
    const favoriteFetches = favoriteIDs.map(favoriteID =>
      fetch(url + favoriteID, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stationsApiKey}`,
        },
      }).then(data => data.json())
    );

    Promise.all(favoriteFetches).then(data => {
      console.log(data);
    });
  };

  useEffect(() => {
    getFavoriteObjects();
  }, []);

  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      {favoriteIDs.length > 0 ? (
        <GasStationList
          favoriteIDs={favoriteIDs}
          toggleFavorite={toggleFavorite}
          fuelValue={fuelValue}
          stations={favoriteStations.filter(station => favoriteIDs.includes(station.id))}
        />
      ) : (
        <Empty>Keine Favoriten gespeichert</Empty>
      )}
    </>
  );
}

const Empty = styled.h3`
  margin-top: 10rem;
  text-align: center;
`;

export default FavoritesPage;
