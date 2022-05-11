import React, { useState, useEffect } from 'react';
import { useMapEvents, Marker, Popup } from 'react-leaflet';

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

export default LocationMarker;
