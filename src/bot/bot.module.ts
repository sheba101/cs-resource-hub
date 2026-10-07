import { Module } from '@nestjs/common';

import { UsersModule } from 'src/user/user.module';
import { AcademicModule } from 'src/academic/academic.module';
import { CourseModule } from 'src/course/course.module';
import { MaterialModule } from 'src/material/material.module';
import { ExamModule } from 'src/exam/exam.module';

// Services & Repositories
import { StartHandler } from './handlers/start.handler';
import { UploadSessionService } from './services/upload-session.service';
import { BotEventService } from './services/bot-event.service';
import { BotEventRepository } from './repositories/bot-event.repository';
import { BotEventConflictService } from './services/bot-conflict.service';

// Handlers Bundles
import { UserHandlers } from './handlers/user/user.handlers';
import { AdminHandlers } from './handlers/admin/admin.handlers';
import { CommonHandlers } from './handlers/common/common.handlers';
import { CommandHandlers } from './handlers/commands/command.handlers';
import { ExternalModule } from 'src/external/external.module';

@Module({
  imports: [
    UsersModule,
    AcademicModule,
    CourseModule,
    MaterialModule,
    ExamModule,
    ExternalModule,
  ],
  providers: [
    StartHandler,
    UploadSessionService,
    BotEventService,
    BotEventConflictService,
    BotEventRepository,

    // تسجيل الهاندلرز المجمعة
    ...UserHandlers,
    ...AdminHandlers,
    ...CommonHandlers,
    ...CommandHandlers,
  ],
  exports: [UploadSessionService],
})
export class BotModule {}
