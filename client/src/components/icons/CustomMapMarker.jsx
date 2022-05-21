import L from 'leaflet';

const markerIcon = new L.icon({
  iconUrl: require('../../icons/gasolinePump.png'),
  iconSize: [25.5, 28.64175],
  popupAnchor: [-5, -18],
});

export default markerIcon;
