import React, { useState } from 'react';
import Header from '../components/Header.jsx';
import Map from '../components/Map.jsx';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Popup } from 'react-leaflet';

function MapPage({ gasInfoHead, title, fuelValue }) {
  function LocationMarker() {
    const [position, setPosition] = useState(null);
    const map = useMapEvents({
      click() {
        map.locate();
      },
      locationfound(e) {
        setPosition(e.latlng);
        map.flyTo(e.latlng, map.getZoom());
      },
    });

    return position === null ? null : (
      <Marker position={position}>
        <Popup>Du bist hier !</Popup>
      </Marker>
    );
  }

  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Map LocationMarker={LocationMarker} />
    </>
  );
}

export default MapPage;
