import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { configurePageTest, hostElementOf, textOf } from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { OPERATOR } from '../../core/operator';

describe('PrivacyPage', () => {
  let context: PageTestContext;
  let element: HTMLElement;

  beforeEach(async () => {
    context = configurePageTest({ routes });
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/datenschutz');
    await context.settle();
    element = hostElementOf(fixture);
  });

  afterEach(() => {
    context.httpTesting.verify();
  });

  const text = (): string => textOf(element.querySelector('main'));

  const headings = (): string[] =>
    [...element.querySelectorAll('main h2')].map(heading => textOf(heading));

  it('is a page of its own under /datenschutz with title and one main landmark', () => {
    expect(TestBed.inject(Router).url).toBe('/datenschutz');
    expect(document.title).toBe('Datenschutzerklärung – GenialTanken');
    expect(textOf(element.querySelector('header h1'))).toBe('Datenschutz');
    expect(element.querySelectorAll('main')).toHaveLength(1);
    expect(element.querySelectorAll('main h1')).toHaveLength(0);
  });

  it('names the controller with the postal address and the contact address of appool.de', () => {
    expect(text()).toContain(OPERATOR.name);
    expect(text()).toContain(`${OPERATOR.street}, ${OPERATOR.postalCode} ${OPERATOR.city}`);
    expect(OPERATOR.email).toBe('kontakt@appool.de');
    expect(element.querySelector(`a[href="mailto:${OPERATOR.email}"]`)).not.toBeNull();
  });

  it('gives no telephone number', () => {
    expect(text()).not.toMatch(/Telefon|Tel\.|\+49/);
    expect(element.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('describes hosting at Hetzner with server logs of seven days and a processing agreement', () => {
    expect(text()).toContain('Hetzner Online GmbH');
    expect(text()).toContain('Gunzenhausen');
    expect(text()).toContain('sieben Tage');
    expect(text()).toContain('Auftragsverarbeitungsvertrag');
  });

  it('describes the redirect of the old address through Cloudflare with storage and safeguards', () => {
    expect(text()).toContain('Cloudflare, Inc.');
    expect(text()).toContain('workers.dev');
    expect(text()).toContain('auf die aktuelle Adresse weiter');
    expect(text()).toContain('ohne Weiterleitung mit einer Fehlermeldung');
    expect(text()).toContain('keine Protokollierung eingeschaltet');
    expect(text()).toContain('nennt dafür keine feste Frist');
    expect(text()).toContain('mit Cloudflare besteht ein Auftragsverarbeitungsvertrag');
  });

  it('describes the API on Render as a transfer to a third country with its safeguards', () => {
    expect(text()).toContain('Render Services, Inc.');
    expect(text()).toContain('USA');
    expect(text()).toMatch(/Data Privacy Framework/);
    expect(text()).toMatch(/Standardvertragsklauseln/);
  });

  it('names every service the app or its API asks, as the code does', () => {
    expect(text()).toContain('data.economie.gouv.fr');
    expect(text()).toContain('prix-carburants.gouv.fr');
    expect(text()).toContain('Photon');
    expect(text()).toContain('komoot');
    expect(text()).toContain('OpenStreetMap');
    expect(text()).toContain('Mapbox');
  });

  it('explains that the position is only sent for the search and not stored', () => {
    expect(text()).toMatch(/Standort/);
    expect(text()).toMatch(/weder auf unserem Server noch im Browser gespeichert/);
  });

  it('describes the local storage of the browser and the service worker, and no cookies or tracking', () => {
    expect(text()).toContain('lokalen Speicher');
    expect(text()).toContain('Service Worker');
    expect(text()).toMatch(/keine Cookies/);
    expect(text()).toMatch(/keine Analyse- oder Tracking/);
  });

  it('lists the rights of the data subject including the complaint to a supervisory authority', () => {
    expect(headings()).toContain('Ihre Rechte');
    for (const right of ['Auskunft', 'Berichtigung', 'Löschung', 'Widerspruch', 'Beschwerde']) {
      expect(text()).toContain(right);
    }
  });

  it('links to the legal notice and back to the map', () => {
    const legalNotice = element.querySelector('a[href="https://appool.de/impressum"]');
    const map = [...element.querySelectorAll('main a')].find(link => textOf(link) === 'Zur Karte');

    expect(legalNotice).not.toBeNull();
    expect(map?.getAttribute('href')).toBe('/');
  });
});
