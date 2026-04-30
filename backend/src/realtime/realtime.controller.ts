import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimeGateway } from './realtime.gateway';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly gateway: RealtimeGateway) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.gateway.stream$ as unknown as Observable<MessageEvent>;
  }
}
