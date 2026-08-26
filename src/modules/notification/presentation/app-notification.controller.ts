import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../shared/auth/guards';
import { CursorPaginationQuery } from '../../../shared/http/pagination.dto';
import { NotificationService } from '../application/notification.service';

class TokenDto {
  @IsString() @MaxLength(500) token: string;
  @IsEnum(['ios', 'android']) platform: 'ios' | 'android';
  @IsString() @Length(8, 100) installationId: string;
}

class RemoveTokenDto {
  @IsString() @Length(8, 100) installationId: string;
}

class PreferenceDto {
  @IsOptional() @IsBoolean() reservationStatus?: boolean;
  @IsOptional() @IsBoolean() reservationConfirm?: boolean;
  @IsOptional() @IsBoolean() reservationRemind?: boolean;
  @IsOptional() @IsBoolean() procedureDone?: boolean;
  @IsOptional() @IsBoolean() newReply?: boolean;
  @IsOptional() @IsBoolean() favoriteArtist?: boolean;
  @IsOptional() @IsBoolean() favoriteWorkStock?: boolean;
  @IsOptional() @IsBoolean() favoriteSupplyPrice?: boolean;
  @IsOptional() @IsBoolean() shopApplication?: boolean;
  @IsOptional() @IsBoolean() event?: boolean;
  @IsOptional() @IsBoolean() notice?: boolean;
}

@Controller('app/notifications')
export class AppNotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get() list(@CurrentUser('id') userId: string, @Query() query: CursorPaginationQuery) {
    return this.notifications.list(userId, query.cursor, query.limit);
  }
  @Get('unread-count') async unread(@CurrentUser('id') userId: string) {
    return { count: await this.notifications.unreadCount(userId) };
  }
  @Get('preferences') preferences(@CurrentUser('id') userId: string) {
    return this.notifications.getPreferences(userId);
  }
  @Patch('preferences') updatePreferences(@CurrentUser('id') userId: string, @Body() dto: PreferenceDto) {
    return this.notifications.updatePreferences(userId, dto);
  }
  @Post('tokens') registerToken(@CurrentUser('id') userId: string, @Body() dto: TokenDto) {
    return this.notifications.registerToken(userId, dto.token, dto.platform, dto.installationId);
  }
  @Delete('tokens/current') removeToken(@CurrentUser('id') userId: string, @Body() dto: RemoveTokenDto) {
    return this.notifications.removeToken(userId, dto.installationId);
  }
  @Patch('read-all') markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }
  @Patch(':id/read') markRead(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(userId, id);
  }
}
