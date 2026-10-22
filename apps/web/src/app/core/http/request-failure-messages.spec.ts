import { noResponseMessage } from './request-failure-messages';

describe('noResponseMessage', () => {
  it('points to the connection while the browser has a network', () => {
    expect(noResponseMessage(true)).toBe(
      'Der Server ist nicht erreichbar. Bitte prüfe deine Internetverbindung.'
    );
  });

  it('says that prices follow once the browser is back online', () => {
    expect(noResponseMessage(false)).toBe(
      'Du bist offline – Preise werden geladen, sobald du wieder verbunden bist.'
    );
  });
});
