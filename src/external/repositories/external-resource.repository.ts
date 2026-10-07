/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExternalResourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Categories
  // ============================================================

  async findRootCategories() {
    return this.prisma.externalCategory.findMany({
      where: {
        parentId: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findCategoryById(id: number) {
    return this.prisma.externalCategory.findUnique({
      where: { id },
    });
  }

  async findChildCategories(parentId: number) {
    return this.prisma.externalCategory.findMany({
      where: {
        parentId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createCategory(data: Prisma.ExternalCategoryCreateInput) {
    return this.prisma.externalCategory.create({
      data,
    });
  }

  async updateCategory(id: number, data: Prisma.ExternalCategoryUpdateInput) {
    return this.prisma.externalCategory.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: number) {
    return this.prisma.externalCategory.delete({
      where: { id },
    });
  }

  // ============================================================
  // Resources
  // ============================================================

  async findResourcesByCategory(categoryId: number) {
    return this.prisma.externalResource.findMany({
      where: {
        categoryId,
      },
      orderBy: {
        title: 'asc',
      },
    });
  }

  async findResourceById(id: number) {
    return this.prisma.externalResource.findUnique({
      where: { id },
    });
  }

  async createResource(data: {
    categoryId: number;
    title: string;
    caption?: string;
    telegramChatId: string;
    telegramMessageId: number;
    telegramFileId?: string;
  }) {
    return this.prisma.externalResource.create({
      data: {
        title: data.title,
        caption: data.caption,
        telegramChatId: data.telegramChatId,
        telegramMessageId: data.telegramMessageId,
        telegramFileId: data.telegramFileId,

        category: {
          connect: {
            id: data.categoryId,
          },
        },
      },
    });
  }

  async hasChildren(categoryId: number) {
    const count = await this.prisma.externalCategory.count({
      where: {
        parentId: categoryId,
      },
    });

    return count > 0;
  }

  async hasResources(categoryId: number) {
    const count = await this.prisma.externalResource.count({
      where: {
        categoryId,
      },
    });

    return count > 0;
  }

  async updateResource(id: number, data: Prisma.ExternalResourceUpdateInput) {
    return this.prisma.externalResource.update({
      where: { id },
      data,
    });
  }

  async deleteResource(id: number) {
    return this.prisma.externalResource.delete({
      where: { id },
    });
  }
}
