import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { VideoCompressor } from './video-compressor';

@Module({
  providers: [StorageService, VideoCompressor],
  exports: [StorageService, VideoCompressor],
})
export class StorageModule {}
