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
