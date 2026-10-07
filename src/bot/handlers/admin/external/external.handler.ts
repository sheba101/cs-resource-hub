import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

import { ExternalResourceService } from 'src/external/services/external-resource.service';

import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';

@Update()
export class ExternalHandler {
  // ============================================================
  // Storage Channel
  // ============================================================

  private readonly STORAGE_CHANNEL_ID = process.env.MATERIAL_STORAGE_CHANNEL_ID;

  // ============================================================
  // Constructor
  // ============================================================

  constructor(
    private readonly externalResourceService: ExternalResourceService,
    private readonly botEventService: BotEventService,
  ) {}

  // ============================================================
  // Helpers
  // ============================================================

  private getUserId(ctx: Context): number | undefined {
    return ctx.from?.id;
  }

  private getCallbackData(ctx: Context): string | undefined {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return undefined;
    }

    return typeof callbackQuery.data === 'string'
      ? callbackQuery.data
      : undefined;
  }

  private getCallbackMessageId(ctx: Context): number | undefined {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('message' in callbackQuery)) {
      return undefined;
    }

    const message = callbackQuery.message;

    if (!message) {
      return undefined;
    }

    return message.message_id;
  }

  private getChatId(ctx: Context): string | undefined {
    const chatId = ctx.chat?.id;

    if (chatId === undefined) {
      return undefined;
    }

    return String(chatId);
  }

  private async cancelEvent(ctx: Context): Promise<void> {
    const userId = this.getUserId(ctx);

    if (userId !== undefined) {
      this.botEventService.delete(userId);
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // إدارة المصادر
  // ============================================================

  @Action('admin_sources')
  async handleAdminSources(@Ctx() ctx: Context) {
    await this.cancelEvent(ctx);

    await ctx.editMessageText(
      '🔗 <b>إدارة المصادر الخارجية</b>\n\nاختر العملية المطلوبة:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📁 إضافة تصنيف', 'external_add_category')],
          [Markup.button.callback('📄 إضافة مصدر', 'external_add_resource')],
          [Markup.button.callback('🗑️ حذف تصنيف', 'external_delete_category')],
          [Markup.button.callback('🗑️ حذف مصدر', 'external_delete_resource')],
          [Markup.button.callback('🔙 رجوع', 'back_to_main')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // إضافة تصنيف
  // ============================================================

  @Action('external_add_category')
  async handleAddCategory(@Ctx() ctx: Context) {
    await this.cancelEvent(ctx);

    await ctx.editMessageText(
      '📁 <b>إضافة تصنيف جديد</b>\n\n' + 'اختر مكان التصنيف:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📁 تصنيف رئيسي', 'external_category_root')],
          [
            Markup.button.callback(
              '📂 تحت تصنيف آخر',
              'external_category_parent',
            ),
          ],
          [Markup.button.callback('🔙 رجوع', 'admin_sources')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // إضافة تصنيف رئيسي
  // ============================================================

  @Action('external_category_root')
  async handleRootCategory(@Ctx() ctx: Context) {
    const userId = this.getUserId(ctx);
    const messageId = this.getCallbackMessageId(ctx);
    const chatId = this.getChatId(ctx);

    if (
      userId === undefined ||
      messageId === undefined ||
      chatId === undefined
    ) {
      await ctx.answerCbQuery('تعذر بدء العملية', {
        show_alert: true,
      });

      return;
    }

    this.botEventService.set({
      userId,
      event: BotEventType.WAITING_EXTERNAL_CATEGORY_NAME,
      messageId,
      chatId,
      data: {},
    });

    await ctx.editMessageText(
      '📁 <b>إضافة تصنيف رئيسي</b>\n\n' + 'أرسل اسم التصنيف:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'external_cancel')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // اختيار التصنيف الأب
  // ============================================================

  @Action('external_category_parent')
  async handleCategoryParent(@Ctx() ctx: Context) {
    await this.cancelEvent(ctx);

    const categories = await this.externalResourceService.getRootCategories();

    if (categories.length === 0) {
      await ctx.editMessageText(
        '⚠️ <b>لا توجد تصنيفات رئيسية</b>\n\n' + 'أضف تصنيفًا رئيسيًا أولًا.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '📁 إضافة تصنيف رئيسي',
                'external_category_root',
              ),
            ],
            [Markup.button.callback('🔙 رجوع', 'external_add_category')],
          ]),
        },
      );

      await ctx.answerCbQuery();

      return;
    }

    await ctx.editMessageText(
      '📂 <b>اختيار التصنيف الأب</b>\n\n' +
        'اختر التصنيف الذي تريد إنشاء التصنيف الجديد بداخله:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...categories.map((category) => [
            Markup.button.callback(
              `📁 ${category.name}`,
              `external_category_parent/${category.id}`,
            ),
          ]),
          [Markup.button.callback('🔙 رجوع', 'external_add_category')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // اختيار الأب ثم كتابة اسم التصنيف الفرعي
  // ============================================================

  @Action(/^external_category_parent\/(\d+)$/)
  async handleCategoryParentSelect(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const userId = this.getUserId(ctx);
    const messageId = this.getCallbackMessageId(ctx);
    const chatId = this.getChatId(ctx);

    if (
      userId === undefined ||
      messageId === undefined ||
      chatId === undefined
    ) {
      await ctx.answerCbQuery('تعذر بدء العملية', {
        show_alert: true,
      });

      return;
    }

    const parentId = Number(data.split('/')[1]);

    if (!Number.isInteger(parentId)) {
      await ctx.answerCbQuery('التصنيف الأب غير صحيح', {
        show_alert: true,
      });

      return;
    }

    const parent = await this.externalResourceService.getCategory(parentId);

    this.botEventService.set({
      userId,
      event: BotEventType.WAITING_EXTERNAL_CATEGORY_NAME,
      messageId,
      chatId,
      data: {
        parentId,
      },
    });

    await ctx.editMessageText(
      '📂 <b>إضافة تصنيف فرعي</b>\n\n' +
        `📁 التصنيف الأب: <b>${this.escapeHtml(parent.name)}</b>\n\n` +
        'أرسل اسم التصنيف الجديد:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'external_cancel')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // إضافة مصدر
  // ============================================================

  @Action('external_add_resource')
  async handleAddResource(@Ctx() ctx: Context) {
    await this.cancelEvent(ctx);

    await this.showResourceCategories(ctx, null);

    await ctx.answerCbQuery();
  }

  // ============================================================
  // عرض التصنيفات عند إضافة مصدر
  //
  // parentId = null
  // يعني التصنيفات الرئيسية
  // ============================================================

  private async showResourceCategories(
    ctx: Context,
    parentId: number | null,
  ): Promise<void> {
    const categories =
      parentId === null
        ? await this.externalResourceService.getRootCategories()
        : await this.externalResourceService.getChildCategories(parentId);

    // ============================================================
    // لا توجد تصنيفات
    // ============================================================

    if (categories.length === 0) {
      if (parentId === null) {
        await ctx.editMessageText(
          '⚠️ <b>لا توجد تصنيفات</b>\n\n' +
            'يجب إضافة تصنيف أولًا قبل إضافة مصدر.',
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  '📁 إضافة تصنيف',
                  'external_add_category',
                ),
              ],
              [Markup.button.callback('🔙 رجوع', 'admin_sources')],
            ]),
          },
        );

        return;
      }

      const category = await this.externalResourceService.getCategory(parentId);

      await ctx.editMessageText(
        '📁 <b>التصنيف النهائي</b>\n\n' +
          `📂 التصنيف: <b>${this.escapeHtml(category.name)}</b>\n\n` +
          'لا توجد تصنيفات فرعية هنا.\n' +
          'يمكنك إضافة المصدر داخل هذا التصنيف.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '📄 إضافة المصدر هنا',
                `external_resource_select/${parentId}`,
              ),
            ],
            [Markup.button.callback('🔙 رجوع', 'external_resource_back/ROOT')],
          ]),
        },
      );

      return;
    }

    // ============================================================
    // التصنيفات الرئيسية
    // ============================================================

    if (parentId === null) {
      await ctx.editMessageText('📁 <b>إضافة مصدر</b>\n\n' + 'اختر التصنيف:', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...categories.map((category) => [
            Markup.button.callback(
              `📁 ${category.name}`,
              `external_resource_category/${category.id}`,
            ),
          ]),
          [Markup.button.callback('🔙 رجوع', 'admin_sources')],
        ]),
      });

      return;
    }

    // ============================================================
    // تصنيفات فرعية
    // ============================================================

    const parent = await this.externalResourceService.getCategory(parentId);

    await ctx.editMessageText(
      '📂 <b>اختيار التصنيف</b>\n\n' +
        `📁 داخل: <b>${this.escapeHtml(parent.name)}</b>\n\n` +
        'اختر التصنيف:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...categories.map((category) => [
            Markup.button.callback(
              `📂 ${category.name}`,
              `external_resource_category/${category.id}`,
            ),
          ]),
          [
            Markup.button.callback(
              '📄 إضافة المصدر هنا',
              `external_resource_select/${parentId}`,
            ),
          ],
          [Markup.button.callback('🔙 رجوع', 'external_resource_back/ROOT')],
        ]),
      },
    );
  }

  // ============================================================
  // اختيار تصنيف أثناء إضافة المصدر
  // ============================================================

  @Action(/^external_resource_category\/(\d+)$/)
  async handleResourceCategory(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const categoryId = Number(data.split('/')[1]);

    if (!Number.isInteger(categoryId)) {
      await ctx.answerCbQuery('التصنيف غير صحيح', {
        show_alert: true,
      });

      return;
    }

    const category = await this.externalResourceService.getCategory(categoryId);

    const children =
      await this.externalResourceService.getChildCategories(categoryId);

    // ============================================================
    // لديه أبناء
    // ============================================================

    if (children.length > 0) {
      await ctx.editMessageText(
        '📂 <b>اختيار التصنيف</b>\n\n' +
          `📁 داخل: <b>${this.escapeHtml(category.name)}</b>\n\n` +
          'اختر التصنيف الفرعي:',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            ...children.map((child) => [
              Markup.button.callback(
                `📂 ${child.name}`,
                `external_resource_category/${child.id}`,
              ),
            ]),
            [Markup.button.callback('🔙 رجوع', 'external_resource_back/ROOT')],
          ]),
        },
      );

      await ctx.answerCbQuery();

      return;
    }

    // ============================================================
    // تصنيف نهائي
    // ============================================================

    await this.startExternalResourceUpload(ctx, categoryId, category.name);

    await ctx.answerCbQuery();
  }

  // ============================================================
  // اختيار التصنيف النهائي للمصدر
  // ============================================================

  @Action(/^external_resource_select\/(\d+)$/)
  async handleResourceSelect(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const categoryId = Number(data.split('/')[1]);

    if (!Number.isInteger(categoryId)) {
      await ctx.answerCbQuery('التصنيف غير صحيح', {
        show_alert: true,
      });

      return;
    }

    const category = await this.externalResourceService.getCategory(categoryId);

    const hasChildren =
      await this.externalResourceService.categoryHasChildren(categoryId);

    if (hasChildren) {
      await ctx.answerCbQuery(
        '⚠️ هذا التصنيف يحتوي على تصنيفات فرعية. اختر تصنيفًا فرعيًا.',
        {
          show_alert: true,
        },
      );

      return;
    }

    await this.startExternalResourceUpload(ctx, categoryId, category.name);

    await ctx.answerCbQuery();
  }

  // ============================================================
  // بدء استقبال PDF
  // ============================================================

  private async startExternalResourceUpload(
    ctx: Context,
    categoryId: number,
    categoryName: string,
  ): Promise<void> {
    const userId = this.getUserId(ctx);
    const messageId = this.getCallbackMessageId(ctx);
    const chatId = this.getChatId(ctx);

    if (
      userId === undefined ||
      messageId === undefined ||
      chatId === undefined
    ) {
      await ctx.answerCbQuery('تعذر بدء العملية', {
        show_alert: true,
      });

      return;
    }

    this.botEventService.set({
      userId,
      event: BotEventType.WAITING_EXTERNAL_RESOURCE_DOCUMENT,
      messageId,
      chatId,
      data: {
        categoryId,
      },
    });

    await ctx.editMessageText(
      '📄 <b>إضافة مصدر</b>\n\n' +
        `📁 التصنيف: <b>${this.escapeHtml(categoryName)}</b>\n\n` +
        'أرسل ملف الـ PDF الآن:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'external_cancel')],
        ]),
      },
    );
  }

  // ============================================================
  // استقبال PDF
  //
  // مهم:
  // لا ننسخ الملف هنا إلى قناة التخزين.
  //
  // نحفظ بيانات الملف مؤقتًا ثم ننتظر الوصف.
  // ============================================================

  async handleDocument(@Ctx() ctx: Context) {
    const userId = this.getUserId(ctx);

    if (userId === undefined) {
      return;
    }

    const event = this.botEventService.get(userId);

    if (
      !event ||
      event.event !== BotEventType.WAITING_EXTERNAL_RESOURCE_DOCUMENT
    ) {
      return;
    }

    const message = ctx.message;

    if (!message || !('document' in message)) {
      return;
    }

    const document = message.document;

    const isPdf =
      document.mime_type === 'application/pdf' ||
      document.file_name?.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      await ctx.reply(
        '<b>نوع الملف غير صحيح.</b>\n\n' +
          'يرجى إرسال المصدر بصيغة <b>PDF</b>.',
        {
          parse_mode: 'HTML',
        },
      );

      return;
    }

    // ==========================================================
    // Title
    // ==========================================================

    const title =
      document.file_name?.replace(/\.pdf$/i, '').trim() || 'مصدر خارجي';

    // ==========================================================
    // Save Temporary Data
    // ==========================================================

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_EXTERNAL_RESOURCE_CAPTION,

      data: {
        ...(event.data ?? {}),

        telegramFileId: document.file_id,

        originalMessageId: message.message_id,

        title,
      },
    });

    // ==========================================================
    // Ask Caption
    // ==========================================================

    await ctx.reply(
      '<b>تم استلام الملف.</b>\n\n' +
        `<b>العنوان:</b> ${this.escapeHtml(title)}\n\n` +
        'أرسل الآن <b>وصف المصدر</b>.',
      {
        parse_mode: 'HTML',
      },
    );
  }

  // ============================================================
  // الرجوع داخل شجرة المصادر
  // ============================================================

  @Action(/^external_resource_back\/(.+)$/)
  async handleResourceBack(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const value = data.split('/')[1];

    if (value === 'ROOT') {
      await this.showResourceCategories(ctx, null);

      await ctx.answerCbQuery();

      return;
    }

    const parentId = Number(value);

    if (!Number.isInteger(parentId)) {
      await ctx.answerCbQuery('تعذر الرجوع', {
        show_alert: true,
      });

      return;
    }

    await this.showResourceCategories(ctx, parentId);

    await ctx.answerCbQuery();
  }

  // ============================================================
  // إلغاء العملية الحالية
  // ============================================================

  @Action('external_cancel')
  async handleCancel(@Ctx() ctx: Context) {
    await this.cancelEvent(ctx);

    await ctx.editMessageText('❌ <b>تم إلغاء العملية.</b>', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔗 إدارة المصادر', 'admin_sources')],
      ]),
    });

    await ctx.answerCbQuery('تم إلغاء العملية');
  }

  // ============================================================
  // حذف تصنيف
  // ============================================================

  @Action('external_delete_category')
  async handleDeleteCategory(@Ctx() ctx: Context) {
    await this.showDeleteCategories(ctx, null);

    await ctx.answerCbQuery();
  }

  // ============================================================
  // عرض تصنيفات الحذف
  // ============================================================

  private async showDeleteCategories(
    ctx: Context,
    parentId: number | null,
  ): Promise<void> {
    const categories =
      parentId === null
        ? await this.externalResourceService.getRootCategories()
        : await this.externalResourceService.getChildCategories(parentId);

    if (categories.length === 0) {
      await ctx.editMessageText(
        parentId === null
          ? '⚠️ <b>لا توجد تصنيفات</b>\n\nلا يوجد تصنيفات يمكن حذفها.'
          : '⚠️ <b>لا توجد تصنيفات فرعية</b>',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '🔙 رجوع',
                parentId === null
                  ? 'admin_sources'
                  : 'external_delete_category',
              ),
            ],
          ]),
        },
      );

      return;
    }

    await ctx.editMessageText(
      parentId === null
        ? '🗑️ <b>حذف تصنيف</b>\n\nاختر التصنيف:'
        : '🗑️ <b>التصنيفات الفرعية</b>\n\nاختر التصنيف:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...categories.map((category) => [
            Markup.button.callback(
              `📁 ${category.name}`,
              `external_delete_category/${category.id}`,
            ),
          ]),
          [
            Markup.button.callback(
              '🔙 رجوع',
              parentId === null ? 'admin_sources' : 'external_delete_category',
            ),
          ],
        ]),
      },
    );
  }

  // ============================================================
  // اختيار تصنيف للحذف
  // ============================================================

  @Action(/^external_delete_category\/(\d+)$/)
  async handleDeleteCategorySelect(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const categoryId = Number(data.split('/')[1]);

    if (!Number.isInteger(categoryId)) {
      await ctx.answerCbQuery('التصنيف غير صحيح', {
        show_alert: true,
      });

      return;
    }

    const category = await this.externalResourceService.getCategory(categoryId);

    const children =
      await this.externalResourceService.getChildCategories(categoryId);

    const hasResources =
      await this.externalResourceService.categoryHasResources(categoryId);

    // ============================================================
    // إذا لديه أبناء
    // ============================================================

    if (children.length > 0) {
      await ctx.editMessageText(
        '📂 <b>التصنيف يحتوي على تصنيفات فرعية</b>\n\n' +
          `📁 <b>${this.escapeHtml(category.name)}</b>\n\n` +
          'اختر التصنيف الفرعي الذي تريد حذفه:',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            ...children.map((child) => [
              Markup.button.callback(
                `📂 ${child.name}`,
                `external_delete_category/${child.id}`,
              ),
            ]),
            [Markup.button.callback('🔙 رجوع', 'external_delete_category')],
          ]),
        },
      );

      await ctx.answerCbQuery();

      return;
    }

    // ============================================================
    // لديه مصادر
    // ============================================================

    if (hasResources) {
      await ctx.answerCbQuery(
        '⚠️ لا يمكن حذف هذا التصنيف لأنه يحتوي على مصادر.',
        {
          show_alert: true,
        },
      );

      return;
    }

    // ============================================================
    // تأكيد الحذف
    // ============================================================

    await ctx.editMessageText(
      '⚠️ <b>تأكيد حذف التصنيف</b>\n\n' +
        `📁 ${this.escapeHtml(category.name)}\n\n` +
        'هل أنت متأكد من حذف هذا التصنيف؟',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '✅ نعم، حذف',
              `external_confirm_delete_category/${categoryId}`,
            ),
          ],
          [Markup.button.callback('❌ إلغاء', 'external_delete_category')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // تأكيد حذف التصنيف
  // ============================================================

  @Action(/^external_confirm_delete_category\/(\d+)$/)
  async handleConfirmDeleteCategory(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const categoryId = Number(data.split('/')[1]);

    if (!Number.isInteger(categoryId)) {
      await ctx.answerCbQuery('التصنيف غير صحيح', {
        show_alert: true,
      });

      return;
    }

    await this.externalResourceService.deleteCategory(categoryId);

    await ctx.editMessageText('✅ <b>تم حذف التصنيف بنجاح.</b>', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔗 إدارة المصادر', 'admin_sources')],
      ]),
    });

    await ctx.answerCbQuery();
  }

  // ============================================================
  // حذف مصدر
  // ============================================================

  @Action('external_delete_resource')
  async handleDeleteResource(@Ctx() ctx: Context) {
    await this.showDeleteResourceCategories(ctx, null);

    await ctx.answerCbQuery();
  }

  // ============================================================
  // عرض تصنيفات حذف المصدر
  // ============================================================

  private async showDeleteResourceCategories(
    ctx: Context,
    parentId: number | null,
  ): Promise<void> {
    const categories =
      parentId === null
        ? await this.externalResourceService.getRootCategories()
        : await this.externalResourceService.getChildCategories(parentId);

    if (categories.length === 0) {
      await ctx.editMessageText('⚠️ <b>لا توجد تصنيفات</b>', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🔙 رجوع',
              parentId === null ? 'admin_sources' : 'external_delete_resource',
            ),
          ],
        ]),
      });

      return;
    }

    await ctx.editMessageText(
      parentId === null
        ? '🗑️ <b>حذف مصدر</b>\n\nاختر التصنيف:'
        : '🗑️ <b>حذف مصدر</b>\n\nاختر التصنيف:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...categories.map((category) => [
            Markup.button.callback(
              `📁 ${category.name}`,
              `external_delete_resource_category/${category.id}`,
            ),
          ]),
          [
            Markup.button.callback(
              '🔙 رجوع',
              parentId === null ? 'admin_sources' : 'external_delete_resource',
            ),
          ],
        ]),
      },
    );
  }

  // ============================================================
  // اختيار تصنيف حذف المصدر
  // ============================================================

  @Action(/^external_delete_resource_category\/(\d+)$/)
  async handleDeleteResourceCategory(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const categoryId = Number(data.split('/')[1]);

    if (!Number.isInteger(categoryId)) {
      await ctx.answerCbQuery('التصنيف غير صحيح', {
        show_alert: true,
      });

      return;
    }

    const category = await this.externalResourceService.getCategory(categoryId);

    const children =
      await this.externalResourceService.getChildCategories(categoryId);

    // ============================================================
    // لديه تصنيفات فرعية
    // ============================================================

    if (children.length > 0) {
      await ctx.editMessageText(
        '📂 <b>اختر التصنيف</b>\n\n' +
          `📁 داخل: <b>${this.escapeHtml(category.name)}</b>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            ...children.map((child) => [
              Markup.button.callback(
                `📂 ${child.name}`,
                `external_delete_resource_category/${child.id}`,
              ),
            ]),
            [Markup.button.callback('🔙 رجوع', 'external_delete_resource')],
          ]),
        },
      );

      await ctx.answerCbQuery();

      return;
    }

    // ============================================================
    // عرض المصادر
    // ============================================================

    const resources =
      await this.externalResourceService.getResources(categoryId);

    if (resources.length === 0) {
      await ctx.editMessageText(
        '⚠️ <b>لا توجد مصادر</b>\n\n' +
          `التصنيف: <b>${this.escapeHtml(category.name)}</b>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 رجوع', 'external_delete_resource')],
          ]),
        },
      );

      await ctx.answerCbQuery();

      return;
    }

    await ctx.editMessageText(
      '🗑️ <b>حذف مصدر</b>\n\n' +
        `📁 التصنيف: <b>${this.escapeHtml(category.name)}</b>\n\n` +
        'اختر المصدر الذي تريد حذفه:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...resources.map((resource) => [
            Markup.button.callback(
              `📄 ${resource.title}`,
              `external_delete_resource/${resource.id}`,
            ),
          ]),
          [Markup.button.callback('🔙 رجوع', 'external_delete_resource')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // تأكيد حذف المصدر
  // ============================================================

  @Action(/^external_delete_resource\/(\d+)$/)
  async handleDeleteResourceConfirm(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const resourceId = Number(data.split('/')[1]);

    if (!Number.isInteger(resourceId)) {
      await ctx.answerCbQuery('المصدر غير صحيح', {
        show_alert: true,
      });

      return;
    }

    const resource = await this.externalResourceService.getResource(resourceId);

    await ctx.editMessageText(
      '⚠️ <b>تأكيد حذف المصدر</b>\n\n' +
        `📄 ${this.escapeHtml(resource.title)}\n\n` +
        'هل أنت متأكد من حذف هذا المصدر؟',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '✅ نعم، حذف',
              `external_confirm_delete_resource/${resourceId}`,
            ),
          ],
          [Markup.button.callback('❌ إلغاء', 'external_delete_resource')],
        ]),
      },
    );

    await ctx.answerCbQuery();
  }

  // ============================================================
  // تنفيذ حذف المصدر
  // ============================================================

  @Action(/^external_confirm_delete_resource\/(\d+)$/)
  async handleConfirmDeleteResource(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const resourceId = Number(data.split('/')[1]);

    if (!Number.isInteger(resourceId)) {
      await ctx.answerCbQuery('المصدر غير صحيح', {
        show_alert: true,
      });

      return;
    }

    await this.externalResourceService.deleteResource(resourceId);

    await ctx.editMessageText('✅ <b>تم حذف المصدر بنجاح.</b>', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔗 إدارة المصادر', 'admin_sources')],
      ]),
    });

    await ctx.answerCbQuery();
  }
}
