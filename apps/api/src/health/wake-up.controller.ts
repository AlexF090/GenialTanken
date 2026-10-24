import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * The free Render instance sleeps without traffic. The web app calls this on start, through the
 * Worker's `/api` proxy, so the API wakes up while the browser still asks for the location.
 * Rate limited like every other route; the limit counts per route and client, so the call never
 * uses up the budget of the searches.
 */
@ApiTags('health')
@Controller('wake-up')
export class WakeUpController {
  @Get()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Wakes the API up; does nothing else.' })
  @ApiNoContentResponse({ description: 'The application is up.' })
  wakeUp(): void {
    // Nothing to do: receiving the request is what wakes the instance up.
  }
}
