import { Controller, Get, Render } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('/debug-sentry')
  getError() {
    throw new Error('My first Sentry error!');
  }

  @Get()
  @Render('index.hbs')
  root() {}
}
