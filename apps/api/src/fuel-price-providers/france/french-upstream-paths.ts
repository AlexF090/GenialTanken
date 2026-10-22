/** Records of the dataset on the open data portal (`FRANCE_FUEL_PRICES_BASE_URL`). */
export const FRENCH_RECORDS_PATH =
  '/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

/** HTML fragment with name and brand on the price service's website (`FRANCE_STATION_DETAILS_BASE_URL`). */
export const frenchStationPagePath = (localIdentifier: number): string =>
  `/map/recuperer_infos_pdv/${String(localIdentifier)}`;
