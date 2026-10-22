import { parseFrenchStationIdentity } from './parse-french-station-identity.js';

const stationFragment = (name: string, brand: string): string => `
<div id="colg" class="colg">
    <h3 class="fr-text--md">${name}</h3>
    <p class="fr-text--sm">
        <strong>${brand}</strong><br />
        37 rue fabert<br />
        75007 Paris
    </p>
</div>`;

describe('parseFrenchStationIdentity', () => {
  it('reads the name from the heading and the brand from the first strong text', () => {
    expect(
      parseFrenchStationIdentity(stationFragment('RELAIS DES INVALIDES', 'TotalEnergies'))
    ).toEqual({ name: 'RELAIS DES INVALIDES', brand: 'TotalEnergies' });
  });

  it('decodes entities and collapses whitespace', () => {
    expect(
      parseFrenchStationIdentity(
        stationFragment(' Station  d&#039;Auteuil &amp; Fils ', 'E.Leclerc')
      )
    ).toEqual({ name: "Station d'Auteuil & Fils", brand: 'E.Leclerc' });
  });

  it('keeps numeric entities outside the Unicode range unchanged', () => {
    expect(
      parseFrenchStationIdentity(stationFragment('Station &#99999999; &#xD800; &#x41;', 'Total'))
    ).toEqual({ name: 'Station &#99999999; &#xD800; A', brand: 'Total' });
  });

  it('returns null for missing or empty parts', () => {
    expect(parseFrenchStationIdentity(stationFragment('', ''))).toEqual({
      name: null,
      brand: null,
    });
    expect(parseFrenchStationIdentity('<p>Aucune information</p>')).toEqual({
      name: null,
      brand: null,
    });
  });
});
