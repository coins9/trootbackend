import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { IsEnum, IsOptional } from 'class-validator';
import { Roles } from '../../../shared/auth/guards';
import { OffsetPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole } from '../../user/domain/user.entity';
import { ShopService } from '../application/shop.service';
import { ShopPostCategory } from '../domain/shop-post.entity';

class AdminShopQuery extends OffsetPaginationQuery {
  @IsOptional() @IsEnum(ShopPostCategory) category?: ShopPostCategory;
}

@Controller('admin/shop-posts')
@Roles(UserRole.ADMIN)
export class AdminShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get()
  list(@Query() query: AdminShopQuery) {
    return this.shopService.listForAdmin(query);
  }

  @Patch(':id/hide')
  hide(@Param('id', ParseUUIDPipe) id: string) {
    return this.shopService.hideByAdmin(id);
  }
}
