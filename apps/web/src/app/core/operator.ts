/** Operator of GenialTanken, named as controller in the privacy policy. */
export interface Operator {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
}

/**
 * Copied from `siteOperator` in `src/data/site.ts` of the appool.de repository, the single source
 * of the operator's postal address; change it there first, then here. Deliberately without a
 * telephone number: the privacy policy needs none. The postal address appears nowhere else in
 * this app.
 */
export const OPERATOR: Operator = {
  name: 'Alexander Fischenich',
  street: 'Schwester-Firma-Weg 24',
  postalCode: '51143',
  city: 'Köln',
  country: 'Deutschland',
  email: 'kontakt@appool.de',
};

/** The legal notice on appool.de applies to the app on its subdomain as well. */
export const LEGAL_NOTICE_URL = 'https://appool.de/impressum';

/** Support address of this app. */
export const SUPPORT_EMAIL = 'genial-tanken@appool.de';
