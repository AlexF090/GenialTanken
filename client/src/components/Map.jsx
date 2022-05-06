import React, { useState, useRef, useEffect } from 'react';

import mapboxgl from 'mapbox-gl';
mapboxgl.accessToken =
  'pk.eyJ1IjoiYWxleGYwOTAiLCJhIjoiY2wydWhlNzlwMDIzbDNkbXBjM2s4YXh5cSJ9.vMlWcn3nD2YpsFwSbhg7sw';

const style = {
  position: 'absolute',
  top: 0,
  right: 0,
  left: 0,
  bottom: 0,
};

function Map() {
  const [state, setState] = useState({
    lng: 13.376696,
    lat: 52.500478,
    zoom: 18,
  });

  const mapContainer = useRef('');
  const map = useRef(null);

  useEffect(() => {
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/alexf090/cl2uhl8gx008p14qop192uczn',
      center: [state.lng, state.lat],
      zoom: state.zoom,
    });
  }, []);

  return (
    <div className="App">
      <div style={style} ref={el => (mapContainer.current = el)} />
    </div>
  );
}

export default Map;