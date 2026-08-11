import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Roles } from '../../../shared/auth/guards';
import { OffsetPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole } from '../../user/domain/user.entity';
import { ArtistService } from '../application/artist.service';
import { ArtistTier } from '../domain/artist.entity';

class AdminArtistQuery extends OffsetPaginationQuery {
  @IsOptional() @IsEnum(ArtistTier) tier?: ArtistTier;
}

class SelectedMasterDto {
  @IsBoolean() value: boolean;
}

class TierDto {
  @IsEnum(ArtistTier) tier: ArtistTier;
}

@Controller('admin/artists')
@Roles(UserRole.ADMIN)
export class AdminArtistController {
  constructor(private readonly artistService: ArtistService) {}

  @Get()
  list(@Query() query: AdminArtistQuery) {
    return this.artistService.listForAdmin(query);
  }

  @Get('selected-masters')
  masters() {
    return this.artistService.getSelectedMasters();
  }

  @Patch(':id/selected-master')
  setMaster(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SelectedMasterDto) {
    return this.artistService.setSelectedMaster(id, dto.value);
  }

  @Patch(':id/tier')
  setTier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TierDto) {
    return this.artistService.setTier(id, dto.tier);
  }
}
