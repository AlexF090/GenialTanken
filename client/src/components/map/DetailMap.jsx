import React from 'react';
import styled from 'styled-components';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import markerIcon from '../icons/CustomMapMarker.jsx';
const mapToken = process.env.REACT_APP_API_KEY;

function DetailMap({ currentStation, fuelValue }) {
  return (
    <MapWrapper
      center={[currentStation.address.latitude, currentStation.address.longitude]}
      zoom={16}
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}>
      <TileLayer
        url={
          'https://api.mapbox.com/styles/v1/alexf090/cl2uhl8gx008p14qop192uczn/tiles/256/{z}/{x}/{y}@2x?access_token=' +
          mapToken
        }
      />

      <Marker
        key={currentStation.id}
        position={[currentStation.address.latitude, currentStation.address.longitude]}
        icon={markerIcon}></Marker>
    </MapWrapper>
  );
}

const MapWrapper = styled(MapContainer)`
  height: 10rem;
  grid-area: map;
  overflow: hidden;
  box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
  border-radius: 10px;
  z-index: 10;
  margin-bottom: 1.3rem;
`;

export default DetailMap;
