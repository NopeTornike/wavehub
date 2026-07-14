import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './users/user.entity';

// Used by the TypeORM CLI (migration:generate / migration:run / migration:revert — see
// package.json scripts) and, in future phases, by tests that need a real DB connection outside
// of Nest's DI container. Keep the entity list here in sync with app.module.ts — Nest's
// TypeOrmModule.forRoot() call is the one the running app actually uses; this DataSource exists
// for the CLI only.
// The TypeORM CLI (typeorm-ts-node-commonjs) requires this file to have exactly one export —
// don't add a second named export alongside this one, even if it points at the same instance.
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER || 'wavehub',
  password: process.env.DATABASE_PASSWORD || 'wavehubpass',
  database: process.env.DATABASE_NAME || 'wavehubdb',
  entities: [User],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});

export default AppDataSource;
