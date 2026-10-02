/** The API answered with a body that does not match the shared contract. */
export class UnexpectedResponseError extends Error {
  constructor(endpoint: string, validationDetails: string) {
    super(`Response of ${endpoint} does not match the contract: ${validationDetails}`);
    this.name = 'UnexpectedResponseError';
  }
}
