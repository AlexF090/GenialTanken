import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
const mapToken = process.env.REACT_APP_API_KEY;

function DetailMap({ currentStation, fuelValue }) {
  return (
    <MapWrapper
      center={[currentStation.address.latitude, currentStation.address.longitude]}
      zoom={17}
      scrollWheelZoom={false}
      zoomControl={false}>
      <TileLayer
        url={
          'https://api.mapbox.com/styles/v1/alexf090/cl2uhl8gx008p14qop192uczn/tiles/256/{z}/{x}/{y}@2x?access_token=' +
          mapToken
        }
      />

      <Marker
        key={currentStation.id}
        position={[currentStation.address.latitude, currentStation.address.longitude]}>
        <NewPopup
          autoClose={false}
          closeOnEscapeKey={false}
          closeButton={false}
          closeOnClick={false}
          popupOpen={true}>
          <Price>{currentStation.fuelPrices[fuelValue]?.price + ' €'}</Price>
          <Link to={`/${currentStation.id}`}>Mehr Anzeigen</Link>
        </NewPopup>
      </Marker>
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

const NewPopup = styled(Popup)`
  padding: 0;
  .leaflet-popup-content-wrapper {
    /* border-radius: 0; */
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

export default DetailMap;
