import * as bcrypt from 'bcrypt';
import { UserStatus } from '@wavehub/shared-types';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  function build(status: UserStatus) {
    const passwordHash = bcrypt.hashSync('Passw0rd!', 4);
    const users = { findOne: jest.fn(async () => ({ id: 'u1', username: 'u', passwordHash, status })) } as any;
    return new AuthService(users, {} as any, {} as any, {} as any);
  }

  it('logs in an active user', async () => {
    await expect(build(UserStatus.Active).login({ username: 'u', password: 'Passw0rd!' })).resolves.toMatchObject({ id: 'u1' });
  });

  it.each([UserStatus.Suspended, UserStatus.Banned])('refuses a %s account even with the right password', async (status) => {
    await expect(build(status).login({ username: 'u', password: 'Passw0rd!' })).rejects.toThrow('ACCOUNT_SUSPENDED');
  });

  it('reports a wrong password as INVALID_CREDENTIALS, not as suspended (no status probing)', async () => {
    await expect(build(UserStatus.Banned).login({ username: 'u', password: 'wrong' })).rejects.toThrow('INVALID_CREDENTIALS');
  });
});
