import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APPLICATION_NAME } from '../../core/application-name';
import { MAIN_CONTENT_IDENTIFIER } from '../../core/navigation/main-content';
import { LEGAL_NOTICE_URL, OPERATOR } from '../../core/operator';
import { ExternalLink } from '../../ui/external-link/external-link';
import { PageHeader } from '../../ui/page-header/page-header';

/**
 * Privacy policy (German), a page of its own like the 404 page. The text describes what the code
 * does: which services the app and its API ask, what is stored in the browser. Change it together
 * with every change to those; the sections follow the data flow.
 */
@Component({
  selector: 'app-privacy-page',
  imports: [ExternalLink, PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPage {
  protected readonly applicationName = APPLICATION_NAME;
  protected readonly mainContentIdentifier = MAIN_CONTENT_IDENTIFIER;
  protected readonly operator = OPERATOR;
  protected readonly legalNoticeUrl = LEGAL_NOTICE_URL;
}
