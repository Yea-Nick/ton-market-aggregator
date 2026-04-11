import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AppConfigService } from 'src/common/config/app-config.service';
import { PriceStreamService } from '../services/price-stream.service';

@WebSocketGateway({ path: '/ws/prices' })
export class PricesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PricesGateway.name);
  private readonly heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly socketIds = new WeakMap<WebSocket, string>();

  constructor(
    private readonly streamService: PriceStreamService,
    private readonly config: AppConfigService,
  ) { }

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const id = randomUUID();
    const url = new URL(request.url ?? this.config.wsPath, 'ws://localhost');
    const symbol = (url.searchParams.get('symbol') ?? 'TONUSDT').toUpperCase();
    const exchanges = (url.searchParams.get('exchanges') ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    this.socketIds.set(client, id);
    this.streamService.register({
      id,
      filter: { symbol, exchanges },
      send: (payload) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      },
    });

    client.send(
      JSON.stringify({
        type: 'connection.ready',
        data: { symbol, exchanges, connectedAt: new Date().toISOString() },
      }),
    );

    const timer = setInterval(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    }, this.config.wsHeartbeatMs);

    this.heartbeatTimers.set(id, timer);
    this.logger.log(`WS client connected: ${id}`);
  }

  handleDisconnect(client: WebSocket): void {
    const id = this.socketIds.get(client);
    if (!id) {
      return;
    }

    this.streamService.unregister(id);
    const timer = this.heartbeatTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(id);
    }

    this.logger.log(`WS client disconnected: ${id}`);
  }
}
