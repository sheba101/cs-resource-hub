import { Ctx, On, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';

import { AddMaterialHandler } from '../admin/materials/add-material.handler';
import { AddCourseHandler } from '../admin/courses/add-course.handler';
import { EditCourseHandler } from '../admin/courses/edit-course.handler';
import { AddExamHandler } from '../admin/exams/add-exam.handler';
import { PromoteUserHandler } from '../admin/users/promote-user.handler';
import { DemoteAdminHandler } from '../admin/users/demote-user.handler';

import { ExternalResourceService } from 'src/external/services/external-resource.service';

@Update()
export class CentralTextHandler {
  constructor(
    private readonly botEventService: BotEventService,
    private readonly addCourseHandler: AddCourseHandler,
    private readonly editCourseHandler: EditCourseHandler,
    private readonly addMaterialHandler: AddMaterialHandler,
    private readonly addExamHandler: AddExamHandler,
    private readonly pomoteUserHandler: PromoteUserHandler,
    private readonly demoteAdminHandler: DemoteAdminHandler,
    private readonly externalResourceService: ExternalResourceService,
  ) {}

  // ============================================================
  // Text Handler
  // ============================================================

  @On('text')
  async handleText(@Ctx() ctx: Context): Promise<void> {
    console.log('[CentralTextHandler] IN TEXT Handler');

    // ============================================================
    // User ID
    // ============================================================

    const userId = ctx.from?.id;

    if (!userId) {
      console.log('[CentralTextHandler] No userId');
      return;
    }

    // ============================================================
    // التأكد أن الرسالة تحتوي على Text
    // ============================================================

    if (!ctx.message || !('text' in ctx.message)) {
      console.log(
        `[CentralTextHandler] Message does not contain text userId=${userId}`,
      );

      return;
    }

    console.log(
      `[CentralTextHandler] TEXT userId=${userId}:`,
      ctx.message.text,
    );

    // ============================================================
    // الحصول على Event
    // ============================================================

    const event = this.botEventService.get(userId);

    // ============================================================
    // لا توجد عملية قيد التنفيذ
    // ============================================================

    if (!event) {
      console.log(`[CentralTextHandler] NO EVENT userId=${userId}`);

      return;
    }

    // ============================================================
    // Log للحالة الحالية
    // ============================================================

    console.log(
      `[CentralTextHandler] EVENT userId=${userId} event=${event.event}`,
      event.data,
    );

    // ============================================================
    // Routing
    // ============================================================

    switch (event.event) {
      // ==========================================================
      // إضافة كورس
      // ==========================================================

      case BotEventType.WAITING_COURSE_NAME: {
        await this.addCourseHandler.handleCourseName(ctx);
        return;
      }

      // ==========================================================
      // تعديل كورس - اسم الكورس القديم
      // ==========================================================

      case BotEventType.WAITING_EDIT_COURSE_NAME: {
        await this.editCourseHandler.handleCourseName(ctx);
        return;
      }

      // ==========================================================
      // إضافة عنوان ملزمة
      // ==========================================================

      case BotEventType.WAITING_MATERIAL_TITLE: {
        await this.addMaterialHandler.receiveTitle(ctx, ctx.message.text);

        return;
      }

      // ==========================================================
      // إضافة تصنيف خارجي
      // ==========================================================

      case BotEventType.WAITING_EXTERNAL_CATEGORY_NAME: {
        const categoryName = ctx.message.text.trim();

        // --------------------------------------------------------
        // التحقق من الاسم
        // --------------------------------------------------------

        if (!categoryName) {
          await ctx.reply('❌ اسم التصنيف لا يمكن أن يكون فارغًا.');

          return;
        }

        // --------------------------------------------------------
        // Parent ID
        // --------------------------------------------------------

        const parentId =
          typeof event.data?.parentId === 'number'
            ? event.data.parentId
            : undefined;

        // --------------------------------------------------------
        // إنشاء التصنيف
        // --------------------------------------------------------

        await this.externalResourceService.createCategory({
          name: categoryName,

          ...(parentId !== undefined
            ? {
                parent: {
                  connect: {
                    id: parentId,
                  },
                },
              }
            : {}),
        });

        // --------------------------------------------------------
        // حذف Event
        // --------------------------------------------------------

        this.botEventService.delete(userId);

        // --------------------------------------------------------
        // الرد
        // --------------------------------------------------------

        await ctx.reply(
          `✅ <b>تمت إضافة التصنيف بنجاح</b>\n\n` +
            `📁 التصنيف: <b>${categoryName}</b>`,
          {
            parse_mode: 'HTML',
          },
        );

        return;
      }

      // ==========================================================
      // إضافة المصدر الخارجي - الكابشن
      // ==========================================================
      //
      // التدفق:
      //
      // 1. اختيار التصنيف
      // 2. إرسال PDF
      // 3. UploadDocumentHandler يحفظ بيانات الملف
      // 4. يتحول Event إلى:
      //
      //    WAITING_EXTERNAL_RESOURCE_CAPTION
      //
      // 5. المستخدم يرسل الكابشن
      // 6. هنا يتم إنشاء ExternalResource
      //
      // ==========================================================

      case BotEventType.WAITING_EXTERNAL_RESOURCE_CAPTION: {
        const caption = ctx.message.text.trim();

        console.log(
          `[CentralTextHandler] EXTERNAL RESOURCE CAPTION userId=${userId}:`,
          caption,
        );

        // --------------------------------------------------------
        // التحقق من الكابشن
        // --------------------------------------------------------

        if (!caption) {
          await ctx.reply(
            '❌ الكابشن لا يمكن أن يكون فارغًا.\n\n' +
              'أرسل وصفًا أو عنوانًا للمصدر.',
          );

          return;
        }

        // --------------------------------------------------------
        // Category ID
        // --------------------------------------------------------

        const categoryId =
          typeof event.data?.categoryId === 'number'
            ? event.data.categoryId
            : undefined;

        // --------------------------------------------------------
        // Telegram Chat ID
        // --------------------------------------------------------

        const telegramChatId =
          typeof event.data?.telegramChatId === 'string'
            ? event.data.telegramChatId
            : undefined;

        // --------------------------------------------------------
        // Telegram Message ID
        // --------------------------------------------------------

        const telegramMessageId =
          typeof event.data?.telegramMessageId === 'number'
            ? event.data.telegramMessageId
            : undefined;

        // --------------------------------------------------------
        // Telegram File ID
        // --------------------------------------------------------

        const telegramFileId =
          typeof event.data?.telegramFileId === 'string'
            ? event.data.telegramFileId
            : undefined;

        // --------------------------------------------------------
        // عنوان الملف
        // --------------------------------------------------------

        const title =
          typeof event.data?.title === 'string' && event.data.title.trim()
            ? event.data.title.trim()
            : 'مصدر خارجي';

        // --------------------------------------------------------
        // Log البيانات
        // --------------------------------------------------------

        console.log('[CentralTextHandler] EXTERNAL RESOURCE DATA', {
          categoryId,
          title,
          caption,
          telegramChatId,
          telegramMessageId,
          telegramFileId,
        });

        // --------------------------------------------------------
        // التحقق من البيانات
        // --------------------------------------------------------

        if (
          categoryId === undefined ||
          !telegramChatId ||
          telegramMessageId === undefined ||
          !telegramFileId
        ) {
          console.error(
            '[CentralTextHandler] EXTERNAL RESOURCE DATA INVALID',
            event.data,
          );

          await ctx.reply(
            '❌ بيانات المصدر غير مكتملة.\n\n' +
              'أعد عملية إضافة المصدر من جديد.',
          );

          this.botEventService.delete(userId);

          return;
        }

        // --------------------------------------------------------
        // إنشاء المصدر
        // --------------------------------------------------------

        await this.externalResourceService.createResource({
          categoryId,
          title,
          caption,
          telegramChatId,
          telegramMessageId,
          telegramFileId,
        });

        // --------------------------------------------------------
        // حذف Event
        // --------------------------------------------------------

        this.botEventService.delete(userId);

        // --------------------------------------------------------
        // رسالة النجاح
        // --------------------------------------------------------

        await ctx.reply(
          '✅ <b>تمت إضافة المصدر بنجاح</b>\n\n' +
            `📄 الملف: <b>${title}</b>\n` +
            `📝 الكابشن: <b>${caption}</b>`,
          {
            parse_mode: 'HTML',
          },
        );

        console.log(
          `[CentralTextHandler] EXTERNAL RESOURCE CREATED userId=${userId}`,
        );

        return;
      }

      // ==========================================================
      // إضافة عنوان اختبار
      // ==========================================================

      case BotEventType.WAITING_EXAM_TITLE: {
        await this.addExamHandler.receiveTitle(ctx, ctx.message.text);

        return;
      }

      // ==========================================================
      // تعديل كورس - الاسم الجديد
      // ==========================================================

      case BotEventType.WAITING_EDIT_COURSE_NEW_NAME: {
        await this.editCourseHandler.handleNewCourseName(ctx);

        return;
      }

      // ==========================================================
      // ترقية مستخدم إلى Admin
      // ==========================================================

      case BotEventType.WAITING_PROMOTE_USER: {
        await this.pomoteUserHandler.handleUsername(ctx);

        return;
      }

      // ==========================================================
      // إزالة صلاحية Admin
      // ==========================================================

      case BotEventType.WAITING_DEMOTE_ADMIN: {
        await this.demoteAdminHandler.handleUsername(ctx);

        return;
      }

      // ==========================================================
      // Default
      // ==========================================================

      default: {
        console.log(
          `[CentralTextHandler] Unhandled event=${event.event} userId=${userId}`,
        );

        return;
      }
    }
  }
}
