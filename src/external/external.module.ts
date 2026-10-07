import { Module } from '@nestjs/common';

import { ExternalResourceRepository } from './repositories/external-resource.repository';
import { ExternalResourceService } from './services/external-resource.service';

@Module({
  providers: [ExternalResourceRepository, ExternalResourceService],
  exports: [ExternalResourceService],
})
export class ExternalModule {}
