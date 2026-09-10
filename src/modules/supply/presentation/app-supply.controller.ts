import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsInt, IsObject,
  IsOptional, IsString, IsUrl, Length, Matches, Max, Min,
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
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @Length(1, 50) businessNo?: string;
  @IsOptional() @IsString() @Length(0, 100) ecommerceRegNo?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() @Length(1, 500) profileImage?: string;
}

class CreateProductDto {
  @IsString() @Length(2, 200) name: string;
  @IsString() @Length(2, 100) subtitle: string;
  @IsOptional() @IsString() @Length(1, 200) nameEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsEnum(ProductCategory) category: ProductCategory;
  @IsOptional() @IsString() @Length(1, 100) brand?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) priceKrw: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) stock?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  images: string[];
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsString() @Length(1, 500) externalUrl?: string;
  @IsString() @Length(1, 500) @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/open\.kakao\.com(?:\/|$)/i) openChatUrl: string;
  @IsString() @Length(1, 500) @IsUrl({ protocols: ['https'], require_protocol: true })
  storeUrl: string;
}

class UpdateProductDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsString() @Length(2, 100) subtitle?: string;
  @IsOptional() @IsString() @Length(1, 200) nameEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsEnum(ProductCategory) category?: ProductCategory;
  @IsOptional() @IsString() @Length(1, 100) brand?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) priceKrw?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) stock?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  images?: string[];
  @IsOptional() @IsString() @IsUrl({ protocols: ['https'], require_protocol: true }) thumbnail?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsString() @Length(1, 500) @IsUrl({ protocols: ['https'], require_protocol: true }) externalUrl?: string;
  @IsOptional() @IsString() @Length(1, 500) @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/open\.kakao\.com(?:\/|$)/i) openChatUrl?: string;
  @IsOptional() @IsString() @Length(1, 500) @IsUrl({ protocols: ['https'], require_protocol: true }) storeUrl?: string;
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
  createProduct(@CurrentUser('id') userId: string, @Body() dto: CreateProductDto) {
    return this.supplyService.createProduct(userId, dto);
  }

  @Patch('vendors/me/products/:productId')
  updateProduct(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.supplyService.updateProduct(userId, productId, dto);
  }

  @Get('vendors/me/products/:productId')
  myProduct(
    @CurrentUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.supplyService.getMyProduct(userId, productId);
  }

  @Post('products/:productId/inquiry')
  recordProductInquiry(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.supplyService.incrementProductInquiry(productId);
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
