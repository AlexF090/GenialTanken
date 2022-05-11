import React, { useState, useEffect } from 'react';
import stations from '../data/db.js';
import Header from '../components/Header.jsx';
import Map from '../components/Map.jsx';
import { useMapEvents, Marker, Popup } from 'react-leaflet';

function MapPage({ gasInfoHead, title, fuelValue }) {
  function LocationMarker() {
    const [position, setPosition] = useState(null);

    useEffect(() => {
      map.locate();
    }, []);

    const map = useMapEvents({
      locationfound(e) {
        setPosition(e.latlng);
        map.flyTo(e.latlng, map.getZoom());
      },
    });
    return position === null ? null : (
      <Marker position={position}>
        <Popup> Du bist hier !</Popup>
      </Marker>
    );
  }

  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Map LocationMarker={LocationMarker} stations={stations} fuelValue={fuelValue} />
    </>
  );
}

export default MapPage;
