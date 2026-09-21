import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type CreateWavecoinOrderInput = {
  amountGel: number;
  wavecoins: number;
  username: string;
  transactionId: string;
  successUrl: string;
  failUrl: string;
  // Required, not optional: this must always be our own /payments/bog/callback endpoint (the one
  // place that verifies BOG's signature and credits WaveCoin), never a frontend redirect page.
  // The one caller (BogPaymentsController) always constructs and passes it explicitly.
  callbackUrl: string;
};

type CreateSubscriptionOrderInput = {
  amountGel: number;
  planName: string;
  username: string;
  transactionId: string;
  successUrl: string;
  failUrl: string;
  callbackUrl: string;
};

@Injectable()
export class BogPaymentsService {
  private readonly oauthUrl =
    process.env.BOG_OAUTH_URL || 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';
  private readonly ordersUrl =
    process.env.BOG_ORDERS_URL || 'https://api.bog.ge/payments/v1/ecommerce/orders';

  async createWavecoinOrder(input: CreateWavecoinOrderInput) {
    if (!process.env.BOG_CLIENT_ID || !process.env.BOG_CLIENT_SECRET) {
      throw new HttpException('BOG credentials are not configured.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(this.ordersUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_url: input.callbackUrl,
        external_order_id: input.transactionId,
        redirect_urls: {
          success: input.successUrl,
          fail: input.failUrl,
        },
        purchase_units: {
          currency: 'GEL',
          total_amount: input.amountGel,
          basket: [
            {
              quantity: input.wavecoins,
              unit_price: 1,
              product_id: 'wavecoin',
              description: `${input.wavecoins} WaveCoin for ${input.username}`,
            },
          ],
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new HttpException(
        data?.message || data?.error || 'BOG order request failed.',
        response.status || HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      orderId: data?.id || data?.order_id || '',
      redirectUrl: data?._links?.redirect?.href || data?.redirect_url || data?.links?.redirect || '',
    };
  }

  // Same checkout-redirect shape as createWavecoinOrder, kept as a deliberately separate method
  // rather than a shared parameterized one — see backend/src/subscriptions/CLAUDE.md for why (the
  // two flows diverge afterward: this one's order goes on to have its card saved, the WaveCoin one
  // never does, and money-moving code in this repo generally prefers small duplicated methods over
  // a shared abstraction two different callers would need to stay in sync on forever).
  async createSubscriptionOrder(input: CreateSubscriptionOrderInput) {
    if (!process.env.BOG_CLIENT_ID || !process.env.BOG_CLIENT_SECRET) {
      throw new HttpException('BOG credentials are not configured.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(this.ordersUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_url: input.callbackUrl,
        external_order_id: input.transactionId,
        redirect_urls: {
          success: input.successUrl,
          fail: input.failUrl,
        },
        purchase_units: {
          currency: 'GEL',
          total_amount: input.amountGel,
          basket: [
            {
              quantity: 1,
              unit_price: input.amountGel,
              product_id: 'subscription',
              description: `${input.planName} for ${input.username}`,
            },
          ],
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new HttpException(
        data?.message || data?.error || 'BOG order request failed.',
        response.status || HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      orderId: data?.id || data?.order_id || '',
      redirectUrl: data?._links?.redirect?.href || data?.redirect_url || data?.links?.redirect || '',
    };
  }

  // Marks a just-paid order's card as saved for future background charges — must be called only
  // after that order's own status is confirmed `completed` via getOrderDetails (same
  // never-trust-the-callback-body-alone discipline as everywhere else in this module). Per
  // https://api.bog.ge/docs/en/payments/saved-card/offline (fetched 2026-09-17):
  // PUT /payments/v1/orders/:order_id/subscriptions → 202 Accepted, no meaningful response body.
  // From this point on, `orderId` is usable as a `parent_order_id` for chargeSavedCard.
  async saveCard(orderId: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`https://api.bog.ge/payments/v1/orders/${encodeURIComponent(orderId)}/subscriptions`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new HttpException(
        data?.message || data?.error || 'BOG save-card request failed.',
        response.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // The actual background/offline recurring charge — no buyer redirect, no card re-entry. Per
  // https://api.bog.ge/docs/en/payments/saved-card/offline-payment (fetched 2026-09-17):
  // POST /payments/v1/ecommerce/orders/:parent_order_id/subscribe.
  // **Real constraint, not a limitation of this code**: BOG carries the amount, currency, and
  // buyer info forward from the parent order automatically — there is no way to charge a
  // *different* amount than the parent order's original price. This is exactly why a subscription
  // tier change needs a brand-new checkout (a new parent order), not an in-place price change on
  // the existing one — see SubscriptionsService for how that's handled.
  // `externalOrderId` is deliberately always passed explicitly (never left to BOG's "defaults to
  // the parent's value" fallback) so every renewal charge gets its own distinct
  // SubscriptionChargeAttempt row the callback can look up — reusing the parent's id would make
  // every renewal indistinguishable from the original checkout to our own callback handler.
  async chargeSavedCard(parentOrderId: string, externalOrderId: string, callbackUrl: string) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `https://api.bog.ge/payments/v1/ecommerce/orders/${encodeURIComponent(parentOrderId)}/subscribe`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callback_url: callbackUrl, external_order_id: externalOrderId }),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new HttpException(
        data?.message || data?.error || 'BOG recurring charge request failed.',
        response.status || HttpStatus.BAD_GATEWAY,
      );
    }
    return { orderId: data?.id || '' };
  }

  // Authoritative order status lookup, used by the /callback handler instead of trusting fields
  // embedded in the callback body — the callback's signature proves BOG sent *something* for this
  // order_id, but we still re-fetch the current state from BOG's API before crediting anything.
  // Endpoint per https://api.bog.ge/docs/en/payments/standard-process/get-payment-details
  // (fetched 2026-07-15): GET /payments/v1/receipt/:order_id.
  async getOrderDetails(bogOrderId: string): Promise<{
    orderStatus: string;
    externalOrderId: string | undefined;
  }> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`https://api.bog.ge/payments/v1/receipt/${encodeURIComponent(bogOrderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new HttpException(
        data?.message || data?.error || 'BOG order lookup failed.',
        response.status || HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      orderStatus: data?.order_status?.key || '',
      externalOrderId: data?.external_order_id,
    };
  }

  private async getAccessToken() {
    const basicToken = Buffer.from(`${process.env.BOG_CLIENT_ID}:${process.env.BOG_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(this.oauthUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.access_token) {
      throw new HttpException(
        data?.message || data?.error_description || 'BOG authorization failed.',
        response.status || HttpStatus.BAD_GATEWAY,
      );
    }

    return data.access_token as string;
  }
}
