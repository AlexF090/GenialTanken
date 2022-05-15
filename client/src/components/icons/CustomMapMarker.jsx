import L from 'leaflet';

const markerIcon = new L.icon({
  iconUrl: require('../../icons/gasolinePump.png'),
  iconSize: [25.5, 28.64175], // size of the icon
  popupAnchor: [-5, -18], // point from which the popup should open relative to the iconAnchor
});

export default markerIcon;
