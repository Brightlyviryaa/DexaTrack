import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AuthService } from './auth.service';
@Controller()
export class ServiceController {
  constructor(private readonly auth: AuthService) {}
  @MessagePattern({ cmd: 'auth.health' })
  health() { return { status: 'ok', service: 'auth-service' }; }
  @MessagePattern({ cmd: 'auth.execute' })
  execute(payload: { action: string; data: Record<string, unknown>; sessionToken?: string }) {
    return this.auth.execute(payload.action, payload.data ?? {}, payload.sessionToken);
  }
}
