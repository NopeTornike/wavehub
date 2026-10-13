import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPage } from './content-page.entity';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { AdminContentController } from './admin-content.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContentPage]), AuthModule, AdminModule],
  controllers: [ContentController, AdminContentController],
  providers: [ContentService],
})
export class ContentModule {}
