import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import { StationsMap } from '../../ui/stations-map/stations-map';
import {
  accessibleTextOf,
  configurePageTest,
  getButton,
  hostElementOf,
  textOf,
} from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import {
  essoStation,
  carrefourStation,
  totalStation,
  unbrandedStation,
  withoutDistance,
} from '../../../testing/station-fixtures';
import { routes } from '../../app.routes';
import { STATIONS_URL, stationsUrl, stationUrl } from '../../../testing/api-urls';
import {
  childComponent,
  EIFFEL_TOWER_E5_URL,
  resultSummaryElement,
  selectedStationTitles,
} from './explore-page-test-helpers';

describe('ExplorePage with a station card', () => {
  let context: PageTestContext;

  const TOTAL_DETAILS_URL = stationUrl(totalStation.id);

  const openAt = async (url: string) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await context.settle();
    const element = hostElementOf(harness.fixture);
    const router = TestBed.inject(Router);
    const navigate = async (target: string) => {
      await router.navigateByUrl(target);
      await context.settle();
    };
    return { harness, element, router, navigate };
  };

  const listContainer = (element: HTMLElement) =>
    element.querySelector('app-station-list')?.parentElement;

  beforeEach(() => {
    context = configurePageTest({ routes });
  });

  afterEach(() => {
    context.httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('shows the card instead of the list and selects its station on the map', async () => {
    const { harness, element, navigate } = await openAt('/');
    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation]);
    await context.settle();

    await navigate(`/stations/${totalStation.id}`);
    // The station is among the results, so the card needs no request of its own.
    context.httpTesting.expectNone(TOTAL_DETAILS_URL);

    expect(listContainer(element)?.hidden).toBe(true);
    expect(textOf(element.querySelector('app-station-detail-page h2'))).toBe('TotalEnergies');
    expect(childComponent(harness.fixture, StationsMap).selectedStationIdentifier()).toBe(
      totalStation.id
    );
  });

  it('keeps the list from leading the sheet while a card is open', async () => {
    const { harness, navigate } = await openAt('/');
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();
    const sheet = childComponent(harness.fixture, BottomSheet);

    expect(sheet.contentDragsSheet()).toBe(true);

    await navigate(`/stations/${totalStation.id}`);

    expect(sheet.contentDragsSheet()).toBe(false);
  });

  it('keeps the page heading and the offline notice while a card is open', async () => {
    const { element, navigate } = await openAt('/');
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();

    await navigate(`/stations/${totalStation.id}`);

    const heading = element.querySelector('main h1');
    expect(heading?.closest('[hidden]')).toBeNull();
    expect(accessibleTextOf(heading)).toBe('GenialTanken');
    expect(
      element.querySelector('.explore-page__place-search')?.closest('[hidden]')
    ).not.toBeNull();
    expect(element.querySelector('.explore-page__offline')?.closest('[hidden]')).toBeNull();
  });

  it('returns to the list with the station still selected when the card closes', async () => {
    const { harness, element } = await openAt(`/stations/${totalStation.id}`);
    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation]);
    context.httpTesting.expectOne(TOTAL_DETAILS_URL).flush(withoutDistance(totalStation));
    await context.settle();

    getButton(element, 'Schließen').click();
    await context.settle();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(listContainer(element)?.hidden).toBe(false);
    expect(element.querySelector('app-station-detail-page')).toBeNull();
    expect(selectedStationTitles(element)).toEqual(['TotalEnergies']);
    expect(textOf(document.activeElement)).toBe('TotalEnergies');
    expect(document.activeElement?.classList).toContain('station-row__title');
  });

  it('focuses the result summary when the closed station is not in the list', async () => {
    const { harness, element } = await openAt(`/stations/${totalStation.id}`);
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([carrefourStation]);
    context.httpTesting.expectOne(TOTAL_DETAILS_URL).flush(withoutDistance(totalStation));
    await context.settle();
    // The search moved to the station, which has no price for the chosen fuel.
    context.httpTesting.expectOne(stationsUrl(totalStation.address)).flush([]);
    await context.settle();

    getButton(element, 'Schließen').click();
    await context.settle();
    await harness.fixture.whenStable();

    const summary = resultSummaryElement(element);
    expect(document.activeElement).toBe(summary);
    expect(textOf(summary)).toBe(
      'Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden.'
    );
  });

  it('shows an opened card from its top and returns to the list where it was', async () => {
    const { element, navigate } = await openAt('/');
    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation]);
    await context.settle();
    const sheetContent = element.querySelector<HTMLElement>('.bottom-sheet__content');
    if (sheetContent === null) {
      throw new Error('No sheet content');
    }
    sheetContent.scrollTop = 120;

    await navigate(`/stations/${totalStation.id}`);
    // The station is among the results, so the card needs no request of its own.
    context.httpTesting.expectNone(TOTAL_DETAILS_URL);
    expect(sheetContent.scrollTop).toBe(0);

    await navigate('/');
    expect(sheetContent.scrollTop).toBe(120);
  });

  it('opens the card of another price tag chosen while a card is open', async () => {
    const { harness, router } = await openAt(`/stations/${totalStation.id}`);
    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation]);
    context.httpTesting.expectOne(TOTAL_DETAILS_URL).flush(withoutDistance(totalStation));
    await context.settle();

    childComponent(harness.fixture, StationsMap).stationSelected.emit(carrefourStation.id);
    await context.settle();

    expect(router.url).toBe(`/stations/${carrefourStation.id}`);
    context.httpTesting.expectNone(stationUrl(carrefourStation.id));
  });

  it('moves the search to a station outside the results, named after it', async () => {
    const { element } = await openAt(`/stations/${essoStation.id}`);
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    context.httpTesting.expectOne(stationUrl(essoStation.id)).flush(withoutDistance(essoStation));
    await context.settle();

    context.httpTesting.expectOne(stationsUrl(essoStation.address)).flush([essoStation]);
    await context.settle();

    expect(textOf(resultSummaryElement(element))).toBe('1 Tankstelle im Umkreis von 5 km um Esso');
    context.httpTesting.expectNone(request => request.url === STATIONS_URL);
  });
});
