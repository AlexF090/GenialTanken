// Leaflet has to be imported before the marker cluster plugin, which extends the global `L`. Import
// `L` from here, so the plugin is always loaded.
import L from 'leaflet';
import 'leaflet.markercluster';

export { L };
