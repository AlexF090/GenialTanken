import { API_ORIGIN } from './api-origin';
import { environment } from './environment.production';

describe('production environment', () => {
  it('calls the API on its own origin directly, which the CORS settings of the API allow', () => {
    expect(environment.apiBaseUrl).toBe(`${API_ORIGIN}/api`);
    expect(API_ORIGIN).toMatch(/^https:\/\/[^/]+$/);
  });
});
