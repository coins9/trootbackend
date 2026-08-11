import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplyService } from './application/supply.service';
import { Product, Settlement, Vendor } from './domain/supply.entity';
import { AdminSupplyController } from './presentation/admin-supply.controller';
import { AppSupplyController } from './presentation/app-supply.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor, Product, Settlement])],
  controllers: [AppSupplyController, AdminSupplyController],
  providers: [SupplyService],
  exports: [SupplyService],
})
export class SupplyModule {}
