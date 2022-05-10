import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

function Map({ LocationMarker, stations, fuelValue }) {
  const mapToken = process.env.REACT_APP_API_KEY;

  return (
    <MapWrapper center={[52.500478, 13.376696]} zoom={13} scrollWheelZoom={true}>
      <TileLayer
        url={
          'https://api.mapbox.com/styles/v1/alexf090/cl2uhl8gx008p14qop192uczn/tiles/256/{z}/{x}/{y}@2x?access_token=' +
          mapToken
        }
      />
      {stations
        .filter(station => station.fuelPrices[fuelValue] !== null)
        .map(station => {
          return (
            <Marker
              key={station.id}
              position={[station.address.latitude, station.address.longitude]}>
              <NewPopup>
                <Price>{station.fuelPrices[fuelValue].price + ' €'}</Price>
                <Link to={`/${station.id}`}>Mehr Anzeigen</Link>
              </NewPopup>
            </Marker>
          );
        })}
      <LocationMarker />
    </MapWrapper>
  );
}

const MapWrapper = styled(MapContainer)`
  position: absolute;
  top: 6.25rem;
  right: 0;
  left: 0;
  bottom: 6rem;
  overflow: hidden;
  z-index: 10;
`;

const NewPopup = styled(Popup)`
  /* width: 90px; */
  padding: 0;
  .leaflet-popup-content-wrapper {
    border-radius: 0;
    text-align: center;
  }
  .leaflet-popup-content {
    margin: 0;
  }
  .leaflet-popup-content p {
    margin: 0.5em 0.5em;
    padding: 0 1em;
    font-size: 1rem;
    text-align: center;
  }
  .leaflet-popup-content a {
    text-decoration: none;
    color: #2196f3;
  }
`;

const Price = styled.p`
  margin: 0;
`;

export default Map;
