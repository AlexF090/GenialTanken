/**
 * Origin of the API on Render, called directly by the production build of the web app. Plain
 * constant without imports on purpose: the hosting build (`hosting/`) reads it as well, to allow
 * exactly this origin in the Content Security Policy (`connect-src`).
 */
export const API_ORIGIN = 'https://genialtanken-api.onrender.com';
