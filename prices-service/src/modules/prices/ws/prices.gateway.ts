import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import {
  SUPPORTED_EXCHANGES,
  SUPPORTED_RANGES,
  SupportedExchange,
  SupportedRange,
} from '../../../common/constants/prices.constants';
import { PriceStreamService } from '../services/price-stream.service';

@WebSocketGateway({
  path: '/ws/prices',
})
export class PricesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PricesGateway.name);

  constructor(private readonly priceStreamService: PriceStreamService) { }

  handleConnection(client: WebSocket, request: Request & { url?: string; }): void {
    const url = new URL(request.url ?? '', 'http://localhost');

    const symbol = (url.searchParams.get('symbol') ?? '').trim().toUpperCase();
    const exchanges = this.parseExchanges(url.searchParams.get('exchanges'));
    const range = this.parseRange(url.searchParams.get('range'));

    if (!symbol || !exchanges.length) {
      client.close();
      return;
    }

    this.priceStreamService.registerClient(client, {
      symbol,
      exchanges,
      range,
    });

    this.logger.debug(
      `WS client connected: symbol=${symbol}, range=${range}, exchanges=${exchanges.join(',')}`,
    );
  }

  handleDisconnect(client: WebSocket): void {
    this.priceStreamService.unregisterClient(client);
  }

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() _payload: unknown,
  ): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'pong' }));
    }
  }

  private parseExchanges(value: string | null): SupportedExchange[] {
    if (!value) {
      return [...SUPPORTED_EXCHANGES];
    }

    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(
        (item): item is SupportedExchange =>
          SUPPORTED_EXCHANGES.includes(item as SupportedExchange),
      );
  }

  private parseRange(value: string | null): SupportedRange {
    if (!value) {
      return '1h';
    }

    return SUPPORTED_RANGES.includes(value as SupportedRange)
      ? (value as SupportedRange)
      : '1h';
  }
}