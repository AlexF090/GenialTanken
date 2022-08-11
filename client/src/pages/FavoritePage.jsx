import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import Header from '../components/Header/Header.jsx';
import GasStationList from '../components/GasStationList/GasStationList.jsx';

const stationsApiKey = process.env.REACT_APP_STATIONS_API_KEY;

function FavoritesPage({ gasInfoHead, title, fuelValue, favoriteIDs, toggleFavorite }) {
  const [favoriteStations, setFavoriteStations] = useState([]);
  const url = 'https://api.tankentanken.de/gas-stations/';

  const getFavoriteObjects = () => {
    const favoriteFetches = favoriteIDs.map(favoriteID =>
      fetch(url + favoriteID, {
        headers: {
          Authorization: `Bearer ${stationsApiKey}`,
        },
      }).then(data => data.json())
    );
    Promise.all(favoriteFetches).then(data => {
      setFavoriteStations(data);
    });
  };

  useEffect(() => {
    getFavoriteObjects();
  }, []);

  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <main>
        {favoriteIDs.length > 0 ? (
          <GasStationList
            favoriteIDs={favoriteIDs}
            toggleFavorite={toggleFavorite}
            fuelValue={fuelValue}
            stations={favoriteStations}
          />
        ) : (
          <Empty>Keine Favoriten gespeichert</Empty>
        )}
      </main>
    </>
  );
}

const Empty = styled.h3`
  margin-top: 10rem;
  text-align: center;
`;

export default FavoritesPage;
