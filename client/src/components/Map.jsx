import React from 'react';
import styled from 'styled-components';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';

function Map({ LocationMarker, stations, fuelValue }) {
  const mapToken = process.env.REACT_APP_API_KEY;

  return (
    <MapWrapper center={[52.500478, 13.376696]} zoom={13} scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
              <Popup>{station.fuelPrices[fuelValue].price + ' €'}</Popup>
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

export default Map;
