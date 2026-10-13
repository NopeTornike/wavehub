import { ServiceUnavailableException } from '@nestjs/common';
import { MaintenanceGuard } from './maintenance.guard';
import { PlatformSettingsService } from './platform-settings.service';

function ctx(method: string, path: string, cookie?: string) {
  const setHeader = jest.fn();
  return {
    setHeader,
    context: {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method, path, cookies: cookie ? { wavehub_session: cookie } : {} }),
        getResponse: () => ({ setHeader }),
      }),
    } as any,
  };
}

function build(opts: { maintenance: boolean; adminFor?: Record<string, string | null> }) {
  const settings = { isMaintenanceMode: jest.fn(async () => opts.maintenance) } as any;
  const sessions = {
    verify: jest.fn((token: string) => {
      if (!(token in (opts.adminFor ?? {}))) throw new Error('bad token');
      return { sub: token };
    }),
  } as any;
  const users = { findById: jest.fn(async (id: string) => ({ id, adminRole: opts.adminFor?.[id] ?? null })) } as any;
  return { guard: new MaintenanceGuard(settings, sessions, users), settings };
}

describe('MaintenanceGuard', () => {
  it('lets everything through when maintenance is off', async () => {
    const { guard } = build({ maintenance: false });
    await expect(guard.canActivate(ctx('POST', '/orders').context)).resolves.toBe(true);
  });

  it('never blocks safe methods, and does not even read the flag for them', async () => {
    const { guard, settings } = build({ maintenance: true });
    for (const m of ['GET', 'HEAD', 'OPTIONS']) {
      await expect(guard.canActivate(ctx(m, '/listings').context)).resolves.toBe(true);
    }
    expect(settings.isMaintenanceMode).not.toHaveBeenCalled();
  });

  it('503s an anonymous or non-admin mutating request, with Retry-After and a maintenance marker', async () => {
    const { guard } = build({ maintenance: true, adminFor: { user1: null } });
    const anon = ctx('POST', '/orders');
    await expect(guard.canActivate(anon.context)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(anon.setHeader).toHaveBeenCalledWith('Retry-After', '300');
    const user = ctx('DELETE', '/listings/x/packages/y', 'user1');
    const err = await guard.canActivate(user.context).catch((e) => e);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toMatchObject({ maintenance: true });
  });

  it('exempts staff accounts, judged by the DB role, not the token', async () => {
    const { guard } = build({ maintenance: true, adminFor: { admin1: 'super_admin' } });
    await expect(guard.canActivate(ctx('POST', '/admin/platform-settings', 'admin1').context)).resolves.toBe(true);
  });

  it('treats an invalid/expired session as a non-admin', async () => {
    const { guard } = build({ maintenance: true, adminFor: { admin1: 'super_admin' } });
    await expect(guard.canActivate(ctx('POST', '/orders', 'forged').context)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each(['/payments/bog/callback', '/subscriptions/bog-callback', '/auth/login', '/auth/logout', '/Payments/BOG/callback/'])(
    'keeps %s working during maintenance',
    async (path) => {
      const { guard } = build({ maintenance: true });
      await expect(guard.canActivate(ctx('POST', path).context)).resolves.toBe(true);
    },
  );

  it('still blocks other auth writes such as registration', async () => {
    const { guard } = build({ maintenance: true });
    await expect(guard.canActivate(ctx('POST', '/auth/register').context)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('PlatformSettingsService.isMaintenanceMode', () => {
  function svc(rows: any[]) {
    let i = 0;
    const repo = {
      findOne: jest.fn(async () => (rows[Math.min(i++, rows.length - 1)] ?? null)),
      update: jest.fn(async () => undefined),
    } as any;
    return { service: new PlatformSettingsService(repo), repo };
  }

  it('caches the value briefly, refreshes on update, and fails open when the row is unreadable', async () => {
    const { service, repo } = svc([{ maintenanceMode: true }]);
    expect(await service.isMaintenanceMode()).toBe(true);
    expect(await service.isMaintenanceMode()).toBe(true);
    expect(repo.findOne).toHaveBeenCalledTimes(1);

    const off = svc([{ maintenanceMode: true }, { maintenanceMode: false }]);
    expect(await off.service.isMaintenanceMode()).toBe(true);
    await off.service.update({ maintenanceMode: false } as any);
    expect(await off.service.isMaintenanceMode()).toBe(false);

    expect(await svc([null]).service.isMaintenanceMode()).toBe(false);
  });
});
