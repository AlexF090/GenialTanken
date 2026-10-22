import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * The free Render instance sleeps without traffic. The web app calls this on start, through the
 * Worker's `/api` proxy, so the API wakes up while the browser still asks for the location.
 * Unthrottled, so it never uses up the rate limit of the first stations search.
 */
@ApiTags('health')
@SkipThrottle()
@Controller('wake-up')
export class WakeUpController {
  @Get()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Wakes the API up; does nothing else.' })
  @ApiNoContentResponse({ description: 'The application is up.' })
  wakeUp(): void {
    return;
  }
}
