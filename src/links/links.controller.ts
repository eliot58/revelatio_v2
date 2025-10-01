import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { LinksService } from './links.service';
import { AuthGuard } from '../auth/auth.guard';
import { RequestWithAuth } from '../auth/auth.types';

@Controller('links')
export class LinksController {
    constructor(
        private readonly linksService: LinksService
    ) { }

    @Get('request')
    @UseGuards(AuthGuard)
    async request(@Req() req: RequestWithAuth, @Query("chat") chat: string) {
        return this.linksService.requestLink(req.tgId, chat);
    }
}
