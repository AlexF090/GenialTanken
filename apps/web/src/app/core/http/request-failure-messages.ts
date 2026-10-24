export const TRY_AGAIN_LATER = 'Bitte versuche es später erneut.';

export const TOO_MANY_REQUESTS_MESSAGE =
  'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.';

export const OFFLINE_MESSAGE =
  'Du bist offline – Preise werden geladen, sobald du wieder verbunden bist.';

const SERVER_UNREACHABLE_MESSAGE =
  'Der Server ist nicht erreichbar. Bitte prüfe deine Internetverbindung.';

/**
 * For a request that got no response at all (status 0). Without a network that is the reason, and
 * the pages load again on their own once it is back.
 */
export const noResponseMessage = (isOnline: boolean): string =>
  isOnline ? SERVER_UNREACHABLE_MESSAGE : OFFLINE_MESSAGE;
