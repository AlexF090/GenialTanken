import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import MarkerCluster from '../map/MarkerCluster.jsx';
import markerIcon from '../icons/CustomMapMarker.jsx';
import Price from '../Price/Price.jsx';
const mapToken = process.env.REACT_APP_API_KEY;

function Map({ stations, fuelValue, latitude, longitude }) {
  const MyMarker = props => {
    const leafletRef = useRef();
    useEffect(() => {
      leafletRef.current.openPopup();
    }, []);
    return <Marker ref={leafletRef} {...props} />;
  };

  return (
    <main>
    <MapWrapper
      center={[50.9548223, 10.1686673]}
      zoom={6}
      scrollWheelZoom={true}
      zoomControl={false}>
      <TileLayer
        url={
          'https://api.mapbox.com/styles/v1/alexf090/cl2uhl8gx008p14qop192uczn/tiles/256/{z}/{x}/{y}@2x?access_token=' +
          mapToken
        }
      />
      <ZoomControl position="topright" />
      <MarkerCluster>
        {stations
          .filter(station => station.fuelPrices[fuelValue] !== null)
          .map(station => {
            return (
              <MyMarker
                key={station.id}
                position={[station.address.latitude, station.address.longitude]}
                icon={markerIcon}>
                <NewPopup
                  autoClose={false}
                  closeOnEscapeKey={false}
                  closeButton={false}
                  closeOnClick={false}
                  popupOpen={true}>
                  <p>
                    <Price price={station.fuelPrices[fuelValue].price} />
                  </p>
                  <Link to={`/${station.id}`}>Mehr Anzeigen</Link>
                </NewPopup>
              </MyMarker>
            );
          })}
      </MarkerCluster>
      {latitude && longitude !== null && (
        <MyMarker position={[latitude, longitude]}>
          <NewPopup
            autoClose={false}
            closeOnEscapeKey={false}
            closeButton={false}
            closeOnClick={false}
            popupOpen={true}>
            Du bist hier !
          </NewPopup>
        </MyMarker>
      )}
    </MapWrapper>
    </main>
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
  padding: 0;
  .leaflet-popup-content-wrapper {
    text-align: center;
  }
  .leaflet-popup-content {
    margin: 0;
    padding: 0.25em;
  }
  .leaflet-popup-content p {
    margin: 0.5em 0.5em;
    font-size: 1rem;
    text-align: center;
  }
  .leaflet-popup-content a {
    margin: 0.5em 0.5em;
    text-decoration: none;
    color: #2196f3;
  }
`;

export default Map;
