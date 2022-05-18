import React, { useEffect } from 'react';
import { useMapEvents, Marker, Popup } from 'react-leaflet';

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    locationfound(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  useEffect(() => {
    map.locate();
  }, [map]);

  return position === null ? null : (
    <Marker position={position}>
      <Popup> Du bist hier!</Popup>
    </Marker>
  );
}

export default LocationMarker;
