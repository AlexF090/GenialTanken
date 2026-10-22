const FRENCH_DATASET_PATH =
  '/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2';

/** Queryable records of the dataset on the open data portal (`FRANCE_FUEL_PRICES_BASE_URL`). */
export const FRENCH_RECORDS_PATH = `${FRENCH_DATASET_PATH}/records`;

/** The whole dataset in one JSON array, without the paging limit of `FRENCH_RECORDS_PATH`. */
export const FRENCH_EXPORT_PATH = `${FRENCH_DATASET_PATH}/exports/json`;

/** HTML fragment with name and brand on the price service's website (`FRANCE_STATION_DETAILS_BASE_URL`). */
export const frenchStationPagePath = (localIdentifier: number): string =>
  `/map/recuperer_infos_pdv/${String(localIdentifier)}`;
