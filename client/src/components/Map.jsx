import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { IoIosPin } from 'react-icons/io';
import mapboxgl from 'mapbox-gl';
const mapToken = process.env.REACT_APP_API_KEY;
mapboxgl.accessToken = mapToken;

function Map() {
  const [coords, setCoords] = useState({
    lng: 13.376696,
    lat: 52.500478,
    zoom: 18,
  });

  const mapContainer = useRef('');
  const map = useRef(null);

  useEffect(() => {
    if (map.current === null) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/alexf090/cl2uhl8gx008p14qop192uczn',
        center: [coords.lng, coords.lat],
        zoom: coords.zoom,
      });
    }
  }, []);

  return (
    <>
      <MapStyle ref={el => (mapContainer.current = el)} />
    </>
  );
}

const MapStyle = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  overflow: hidden;
`;

export default Map;
