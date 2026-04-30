import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface RealtimeMessage {
  data: { event: string; payload: unknown };
}

@Injectable()
export class RealtimeGateway {
  private readonly subject = new Subject<RealtimeMessage>();

  readonly stream$ = this.subject.asObservable();

  broadcast(event: string, payload: unknown) {
    this.subject.next({ data: { event, payload } });
  }
}
