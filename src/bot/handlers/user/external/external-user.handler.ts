import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

import { ExternalResourceService } from 'src/external/services/external-resource.service';

@Update()
export class ExternalUserHandler {
  constructor(
    private readonly externalResourceService: ExternalResourceService,
  ) {}

  // ============================================================
  // Helpers
  // ============================================================

  private getCallbackData(ctx: Context): string | undefined {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return undefined;
    }

    return typeof callbackQuery.data === 'string'
      ? callbackQuery.data
      : undefined;
  }

  private async sendCategory(ctx: Context, categoryId?: number): Promise<void> {
    const categories = categoryId
      ? await this.externalResourceService.getChildCategories(categoryId)
      : await this.externalResourceService.getRootCategories();

    // ==========================================================
    // لا توجد تصنيفات
    // ==========================================================

    if (categories.length === 0) {
      await ctx.editMessageText('⚠️ <b>لا توجد تصنيفات متاحة حاليًا.</b>', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 رجوع', 'er')]]),
      });

      return;
    }

    // ==========================================================
    // العنوان
    // ==========================================================

    let text = '🔗 <b>المصادر الخارجية</b>\n\n';

    if (categoryId) {
      const category =
        await this.externalResourceService.getCategory(categoryId);

      text += `📁 <b>${category.name}</b>\n\n`;
      text += 'اختر تصنيفًا فرعيًا:';
    } else {
      text += 'اختر التصنيف:';
    }

    // ==========================================================
    // Buttons
    // ==========================================================

    const buttons = categories.map((category) => [
      Markup.button.callback(
        `📁 ${category.name}`,
        `external_user_category/${category.id}`,
      ),
    ]);

    // ==========================================================
    // Back button
    // ==========================================================

    if (categoryId) {
      const category =
        await this.externalResourceService.getCategory(categoryId);

      if (category.parentId !== null) {
        buttons.push([
          Markup.button.callback(
            '🔙 رجوع',
            `external_user_category/${category.parentId}`,
          ),
        ]);
      } else {
        buttons.push([Markup.button.callback('🔙 رجوع', 'er')]);
      }
    } else {
      buttons.push([Markup.button.callback('🔙 رجوع', 'back_to_main')]);
    }

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    });
  }

  // ============================================================
  // زر المصادر الخارجية
  // ============================================================

  @Action('er')
  async handleExternalResources(@Ctx() ctx: Context) {
    await this.sendCategory(ctx);

    await ctx.answerCbQuery();
  }

  // ============================================================
  // اختيار تصنيف
  // ============================================================

  @Action(/^external_user_category\/(\d+)$/)
  async handleCategory(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const categoryId = Number(data.split('/')[1]);

    if (!Number.isInteger(categoryId)) {
      await ctx.answerCbQuery('❌ التصنيف غير صالح.', { show_alert: true });

      return;
    }

    const category = await this.externalResourceService.getCategory(categoryId);

    const childCategories =
      await this.externalResourceService.getChildCategories(categoryId);

    const resources =
      await this.externalResourceService.getResources(categoryId);

    // ==========================================================
    // التصنيف يحتوي على تصنيفات فرعية
    // ==========================================================

    if (childCategories.length > 0) {
      const buttons = childCategories.map((child) => [
        Markup.button.callback(
          `📁 ${child.name}`,
          `external_user_category/${child.id}`,
        ),
      ]);

      // --------------------------------------------------------
      // رجوع
      // --------------------------------------------------------

      if (category.parentId !== null) {
        buttons.push([
          Markup.button.callback(
            '🔙 رجوع',
            `external_user_category/${category.parentId}`,
          ),
        ]);
      } else {
        buttons.push([Markup.button.callback('🔙 رجوع', 'er')]);
      }

      await ctx.editMessageText(
        `🔗 <b>المصادر الخارجية</b>\n\n` +
          `📁 <b>${category.name}</b>\n\n` +
          'اختر التصنيف:',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(buttons),
        },
      );

      await ctx.answerCbQuery();

      return;
    }

    // ==========================================================
    // لا توجد مصادر
    // ==========================================================

    if (resources.length === 0) {
      const backButton =
        category.parentId !== null
          ? Markup.button.callback(
              '🔙 رجوع',
              `external_user_category/${category.parentId}`,
            )
          : Markup.button.callback('🔙 رجوع', 'er');

      await ctx.editMessageText(
        `📁 <b>${category.name}</b>\n\n` +
          '⚠️ لا توجد مصادر في هذا التصنيف حاليًا.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[backButton]]),
        },
      );

      await ctx.answerCbQuery();

      return;
    }

    // ==========================================================
    // إرسال جميع المصادر
    // ==========================================================

    await ctx.answerCbQuery(`📚 جاري إرسال ${resources.length} مصدر...`);

    for (const resource of resources) {
      try {
        await ctx.telegram.copyMessage(
          ctx.chat!.id,
          resource.telegramChatId,
          resource.telegramMessageId,
        );
      } catch (error) {
        console.error(
          `[ExternalUserHandler] Failed to send resource id=${resource.id}`,
          error,
        );
      }
    }

    // ==========================================================
    // رسالة بعد إرسال الملفات
    // ==========================================================

    const backButton =
      category.parentId !== null
        ? Markup.button.callback(
            '🔙 رجوع',
            `external_user_category/${category.parentId}`,
          )
        : Markup.button.callback('🔙 رجوع', 'er');

    await ctx.reply(
      `📁 <b>${category.name}</b>\n\n` +
        `📚 تم إرسال <b>${resources.length}</b> مصدر.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[backButton]]),
      },
    );
  }

  // ============================================================
  // عرض المصدر
  // ============================================================

  @Action(/^external_user_resource\/(\d+)$/)
  async handleResource(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);

    if (!data) {
      return;
    }

    const resourceId = Number(data.split('/')[1]);

    if (!Number.isInteger(resourceId)) {
      await ctx.answerCbQuery('❌ المصدر غير صالح.', { show_alert: true });

      return;
    }

    const resource = await this.externalResourceService.getResource(resourceId);

    // ==========================================================
    // إرسال المصدر
    // ==========================================================

    try {
      await ctx.telegram.copyMessage(
        ctx.chat!.id,
        resource.telegramChatId,
        resource.telegramMessageId,
      );
    } catch (error) {
      console.error('[ExternalUserHandler] Failed to copy resource', error);

      await ctx.answerCbQuery('❌ تعذر إرسال المصدر حاليًا.', {
        show_alert: true,
      });

      return;
    }

    await ctx.answerCbQuery('📄 تم إرسال المصادر');

    // ==========================================================
    // لا نحذف الرسالة الأصلية
    // نترك قائمة المصادر للمستخدم
    // ==========================================================
  }
}
