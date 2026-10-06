/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable } from '@nestjs/common';

import { Action, Ctx, Update } from 'nestjs-telegraf';

import { Context, Markup } from 'telegraf';

import { Prisma, ResourceType } from '@prisma/client';

import { AcademicService } from 'src/academic/services/academic.services';

import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';

import { ExamService } from 'src/exam/services/exam.service';

import { BotEventConflictService } from 'src/bot/services/bot-conflict.service';

// ============================================================
// Types
// ============================================================

type CourseOfferingWithRelations = Prisma.CourseOfferingGetPayload<{
  include: {
    course: true;
    academicYear: true;
  };
}>;

// ============================================================
// Handler
// ============================================================

@Injectable()
@Update()
export class AddExamHandler {
  // ============================================================
  // Storage Channel
  // ============================================================

  private readonly STORAGE_CHANNEL_ID =
    process.env.EXAM_STORAGE_CHANNEL_ID ||
    process.env.MATERIAL_STORAGE_CHANNEL_ID;

  // ============================================================
  // Constructor
  // ============================================================

  constructor(
    private readonly academicService: AcademicService,
    private readonly examService: ExamService,
    private readonly botEventService: BotEventService,
    private readonly botEventConflictService: BotEventConflictService,
  ) {}

  // ============================================================
  // Main Callback Router
  // ============================================================

  @Action(/^ae(?:\/.*)?$/)
  async handleAction(@Ctx() ctx: Context) {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return;
    }

    const callbackData = callbackQuery.data;

    if (typeof callbackData !== 'string') {
      return;
    }

    const parts = callbackData.split('/');

    if (parts[0] !== 'ae') {
      return;
    }

    await ctx.answerCbQuery();

    // =========================================================
    // Cancel
    // ae/cancel
    // =========================================================

    if (callbackData === 'ae/cancel') {
      this.botEventService.delete(this.getUserId(ctx));

      await this.editOrReply(
        ctx,
        '<b>تم إلغاء العملية.</b>',
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      );

      return;
    }

    // =========================================================
    // Back
    // ae/back/departmentId/levelId
    //
    // Used when trackValue === none.
    // =========================================================

    if (parts.length === 4 && parts[1] === 'back') {
      const departmentId = Number(parts[2]);
      const levelId = Number(parts[3]);

      if (!Number.isInteger(departmentId) || !Number.isInteger(levelId)) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }

      await this.handleLevel(ctx, departmentId, levelId);
      return;
    }

    // =========================================================
    // ae
    // =========================================================

    if (parts.length === 1) {
      await this.start(ctx);
      return;
    }

    // =========================================================
    // ae/departmentId
    // =========================================================

    if (parts.length === 2) {
      const departmentId = Number(parts[1]);

      if (!Number.isInteger(departmentId)) {
        await this.editOrReply(ctx, '❌ التخصص غير صحيح.');
        return;
      }

      await this.handleDepartment(ctx, departmentId);
      return;
    }

    // =========================================================
    // ae/departmentId/levelId
    // =========================================================

    if (parts.length === 3) {
      const departmentId = Number(parts[1]);
      const levelId = Number(parts[2]);

      if (!Number.isInteger(departmentId) || !Number.isInteger(levelId)) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }

      await this.handleLevel(ctx, departmentId, levelId);
      return;
    }

    // =========================================================
    // ae/departmentId/levelId/termId
    // =========================================================

    if (parts.length === 4) {
      const departmentId = Number(parts[1]);
      const levelId = Number(parts[2]);
      const termId = Number(parts[3]);

      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }

      await this.handleTermSelection(ctx, departmentId, levelId, termId);

      return;
    }

    // =========================================================
    // ae/departmentId/levelId/termId/trackValue
    // =========================================================

    if (parts.length === 5) {
      const departmentId = Number(parts[1]);
      const levelId = Number(parts[2]);
      const termId = Number(parts[3]);
      const trackValue = parts[4];

      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }

      await this.handleTermWithTrack(
        ctx,
        departmentId,
        levelId,
        termId,
        trackValue,
      );

      return;
    }

    // =========================================================
    // ae/.../trackValue/courseId
    // =========================================================

    if (parts.length === 6) {
      const departmentId = Number(parts[1]);
      const levelId = Number(parts[2]);
      const termId = Number(parts[3]);
      const trackValue = parts[4];
      const courseId = Number(parts[5]);

      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId) ||
        !Number.isInteger(courseId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }

      await this.handleCourse(
        ctx,
        departmentId,
        levelId,
        termId,
        trackValue,
        courseId,
      );

      return;
    }

    // =========================================================
    // ae/.../courseId/academicYearId
    // =========================================================

    if (parts.length === 7) {
      const departmentId = Number(parts[1]);
      const levelId = Number(parts[2]);
      const termId = Number(parts[3]);
      const trackValue = parts[4];
      const courseId = Number(parts[5]);
      const academicYearId = Number(parts[6]);

      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId) ||
        !Number.isInteger(courseId) ||
        !Number.isInteger(academicYearId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }

      await this.handleAcademicYear(
        ctx,
        departmentId,
        levelId,
        termId,
        trackValue,
        courseId,
        academicYearId,
      );

      return;
    }

    // =========================================================
    // ae/.../academicYearId/T
    // ae/.../academicYearId/P
    // =========================================================

    if (parts.length === 8) {
      const departmentId = Number(parts[1]);
      const levelId = Number(parts[2]);
      const termId = Number(parts[3]);
      const trackValue = parts[4];
      const courseId = Number(parts[5]);
      const academicYearId = Number(parts[6]);
      const typeValue = parts[7];

      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId) ||
        !Number.isInteger(courseId) ||
        !Number.isInteger(academicYearId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }

      await this.handleType(
        ctx,
        departmentId,
        levelId,
        termId,
        trackValue,
        courseId,
        academicYearId,
        typeValue,
      );

      return;
    }

    await this.editOrReply(ctx, '❌ مسار العملية غير صحيح.');
  }

  // ============================================================
  // Start
  // ============================================================

  async start(@Ctx() ctx: Context) {
    const userId = this.getUserId(ctx);

    const existingEvent = this.botEventService.get(userId);

    if (existingEvent) {
      await this.botEventConflictService.showConflict(ctx, existingEvent);

      return;
    }

    this.botEventService.set({
      userId,
      event: BotEventType.WAITING_EXAM_DEPARTMENT,
      messageId: this.getMessageId(ctx),
      chatId: String(ctx.chat?.id ?? ''),
      data: {},
    });

    await this.showDepartments(ctx);
  }

  // ============================================================
  // Departments
  // ============================================================

  private async showDepartments(ctx: Context) {
    const departments = await this.academicService.getDepartments();

    if (!departments.length) {
      await this.editOrReply(ctx, '❌ لا توجد تخصصات.');
      this.deleteEvent(ctx);
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        '<b>الخطوة 1 من 7</b>',
        '',
        '<b>اختر التخصص</b>',
        '',
        'اختر التخصص الذي تريد إضافة الاختبار إليه.',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...departments.map((department) => [
          Markup.button.callback(department.name, `ae/${department.id}`),
        ]),
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
      ]),
    );
  }

  // ============================================================
  // Department
  // ============================================================

  private async handleDepartment(ctx: Context, departmentId: number) {
    const department =
      await this.academicService.getDepartmentById(departmentId);

    if (!department) {
      await this.editOrReply(ctx, '❌ التخصص غير موجود.');

      return;
    }

    const event = this.botEventService.get(this.getUserId(ctx));

    this.botEventService.update(this.getUserId(ctx), {
      event: BotEventType.WAITING_EXAM_LEVEL,

      data: {
        ...(event?.data ?? {}),
        departmentId,
      },
    });

    await this.showLevels(ctx);
  }

  // ============================================================
  // Levels
  // ============================================================

  private async showLevels(ctx: Context) {
    const levels = await this.academicService.getLevels();

    if (!levels.length) {
      await this.editOrReply(ctx, '❌ لا توجد مستويات.');

      return;
    }

    const event = this.botEventService.get(this.getUserId(ctx));

    const departmentId = this.getNumber(event?.data?.departmentId);

    const department =
      await this.academicService.getDepartmentById(departmentId);

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        '<b>التخصص:</b> ' + this.escapeHtml(department?.name ?? 'غير محدد'),
        '',
        '<b>الخطوة 2 من 7</b>',
        '',
        '<b>اختر المستوى</b>',
        '',
        'اختر المستوى الذي تريد إضافة الاختبار إليه.',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...levels.map((level) => [
          Markup.button.callback(level.name, `ae/${departmentId}/${level.id}`),
        ]),
        [Markup.button.callback('السابق', `ae/${departmentId}`)],
      ]),
    );
  }

  // ============================================================
  // Level
  // ============================================================

  private async handleLevel(
    ctx: Context,
    departmentId: number,
    levelId: number,
  ) {
    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    if (!department || !level) {
      await this.editOrReply(ctx, '❌ التخصص أو المستوى غير موجود.');

      return;
    }

    const event = this.botEventService.get(this.getUserId(ctx));

    const hasTrack =
      department.name === 'تقنية معلومات' &&
      (level.number === 3 || level.number === 4);

    this.botEventService.update(this.getUserId(ctx), {
      event: BotEventType.WAITING_EXAM_TERM,

      data: {
        ...(event?.data ?? {}),
        departmentId,
        levelId,
      },
    });

    if (hasTrack) {
      await this.showTermsWithTrack(ctx, departmentId, levelId);

      return;
    }

    await this.showTermsWithoutTrack(ctx, departmentId, levelId);
  }

  // ============================================================
  // Terms - With Track
  // ============================================================

  private async showTermsWithTrack(
    ctx: Context,
    departmentId: number,
    levelId: number,
  ) {
    const terms = await this.academicService.getTerms();

    if (!terms.length) {
      await this.editOrReply(ctx, '❌ لا توجد أترام.');

      return;
    }

    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        `<b>التخصص:</b> ${this.escapeHtml(department?.name ?? 'غير محدد')}`,
        `<b>المستوى:</b> ${this.escapeHtml(level?.name ?? 'غير محدد')}`,
        '',
        '<b>الخطوة 3 من 7</b>',
        '',
        '<b>اختر الترم</b>',
        '',
        'اختر الترم الذي تريد إضافة الاختبار إليه.',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...terms.map((term) => [
          Markup.button.callback(
            term.name,
            `ae/${departmentId}/${levelId}/${term.id}`,
          ),
        ]),
        [Markup.button.callback('السابق', `ae/${departmentId}/${levelId}`)],
      ]),
    );
  }

  // ============================================================
  // Terms - Without Track
  // ============================================================

  private async showTermsWithoutTrack(
    ctx: Context,
    departmentId: number,
    levelId: number,
  ) {
    const terms = await this.academicService.getTerms();

    if (!terms.length) {
      await this.editOrReply(ctx, '❌ لا توجد أترام.');

      return;
    }

    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        `<b>التخصص:</b> ${this.escapeHtml(department?.name ?? 'غير محدد')}`,
        `<b>المستوى:</b> ${this.escapeHtml(level?.name ?? 'غير محدد')}`,
        '',
        '<b>الخطوة 3 من 7</b>',
        '',
        '<b>اختر الترم</b>',
        '',
        'اختر الترم الذي تريد إضافة الاختبار إليه.',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...terms.map((term) => [
          Markup.button.callback(
            term.name,
            `ae/${departmentId}/${levelId}/${term.id}/none`,
          ),
        ]),
        [Markup.button.callback('السابق', `ae/${departmentId}/${levelId}`)],
      ]),
    );
  }

  // ============================================================
  // Term Selection
  // ============================================================

  private async handleTermSelection(
    ctx: Context,
    departmentId: number,
    levelId: number,
    termId: number,
  ) {
    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    const term = await this.academicService.getTermById(termId);

    if (!department || !level || !term) {
      await this.editOrReply(ctx, '❌ بيانات الاختيار غير صحيحة.');

      return;
    }

    const hasTrack =
      department.name === 'تقنية معلومات' &&
      (level.number === 3 || level.number === 4);

    // =========================================================
    // WITHOUT TRACK
    // =========================================================

    if (!hasTrack) {
      await this.handleTermWithTrack(
        ctx,
        departmentId,
        levelId,
        termId,
        'none',
      );

      return;
    }

    // =========================================================
    // WITH TRACK
    // =========================================================

    const tracks =
      await this.academicService.getTracksByDepartmentId(departmentId);

    const buttons = tracks.map((track) => [
      Markup.button.callback(
        track.name,
        `ae/${departmentId}/${levelId}/${termId}/${track.id}`,
      ),
    ]);

    buttons.push([
      Markup.button.callback(
        '➡️ بدون تراك',
        `ae/${departmentId}/${levelId}/${termId}/none`,
      ),
    ]);

    buttons.push([
      Markup.button.callback('السابق', `ae/${departmentId}/${levelId}`),
    ]);

    const event = this.botEventService.get(this.getUserId(ctx));

    this.botEventService.update(this.getUserId(ctx), {
      event: BotEventType.WAITING_EXAM_TRACK,

      data: {
        ...(event?.data ?? {}),
        departmentId,
        levelId,
        termId,
      },
    });

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        `<b>التخصص:</b> ${this.escapeHtml(department.name)}`,
        `<b>المستوى:</b> ${this.escapeHtml(level.name)}`,
        `<b>الترم:</b> ${this.escapeHtml(term.name)}`,
        '',
        '<b>الخطوة 4 من 7</b>',
        '',
        '<b>اختر التراك</b>',
        '',
        'اختر التخصص الفرعي الذي تريد إضافة الاختبار إليه.',
      ].join('\n'),
      Markup.inlineKeyboard(buttons),
    );
  }

  // ============================================================
  // Term + Track
  // ============================================================

  private async handleTermWithTrack(
    ctx: Context,
    departmentId: number,
    levelId: number,
    termId: number,
    trackValue: string,
  ) {
    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    const term = await this.academicService.getTermById(termId);

    if (!department || !level || !term) {
      await this.editOrReply(ctx, '❌ بيانات الاختيار غير صحيحة.');

      return;
    }

    // =========================================================
    // Track
    // =========================================================

    let trackId: number | undefined;

    let trackName = 'بدون تراك';

    if (trackValue !== 'none') {
      trackId = Number(trackValue);

      if (!Number.isInteger(trackId)) {
        await this.editOrReply(ctx, '❌ التراك غير صحيح.');

        return;
      }

      const track = await this.academicService.getTrackById(trackId);

      if (!track) {
        await this.editOrReply(ctx, '❌ التراك غير موجود.');

        return;
      }

      trackName = track.name;
    }

    // =========================================================
    // Academic Years
    // =========================================================

    const academicYears = await this.academicService.getAcademicYears();

    const previousCallback =
      trackValue === 'none'
        ? `ae/back/${departmentId}/${levelId}`
        : `ae/${departmentId}/${levelId}/${termId}`;

    if (!academicYears.length) {
      await this.editOrReply(
        ctx,
        '❌ لا توجد سنوات دراسية.',
        Markup.inlineKeyboard([
          [Markup.button.callback('السابق', previousCallback)],
        ]),
      );

      return;
    }

    // =========================================================
    // Get Offerings
    // =========================================================

    const offerings: CourseOfferingWithRelations[] = [];

    for (const academicYear of academicYears) {
      const yearOfferings = await this.academicService.getCourseOfferings({
        departmentId,
        trackId,
        levelId,
        termId,
        academicYearId: academicYear.id,
      });

      offerings.push(...yearOfferings);
    }

    // =========================================================
    // No Courses
    // =========================================================

    if (!offerings.length) {
      await this.editOrReply(
        ctx,
        [
          '<b>📝 إضافة اختبار</b>',
          '',
          `<b>التخصص:</b> ${this.escapeHtml(department.name)}`,
          `<b>المستوى:</b> ${this.escapeHtml(level.name)}`,
          `<b>الترم:</b> ${this.escapeHtml(term.name)}`,
          `<b>التراك:</b> ${this.escapeHtml(trackName)}`,
          '',
          '❌ لا توجد مواد لهذا الاختيار.',
        ].join('\n'),
        Markup.inlineKeyboard([
          [Markup.button.callback('السابق', previousCallback)],
        ]),
      );

      return;
    }

    // =========================================================
    // Unique Courses
    // =========================================================

    const uniqueCourses = new Map<number, CourseOfferingWithRelations>();

    for (const offering of offerings) {
      if (!uniqueCourses.has(offering.courseId)) {
        uniqueCourses.set(offering.courseId, offering);
      }
    }

    const courses = Array.from(uniqueCourses.values());

    // =========================================================
    // Event
    // =========================================================

    const event = this.botEventService.get(this.getUserId(ctx));

    this.botEventService.update(this.getUserId(ctx), {
      event: BotEventType.WAITING_EXAM_COURSE,

      data: {
        ...(event?.data ?? {}),
        departmentId,
        levelId,
        termId,
        trackValue,
      },
    });

    // =========================================================
    // Show Courses
    // =========================================================

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        `<b>التخصص:</b> ${this.escapeHtml(department.name)}`,
        `<b>المستوى:</b> ${this.escapeHtml(level.name)}`,
        `<b>الترم:</b> ${this.escapeHtml(term.name)}`,
        `<b>التراك:</b> ${this.escapeHtml(trackName)}`,
        '',
        '<b>الخطوة 5 من 7</b>',
        '',
        '<b>اختر المادة</b>',
        '',
        'اختر المادة التي تريد إضافة الاختبار إليها.',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...courses.map((offering) => [
          Markup.button.callback(
            offering.course.name,
            `ae/${departmentId}/${levelId}/${termId}/${trackValue}/${offering.courseId}`,
          ),
        ]),
        [Markup.button.callback('السابق', previousCallback)],
      ]),
    );
  }

  // ============================================================
  // Course
  // ============================================================

  private async handleCourse(
    ctx: Context,
    departmentId: number,
    levelId: number,
    termId: number,
    trackValue: string,
    courseId: number,
  ) {
    let trackId: number | undefined;

    let trackName = 'بدون تراك';

    if (trackValue !== 'none') {
      trackId = Number(trackValue);

      if (!Number.isInteger(trackId)) {
        await this.editOrReply(ctx, '❌ التراك غير صحيح.');

        return;
      }

      const track = await this.academicService.getTrackById(trackId);

      if (!track) {
        await this.editOrReply(ctx, '❌ التراك غير موجود.');

        return;
      }

      trackName = track.name;
    }

    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    const term = await this.academicService.getTermById(termId);

    const academicYears = await this.academicService.getAcademicYears();

    const previousCallback = `ae/${departmentId}/${levelId}/${termId}/${trackValue}`;

    if (!academicYears.length) {
      await this.editOrReply(
        ctx,
        '❌ لا توجد سنوات دراسية.',
        Markup.inlineKeyboard([
          [Markup.button.callback('السابق', previousCallback)],
        ]),
      );

      return;
    }

    const availableYears: Array<{
      id: number;
      startYear: number;
      endYear: number;
    }> = [];

    for (const academicYear of academicYears) {
      const offering = await this.academicService.findCourseOffering({
        courseId,
        departmentId,
        levelId,
        termId,
        trackId,
        academicYearId: academicYear.id,
      });

      if (offering) {
        availableYears.push(academicYear);
      }
    }

    if (!availableYears.length) {
      await this.editOrReply(
        ctx,
        '❌ لا توجد سنوات دراسية لهذه المادة.',
        Markup.inlineKeyboard([
          [Markup.button.callback('السابق', previousCallback)],
        ]),
      );

      return;
    }

    availableYears.sort((a, b) => b.startYear - a.startYear);

    const event = this.botEventService.get(this.getUserId(ctx));

    this.botEventService.update(this.getUserId(ctx), {
      event: BotEventType.WAITING_EXAM_ACADEMIC_YEAR,

      data: {
        ...(event?.data ?? {}),
        departmentId,
        levelId,
        termId,
        trackValue,
        courseId,
      },
    });

    const courseName =
      availableYears.length > 0
        ? ((
            await this.academicService.findCourseOffering({
              courseId,
              departmentId,
              levelId,
              termId,
              trackId,
              academicYearId: availableYears[0].id,
            })
          )?.course.name ?? 'غير محدد')
        : 'غير محدد';

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        `<b>التخصص:</b> ${this.escapeHtml(department?.name ?? 'غير محدد')}`,
        `<b>المستوى:</b> ${this.escapeHtml(level?.name ?? 'غير محدد')}`,
        `<b>الترم:</b> ${this.escapeHtml(term?.name ?? 'غير محدد')}`,
        `<b>التراك:</b> ${this.escapeHtml(trackName)}`,
        `<b>المادة:</b> ${this.escapeHtml(courseName)}`,
        '',
        '<b>الخطوة 6 من 7</b>',
        '',
        '<b>اختر السنة الدراسية</b>',
        '',
        'اختر السنة التي يتبع لها الاختبار.',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...availableYears.map((year) => [
          Markup.button.callback(
            `${year.startYear} - ${year.endYear}`,
            `ae/${departmentId}/${levelId}/${termId}/${trackValue}/${courseId}/${year.id}`,
          ),
        ]),
        [Markup.button.callback('السابق', previousCallback)],
      ]),
    );
  }

  // ============================================================
  // Academic Year
  // ============================================================

  private async handleAcademicYear(
    ctx: Context,
    departmentId: number,
    levelId: number,
    termId: number,
    trackValue: string,
    courseId: number,
    academicYearId: number,
  ) {
    let trackId: number | undefined;

    let trackName = 'بدون تراك';

    if (trackValue !== 'none') {
      trackId = Number(trackValue);

      if (!Number.isInteger(trackId)) {
        await this.editOrReply(ctx, '❌ التراك غير صحيح.');

        return;
      }

      const track = await this.academicService.getTrackById(trackId);

      if (!track) {
        await this.editOrReply(ctx, '❌ التراك غير موجود.');

        return;
      }

      trackName = track.name;
    }

    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      levelId,
      termId,
      trackId,
      academicYearId,
    });

    if (!offering) {
      await this.editOrReply(ctx, '❌ لا توجد هذه المادة في السنة المحددة.');

      return;
    }

    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    const term = await this.academicService.getTermById(termId);

    const event = this.botEventService.get(this.getUserId(ctx));

    this.botEventService.update(this.getUserId(ctx), {
      event: BotEventType.WAITING_EXAM_TYPE,

      data: {
        ...(event?.data ?? {}),
        departmentId,
        levelId,
        termId,
        trackValue,
        courseId,
        academicYearId,
        courseOfferingId: offering.id,
      },
    });

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        `<b>التخصص:</b> ${this.escapeHtml(department?.name ?? 'غير محدد')}`,
        `<b>المستوى:</b> ${this.escapeHtml(level?.name ?? 'غير محدد')}`,
        `<b>الترم:</b> ${this.escapeHtml(term?.name ?? 'غير محدد')}`,
        `<b>التراك:</b> ${this.escapeHtml(trackName)}`,
        `<b>المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        `<b>السنة:</b> ${offering.academicYear.startYear} - ${offering.academicYear.endYear}`,
        '',
        '<b>الخطوة 7 من 7</b>',
        '',
        '<b>اختر نوع الاختبار</b>',
        '',
        'حدد نوع الاختبار الذي تريد رفعه.',
      ].join('\n'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📘 نظري',
            `ae/${departmentId}/${levelId}/${termId}/${trackValue}/${courseId}/${academicYearId}/T`,
          ),
        ],
        [
          Markup.button.callback(
            '🧪 عملي',
            `ae/${departmentId}/${levelId}/${termId}/${trackValue}/${courseId}/${academicYearId}/P`,
          ),
        ],
        [
          Markup.button.callback(
            'السابق',
            `ae/${departmentId}/${levelId}/${termId}/${trackValue}/${courseId}`,
          ),
        ],
      ]),
    );
  }

  // ============================================================
  // Exam Type
  // ============================================================

  private async handleType(
    ctx: Context,
    departmentId: number,
    levelId: number,
    termId: number,
    trackValue: string,
    courseId: number,
    academicYearId: number,
    typeValue: string,
  ) {
    let type: ResourceType;

    if (typeValue === 'T') {
      type = ResourceType.THEORY;
    } else if (typeValue === 'P') {
      type = ResourceType.PRACTICAL;
    } else {
      await this.editOrReply(ctx, '❌ نوع الاختبار غير صحيح.');

      return;
    }

    let trackId: number | undefined;

    let trackName = 'بدون تراك';

    if (trackValue !== 'none') {
      trackId = Number(trackValue);

      if (!Number.isInteger(trackId)) {
        await this.editOrReply(ctx, '❌ التراك غير صحيح.');

        return;
      }

      const track = await this.academicService.getTrackById(trackId);

      if (!track) {
        await this.editOrReply(ctx, '❌ التراك غير موجود.');

        return;
      }

      trackName = track.name;
    }

    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      levelId,
      termId,
      trackId,
      academicYearId,
    });

    if (!offering) {
      await this.editOrReply(ctx, '❌ لا توجد هذه المادة في السياق المحدد.');

      return;
    }

    const department =
      await this.academicService.getDepartmentById(departmentId);

    const level = await this.academicService.getLevelById(levelId);

    const term = await this.academicService.getTermById(termId);

    const typeName = type === ResourceType.THEORY ? 'نظري' : 'عملي';

    const event = this.botEventService.get(this.getUserId(ctx));

    this.botEventService.update(this.getUserId(ctx), {
      event: BotEventType.WAITING_EXAM_DOCUMENT,

      data: {
        ...(event?.data ?? {}),
        departmentId,
        levelId,
        termId,
        trackValue,
        courseId,
        academicYearId,
        courseOfferingId: offering.id,
        type,
      },
    });

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار</b>',
        '',
        `<b>التخصص:</b> ${this.escapeHtml(department?.name ?? 'غير محدد')}`,
        `<b>المستوى:</b> ${this.escapeHtml(level?.name ?? 'غير محدد')}`,
        `<b>الترم:</b> ${this.escapeHtml(term?.name ?? 'غير محدد')}`,
        `<b>التراك:</b> ${this.escapeHtml(trackName)}`,
        `<b>المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        `<b>السنة:</b> ${offering.academicYear.startYear} - ${offering.academicYear.endYear}`,
        `<b>نوع الاختبار:</b> ${typeName}`,
        '',
        '<b>📎 إرسال الاختبار</b>',
        '',
        'أرسل ملف الاختبار بصيغة <b>PDF</b>.',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ إلغاء', 'ae/cancel')],
      ]),
    );
  }

  // ============================================================
  // Document
  // ============================================================

  async handleDocument(ctx: Context) {
    const userId = this.getUserId(ctx);

    const event = this.botEventService.get(userId);

    if (!event || event.event !== BotEventType.WAITING_EXAM_DOCUMENT) {
      return;
    }

    const message = ctx.message;

    if (!message || !('document' in message)) {
      return;
    }

    const document = message.document;

    // =========================================================
    // Validate PDF
    // =========================================================

    const isPdf =
      document.mime_type === 'application/pdf' ||
      document.file_name?.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      await ctx.reply(
        '❌ <b>الملف غير صحيح</b>\n\n' + 'يجب أن يكون الملف بصيغة PDF.',
        {
          parse_mode: 'HTML',
        },
      );

      return;
    }

    // =========================================================
    // Save File Information
    // =========================================================

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_EXAM_TITLE,

      data: {
        ...(event.data ?? {}),
        telegramFileId: document.file_id,

        originalMessageId: message.message_id,

        caption: 'caption' in message ? message.caption : undefined,
      },
    });

    await ctx.reply(
      '✅ <b>تم استلام الملف</b>\n\n' + '📝 أرسل عنوان الاختبار:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'ae/cancel')],
        ]),
      },
    );
  }

  // ============================================================
  // Receive Title
  // ============================================================

  async receiveTitle(ctx: Context, title: string) {
    const userId = this.getUserId(ctx);

    const event = this.botEventService.get(userId);

    if (!event || event.event !== BotEventType.WAITING_EXAM_TITLE) {
      return;
    }

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      await ctx.reply(
        '❌ <b>العنوان غير صحيح</b>\n\n' + 'لا يمكن أن يكون العنوان فارغًا.',
        {
          parse_mode: 'HTML',
        },
      );

      return;
    }

    // =========================================================
    // Event Data
    // =========================================================

    const courseOfferingId = this.getNumber(event.data?.courseOfferingId);

    const telegramFileId = this.getString(event.data?.telegramFileId);

    const originalMessageId = this.getNumber(event.data?.originalMessageId);

    const type = event.data?.type;

    if (
      !courseOfferingId ||
      !telegramFileId ||
      !originalMessageId ||
      !this.isResourceType(type)
    ) {
      await ctx.reply(
        '❌ <b>بيانات العملية غير مكتملة</b>\n\n' + 'يرجى بدء العملية من جديد.',
        {
          parse_mode: 'HTML',
        },
      );

      this.botEventService.delete(userId);

      return;
    }

    // =========================================================
    // Context
    // =========================================================

    const departmentId = this.getNumberOrUndefined(event.data?.departmentId);

    const levelId = this.getNumberOrUndefined(event.data?.levelId);

    const termId = this.getNumberOrUndefined(event.data?.termId);

    const trackValue = this.getString(event.data?.trackValue);

    // =========================================================
    // Storage Channel
    // =========================================================

    if (!this.STORAGE_CHANNEL_ID) {
      await ctx.reply('❌ قناة تخزين الاختبارات غير معرفة.');

      return;
    }

    // =========================================================
    // Copy Message
    // =========================================================

    let storageMessageId: number;

    try {
      const copiedMessage = await ctx.telegram.copyMessage(
        this.STORAGE_CHANNEL_ID,
        ctx.chat!.id,
        originalMessageId,
        {
          caption: cleanTitle,
        },
      );

      storageMessageId = copiedMessage.message_id;
    } catch (error) {
      console.error('Failed to copy exam to storage channel:', error);

      await ctx.reply('❌ حدث خطأ أثناء حفظ الملف في قناة التخزين.');

      return;
    }

    // =========================================================
    // Create Exam
    // =========================================================

    try {
      await this.examService.createExam({
        courseOfferingId,
        title: cleanTitle,
        type,
        telegramChatId: this.STORAGE_CHANNEL_ID,
        telegramMessageId: storageMessageId,
        telegramFileId,
        caption: this.getString(event.data?.caption),
      });
    } catch (error) {
      console.error('Failed to create exam:', error);

      await ctx.reply(
        '❌ تم حفظ الملف في القناة، ' + 'لكن حدث خطأ أثناء حفظ البيانات.',
      );

      return;
    }

    // =========================================================
    // Prepare Context For Next Exam
    // =========================================================

    if (
      departmentId !== undefined &&
      levelId !== undefined &&
      termId !== undefined &&
      trackValue
    ) {
      this.botEventService.update(userId, {
        event: BotEventType.WAITING_EXAM_COURSE,

        data: {
          departmentId,
          levelId,
          termId,
          trackValue,
        },
      });
    } else {
      this.botEventService.delete(userId);
    }

    // =========================================================
    // Success
    // =========================================================

    await ctx.reply(
      '✅ <b>تم رفع الاختبار بنجاح</b>\n\n' +
        `<b>📝 العنوان:</b> ${this.escapeHtml(cleanTitle)}\n\n` +
        'اختر الإجراء التالي:',
      {
        parse_mode: 'HTML',

        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '➕ رفع اختبار آخر لنفس التخصص',
              departmentId !== undefined &&
                levelId !== undefined &&
                termId !== undefined &&
                trackValue
                ? `ae/${departmentId}/${levelId}/${termId}/${trackValue}`
                : 'ae',
            ),
          ],
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      },
    );
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getUserId(ctx: Context): number {
    if (!ctx.from?.id) {
      throw new Error('Telegram user ID is missing');
    }

    return ctx.from.id;
  }

  // ============================================================

  private getMessageId(ctx: Context): number {
    const message = ctx.message;

    if (message && 'message_id' in message) {
      return message.message_id;
    }

    return 0;
  }

  // ============================================================

  private deleteEvent(ctx: Context): void {
    this.botEventService.delete(this.getUserId(ctx));
  }

  // ============================================================

  private getNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    throw new Error('Expected number');
  }

  // ============================================================

  private getNumberOrUndefined(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  // ============================================================

  private getString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    return undefined;
  }

  // ============================================================

  private isResourceType(value: unknown): value is ResourceType {
    return value === ResourceType.THEORY || value === ResourceType.PRACTICAL;
  }

  // ============================================================
  // HTML Escape
  // ============================================================

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================================
  // Edit Current Telegram Message
  // ============================================================

  private async editOrReply(
    ctx: Context,
    text: string,
    keyboard?: ReturnType<typeof Markup.inlineKeyboard>,
  ): Promise<void> {
    const extra = {
      parse_mode: 'HTML' as const,
      ...(keyboard ?? {}),
    };

    try {
      if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
        await ctx.editMessageText(text, extra);

        return;
      }
    } catch (error) {
      console.warn(
        'Failed to edit Telegram message, falling back to reply:',
        error,
      );
    }

    await ctx.reply(text, extra);
  }
}
