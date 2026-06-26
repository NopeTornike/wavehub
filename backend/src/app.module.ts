import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './users/user.entity';

const useDatabase = Boolean(process.env.DATABASE_HOST) && process.env.USE_FILE_STORE !== 'true';

@Module({
  imports: [
    ...(useDatabase
      ? [
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DATABASE_HOST,
            port: Number(process.env.DATABASE_PORT) || 5432,
            username: process.env.DATABASE_USER || 'wavehub',
            password: process.env.DATABASE_PASSWORD || 'wavehubpass',
            database: process.env.DATABASE_NAME || 'wavehubdb',
            entities: [User],
            synchronize: process.env.TYPEORM_SYNC === 'true',
          }),
        ]
      : []),
    AuthModule,
  ],
})
export class AppModule {}
