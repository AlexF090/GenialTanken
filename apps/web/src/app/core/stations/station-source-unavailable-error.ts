/** The API answered, but could not reach the price source of the station; worth retrying later. */
export class StationSourceUnavailableError extends Error {
  constructor(stationIdentifier: string) {
    super(`The price source of station ${stationIdentifier} is unavailable`);
    this.name = 'StationSourceUnavailableError';
  }
}
