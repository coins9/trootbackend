import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray, IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Min,
} from 'class-validator';
import { CurrentUser, Public } from '../../../shared/auth/guards';
import { CursorPaginationQuery } from '../../../shared/http/pagination.dto';
import { SupplyService } from '../application/supply.service';
import { ProductCategory } from '../domain/supply.entity';

class ProductListQueryDto extends CursorPaginationQuery {
  @IsOptional() @IsEnum(ProductCategory) category?: ProductCategory;
  @IsOptional() @IsString() @Length(1, 50) keyword?: string;
  @IsOptional() @IsEnum(['recent', 'price_asc', 'price_desc', 'popular'])
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'popular';
}

class VendorApplyDto {
  @IsString() @Length(1, 200) name: string;
  @IsString() @Length(1, 50) businessNo: string;
  @IsOptional() @IsString() @Length(1, 100) ecommerceRegNo?: string;
  @IsEmail() contactEmail: string;
}

class VendorUpdateDto {
  @IsOptional() @IsString() @Length(0, 500) openChatUrl?: string;
}

class ProductDto {
  @IsString() @Length(1, 200) name: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(ProductCategory) category: ProductCategory;
  @IsOptional() @IsString() @Length(1, 100) brand?: string;
  @Type(() => Number) @IsInt() @Min(0) priceKrw: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsString() @Length(1, 500) externalUrl?: string;
}

@Controller('app/supplies')
export class AppSupplyController {
  constructor(private readonly supplyService: SupplyService) {}

  @Public()
  @Get('products')
  list(@Query() query: ProductListQueryDto) {
    return this.supplyService.listProducts(query);
  }

  @Get('vendors/me')
  myVendor(@CurrentUser('id') userId: string) {
    return this.supplyService.getMyVendor(userId);
  }

  @Post('vendors/apply')
  apply(@CurrentUser('id') userId: string, @Body() dto: VendorApplyDto) {
    return this.supplyService.applyVendor(userId, dto);
  }

  @Patch('vendors/me')
  updateVendor(@CurrentUser('id') userId: string, @Body() dto: VendorUpdateDto) {
    return this.supplyService.updateMyVendor(userId, dto);
  }

  @Post('vendors/me/inquiry')
  recordInquiry(@CurrentUser('id') userId: string) {
    return this.supplyService.incrementInquiry(userId);
  }

  @Get('vendors/me/products')
  myProducts(@CurrentUser('id') userId: string) {
    return this.supplyService.listMyProducts(userId);
  }

  @Post('vendors/me/products')
  createProduct(@CurrentUser('id') userId: string, @Body() dto: ProductDto) {
    return this.supplyService.createProduct(userId, dto);
  }

  @Patch('vendors/me/products/:productId')
  updateProduct(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ProductDto,
  ) {
    return this.supplyService.updateProduct(userId, productId, dto);
  }

  @Delete('vendors/me/products/:productId')
  async deleteProduct(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.supplyService.deleteProduct(userId, productId);
    return { deleted: true };
  }

  @Public()
  @Get('products/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplyService.getProduct(id);
  }
}
