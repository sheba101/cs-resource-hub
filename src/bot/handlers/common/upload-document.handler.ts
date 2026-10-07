/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Action, Ctx, On, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

import { ExternalResourceService } from 'src/external/services/external-resource.service';

import { AddMaterialHandler } from '../admin/materials/add-material.handler';
import { AddExamHandler } from '../admin/exams/add-exam.handler';

import {
  BotEvent,
  BotEventService,
  BotEventType,
} from '../../services/bot-event.service';

import {
  UploadSession,
  UploadSessionService,
} from '../../services/upload-session.service';

@Update()
export class UploadDocumentHandler {
  private readonly logger = new Logger(UploadDocumentHandler.name);

  private readonly storageChannelId: string;

  constructor(
    private readonly uploadSessionService: UploadSessionService,
    private readonly botEventService: BotEventService,
    private readonly configService: ConfigService,
    private readonly addMaterialHandler: AddMaterialHandler,
    private readonly addExamHandler: AddExamHandler,
    private readonly externalResourceService: ExternalResourceService,
  ) {
    this.storageChannelId =
      this.configService.get<string>('MATERIAL_STORAGE_CHANNEL_ID') ?? '';

    this.logger.log('🔥 UploadDocumentHandler INITIALIZED');
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getUserId(ctx: Context): number | undefined {
    return ctx.from?.id;
  }

  private getUserName(ctx: Context): string {
    if (!ctx.from) {
      return 'unknown';
    }

    if (ctx.from.username) {
      return `@${ctx.from.username}`;
    }

    return (
      [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') ||
      'unknown'
    );
  }

  private logAction(ctx: Context, action: string, extra?: unknown): void {
    const userId = ctx.from?.id;
    const user = this.getUserName(ctx);

    this.logger.log(
      `user=${user} userId=${userId} action=${action}${
        extra ? ` data=${JSON.stringify(extra)}` : ''
      }`,
    );
  }

  private async safeAnswerCbQuery(ctx: Context, text?: string): Promise<void> {
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(text);
      }
    } catch (error) {
      this.logger.debug(
        `Callback query already answered or unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private getWorkflowName(workflow: UploadSession['workflow']): string {
    return workflow === 'MATERIAL' ? '📚 ملزمة' : '📝 اختبار';
  }

  private getEventName(event: BotEventType): string {
    switch (event) {
      case BotEventType.WAITING_MATERIAL_DOCUMENT:
        return 'بانتظار ملف الملزمة';

      case BotEventType.WAITING_MATERIAL_TITLE:
        return 'بانتظار عنوان الملزمة';

      case BotEventType.WAITING_EXAM_DOCUMENT:
        return 'بانتظار ملف الاختبار';

      case BotEventType.WAITING_EXAM_TITLE:
        return 'بانتظار عنوان الاختبار';

      case BotEventType.WAITING_EXTERNAL_RESOURCE_DOCUMENT:
        return 'بانتظار ملف المصدر الخارجي';

      case BotEventType.WAITING_EXTERNAL_RESOURCE_CAPTION:
        return 'بانتظار كابشن المصدر الخارجي';

      case BotEventType.WAITING_EXTERNAL_CATEGORY_NAME:
        return 'بانتظار اسم التصنيف الخارجي';

      case BotEventType.WAITING_COURSE_NAME:
        return 'بانتظار اسم الكورس';

      case BotEventType.WAITING_DELETE_USER:
        return 'بانتظار بيانات المستخدم للحذف';

      case BotEventType.WAITING_PROMOTE_USER:
        return 'بانتظار بيانات المستخدم للترقية';

      case BotEventType.WAITING_DEMOTE_ADMIN:
        return 'بانتظار بيانات الأدمن لخفض الرتبة';

      case BotEventType.PROCESSING:
        return 'جاري المعالجة';

      default:
        return String(event);
    }
  }

  private buildSessionDescription(
    session: UploadSession,
    event: BotEventType,
  ): string {
    return [
      this.getWorkflowName(session.workflow),
      `الحالة: ${this.getEventName(event)}`,
    ].join('\n');
  }

  // ============================================================
  // DOCUMENT
  // ============================================================

  @On('document')
  async onDocument(@Ctx() ctx: Context): Promise<void> {
    const userId = this.getUserId(ctx);

    this.logger.log(`DOCUMENT EVENT received userId=${userId}`);

    if (!userId) {
      return;
    }

    const message = ctx.message;

    if (!message || !('document' in message) || !message.document) {
      return;
    }

    const telegramFileId = message.document.file_id;

    this.logAction(ctx, 'DOCUMENT_RECEIVED', {
      telegramFileId,
    });

    // ============================================================
    // Get Bot Event
    // ============================================================

    const event = this.botEventService.get(userId);

    if (!event) {
      this.logger.debug(
        `DOCUMENT ignored: no active bot event userId=${userId}`,
      );

      return;
    }

    this.logger.log(
      `DOCUMENT event=${this.getEventName(event.event)} userId=${userId}`,
    );

    // ============================================================
    // EXTERNAL RESOURCE DOCUMENT
    //
    // مهم:
    // يجب معالجة المصدر الخارجي قبل uploadSession
    // لأن المصدر الخارجي لا يستخدم UploadSessionService.
    // ============================================================

    if (event.event === BotEventType.WAITING_EXTERNAL_RESOURCE_DOCUMENT) {
      await this.handleExternalResourceDocument(ctx, message, event);

      return;
    }

    // ============================================================
    // MATERIAL DOCUMENT
    // ============================================================

    if (event.event === BotEventType.WAITING_MATERIAL_DOCUMENT) {
      await this.addMaterialHandler.handleDocument(ctx);
      return;
    }

    // ============================================================
    // EXAM DOCUMENT
    // ============================================================

    if (event.event === BotEventType.WAITING_EXAM_DOCUMENT) {
      await this.addExamHandler.handleDocument(ctx);
      return;
    }

    // ============================================================
    // Get temporary upload session
    //
    // فقط Material / Exam يحتاجون UploadSession
    // ============================================================

    const session = this.uploadSessionService.get(userId);

    if (!session) {
      this.logger.warn(
        `DOCUMENT ignored: bot event exists but upload session missing ` +
          `userId=${userId}`,
      );

      this.botEventService.delete(userId);

      return;
    }

    // ============================================================
    // Another pending file exists
    // ============================================================

    if (session.pendingFileId) {
      this.logger.warn(
        `Another pending document already exists userId=${userId}`,
      );

      await ctx.reply(
        '⚠️ لديك ملف جديد بانتظار القرار أيضاً.\n\n' +
          'اختر العملية الحالية أولاً.',
      );

      return;
    }

    // ============================================================
    // WAITING DOCUMENT
    // ============================================================

    const eventType = Number(event.event);

    const waitingDocument =
      eventType === BotEventType.WAITING_MATERIAL_DOCUMENT ||
      eventType === BotEventType.WAITING_EXAM_DOCUMENT;

    if (waitingDocument) {
      this.uploadSessionService.setFile(userId, telegramFileId);

      const nextEvent =
        session.workflow === 'MATERIAL'
          ? BotEventType.WAITING_MATERIAL_TITLE
          : BotEventType.WAITING_EXAM_TITLE;

      this.botEventService.update(userId, {
        event: nextEvent,
      });

      this.logAction(ctx, 'DOCUMENT_ACCEPTED', {
        workflow: session.workflow,
        courseOfferingId: session.courseOfferingId,
        type: session.type,
        telegramFileId,
      });

      await ctx.reply('📄 تم استلام الملف بنجاح.\n\n' + '✏️ الآن أرسل عنوانه.');

      return;
    }

    // ============================================================
    // WAITING TITLE
    // ============================================================

    const waitingTitle =
      event.event === BotEventType.WAITING_MATERIAL_TITLE ||
      event.event === BotEventType.WAITING_EXAM_TITLE;

    if (waitingTitle) {
      this.uploadSessionService.setPendingFile(userId, telegramFileId);

      this.logAction(ctx, 'SECOND_DOCUMENT_RECEIVED', {
        workflow: session.workflow,
        oldFileId: session.telegramFileId,
        newFileId: telegramFileId,
      });

      await ctx.reply(
        '⚠️ لديك عملية رفع قائمة بالفعل.\n\n' +
          `${this.buildSessionDescription(session, event.event)}\n\n` +
          'لقد أرسلت ملف PDF جديداً قبل إكمال العملية القديمة.\n\n' +
          'هل تريد إلغاء الملف القديم والمتابعة بالملف الجديد؟',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '❌ إلغاء القديمة والمتابعة',
                  callback_data: 'uw/c',
                },
              ],
              [
                {
                  text: '↩️ العودة للعملية القديمة',
                  callback_data: 'uw/r',
                },
              ],
            ],
          },
        },
      );

      return;
    }

    // ============================================================
    // PROCESSING
    // ============================================================

    if (event.event === BotEventType.PROCESSING) {
      await ctx.reply(
        '⏳ العملية السابقة ما زالت قيد المعالجة.\n\n' + 'انتظر حتى تكتمل.',
      );

      return;
    }
  }

  // ============================================================
  // EXTERNAL RESOURCE DOCUMENT
  // ============================================================

  private async handleExternalResourceDocument(
    ctx: Context,
    message: any,
    event: BotEvent,
  ): Promise<void> {
    const userId = this.getUserId(ctx);

    if (!userId) {
      return;
    }

    // ============================================================
    // Category ID
    // ============================================================

    const categoryId =
      typeof event.data?.categoryId === 'number'
        ? event.data.categoryId
        : undefined;

    if (categoryId === undefined) {
      this.logger.warn(
        `EXTERNAL RESOURCE: categoryId missing userId=${userId}`,
      );

      this.botEventService.delete(userId);

      await ctx.reply(
        '❌ حدث خطأ في بيانات العملية.\n\n' + 'أعد عملية إضافة المصدر من جديد.',
      );

      return;
    }

    // ============================================================
    // Get category
    // ============================================================

    let category;

    try {
      category = await this.externalResourceService.getCategory(categoryId);
    } catch (error) {
      this.logger.error(
        `EXTERNAL RESOURCE: category not found ` +
          `categoryId=${categoryId} userId=${userId}`,
        error instanceof Error ? error.stack : String(error),
      );

      this.botEventService.delete(userId);

      await ctx.reply(
        '❌ التصنيف الذي اخترته لم يعد موجودًا.\n\n' +
          'أعد عملية إضافة المصدر من جديد.',
      );

      return;
    }

    // ============================================================
    // Make sure category is a leaf category
    // ============================================================

    const hasChildren =
      await this.externalResourceService.categoryHasChildren(categoryId);

    if (hasChildren) {
      this.botEventService.delete(userId);

      await ctx.reply(
        '⚠️ لا يمكن إضافة مصدر داخل هذا التصنيف.\n\n' +
          'اختر تصنيفًا فرعيًا نهائيًا.',
      );

      return;
    }

    // ============================================================
    // Chat ID
    // ============================================================

    const chatId = ctx.chat?.id;

    if (chatId === undefined) {
      await ctx.reply('❌ تعذر تحديد المحادثة.');

      return;
    }

    const telegramChatId = String(chatId);

    // ============================================================
    // Message ID
    // ============================================================

    const telegramMessageId = message.message_id;

    // ============================================================
    // File ID
    // ============================================================

    const telegramFileId =
      typeof message.document?.file_id === 'string'
        ? message.document.file_id
        : undefined;

    if (!telegramFileId) {
      this.logger.warn(
        `EXTERNAL RESOURCE: telegramFileId missing userId=${userId}`,
      );

      await ctx.reply(
        '❌ تعذر الحصول على ملف PDF.\n\n' + 'أعد إرسال الملف من جديد.',
      );

      return;
    }

    // ============================================================
    // File name
    //
    // نستخدم اسم الملف كـ title
    // والكابشن سيكون رسالة النص التالية.
    // ============================================================

    const title =
      typeof message.document?.file_name === 'string' &&
      message.document.file_name.trim()
        ? message.document.file_name.trim()
        : 'مصدر خارجي';

    // ============================================================
    // Update Bot Event
    // ============================================================

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_EXTERNAL_RESOURCE_CAPTION,

      messageId: telegramMessageId,

      chatId: telegramChatId,

      data: {
        ...(event.data ?? {}),

        categoryId,

        telegramChatId,

        telegramMessageId,

        telegramFileId,

        title,

        originalMessageId: telegramMessageId,

        originalCaption:
          typeof message.caption === 'string' ? message.caption : undefined,
      },
    });

    // ============================================================
    // Log
    // ============================================================

    this.logAction(ctx, 'EXTERNAL_RESOURCE_DOCUMENT_ACCEPTED', {
      categoryId,
      categoryName: category.name,
      title,
      telegramFileId,
      telegramChatId,
      telegramMessageId,
    });

    // ============================================================
    // Ask for caption
    // ============================================================

    await ctx.reply(
      '📄 <b>تم استلام ملف PDF بنجاح</b>\n\n' +
        `📁 التصنيف: <b>${category.name}</b>\n` +
        `📄 الملف: <b>${title}</b>\n\n` +
        '📝 الآن أرسل <b>الكابشن / وصف المصدر</b>.',
      {
        parse_mode: 'HTML',
      },
    );
  }

  // ============================================================
  // CANCEL OLD + CONTINUE WITH NEW FILE
  // ============================================================

  @Action('uw/c')
  async cancelOldAndContinue(@Ctx() ctx: Context): Promise<void> {
    const userId = this.getUserId(ctx);

    if (!userId) {
      await this.safeAnswerCbQuery(ctx, 'تعذر تحديد المستخدم');

      return;
    }

    this.logAction(ctx, 'CANCEL_OLD_AND_CONTINUE');

    const event = this.botEventService.get(userId);

    if (!event) {
      await this.safeAnswerCbQuery(ctx, 'لا توجد عملية رفع');

      return;
    }

    const waitingTitle =
      event.event === BotEventType.WAITING_MATERIAL_TITLE ||
      event.event === BotEventType.WAITING_EXAM_TITLE;

    if (!waitingTitle) {
      await this.safeAnswerCbQuery(ctx, 'العملية ليست بانتظار العنوان');

      return;
    }

    const session = this.uploadSessionService.get(userId);

    if (!session) {
      await this.safeAnswerCbQuery(ctx, 'لا توجد بيانات العملية');

      this.botEventService.delete(userId);

      return;
    }

    if (!session.pendingFileId) {
      await this.safeAnswerCbQuery(ctx, 'لا يوجد ملف جديد');

      return;
    }

    const updated = this.uploadSessionService.replaceWithPendingFile(userId);

    if (!updated) {
      await this.safeAnswerCbQuery(ctx, 'تعذر تحديث العملية');

      return;
    }

    await this.safeAnswerCbQuery(ctx, 'تم اعتماد الملف الجديد');

    try {
      if (
        ctx.callbackQuery &&
        'message' in ctx.callbackQuery &&
        ctx.callbackQuery.message
      ) {
        await ctx.editMessageText(
          '✅ تم إلغاء الملف القديم.\n\n' +
            '📄 تم اعتماد الملف الجديد.\n\n' +
            '✏️ الآن أرسل عنوانه.',
        );
      } else {
        await ctx.reply(
          '✅ تم إلغاء الملف القديم.\n\n' +
            '📄 تم اعتماد الملف الجديد.\n\n' +
            '✏️ الآن أرسل عنوانه.',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to edit confirmation message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      await ctx.reply(
        '✅ تم اعتماد الملف الجديد.\n\n' + '✏️ الآن أرسل عنوانه.',
      );
    }
  }

  // ============================================================
  // RETURN TO OLD
  // ============================================================

  @Action('uw/r')
  async returnToOld(@Ctx() ctx: Context): Promise<void> {
    const userId = this.getUserId(ctx);

    if (!userId) {
      await this.safeAnswerCbQuery(ctx, 'تعذر تحديد المستخدم');

      return;
    }

    this.logAction(ctx, 'RETURN_TO_OLD');

    const event = this.botEventService.get(userId);

    if (!event) {
      await this.safeAnswerCbQuery(ctx, 'لا توجد عملية رفع');

      return;
    }

    const waitingTitle =
      event.event === BotEventType.WAITING_MATERIAL_TITLE ||
      event.event === BotEventType.WAITING_EXAM_TITLE;

    if (!waitingTitle) {
      await this.safeAnswerCbQuery(ctx, 'العملية غير صالحة حالياً');

      return;
    }

    const session = this.uploadSessionService.get(userId);

    if (!session) {
      await this.safeAnswerCbQuery(ctx, 'لا توجد بيانات العملية');

      this.botEventService.delete(userId);

      return;
    }

    if (!session.pendingFileId) {
      await this.safeAnswerCbQuery(ctx, 'لا يوجد ملف جديد');

      return;
    }

    const updated = this.uploadSessionService.restoreOldFile(userId);

    if (!updated) {
      await this.safeAnswerCbQuery(ctx, 'تعذر استعادة العملية');

      return;
    }

    await this.safeAnswerCbQuery(ctx, 'تم تجاهل الملف الجديد');

    try {
      if (
        ctx.callbackQuery &&
        'message' in ctx.callbackQuery &&
        ctx.callbackQuery.message
      ) {
        await ctx.editMessageText(
          '↩️ تم تجاهل الملف الجديد.\n\n' +
            '✅ تم الرجوع إلى العملية القديمة.\n\n' +
            '✏️ الآن أرسل عنوان الملف القديم.',
        );
      } else {
        await ctx.reply(
          '↩️ تم تجاهل الملف الجديد.\n\n' + '✏️ أرسل عنوان الملف القديم.',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to edit return message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      await ctx.reply(
        '↩️ تم الرجوع إلى العملية القديمة.\n\n' + '✏️ أرسل عنوان الملف القديم.',
      );
    }
  }
}
