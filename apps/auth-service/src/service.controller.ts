import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class ServiceController {
  @MessagePattern({ cmd: 'auth.health' })
  health() { return { status: 'ok', service: 'auth-service' }; }
}
