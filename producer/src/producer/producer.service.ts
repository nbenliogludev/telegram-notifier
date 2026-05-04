import { Injectable } from '@nestjs/common';

@Injectable()
export class ProducerService {
  getMetadata() {
    return {
      name: 'producer',
      status: 'initialized',
    };
  }
}
