/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { ExternalResourceRepository } from '../repositories/external-resource.repository';

@Injectable()
export class ExternalResourceService {
  constructor(private readonly repository: ExternalResourceRepository) {}

  // ============================================================
  // Categories
  // ============================================================

  async getRootCategories() {
    return this.repository.findRootCategories();
  }

  async getCategory(id: number) {
    const category = await this.repository.findCategoryById(id);

    if (!category) {
      throw new NotFoundException('التصنيف غير موجود');
    }

    return category;
  }

  async getChildCategories(parentId: number) {
    await this.getCategory(parentId);

    return this.repository.findChildCategories(parentId);
  }

  async createCategory(data: Prisma.ExternalCategoryCreateInput) {
    return this.repository.createCategory(data);
  }

  async updateCategory(id: number, data: Prisma.ExternalCategoryUpdateInput) {
    await this.getCategory(id);

    return this.repository.updateCategory(id, data);
  }

  async deleteCategory(id: number) {
    await this.getCategory(id);

    return this.repository.deleteCategory(id);
  }

  // ============================================================
  // Resources
  // ============================================================

  async getResources(categoryId: number) {
    await this.getCategory(categoryId);

    return this.repository.findResourcesByCategory(categoryId);
  }

  async getResource(id: number) {
    const resource = await this.repository.findResourceById(id);

    if (!resource) {
      throw new NotFoundException('المصدر غير موجود');
    }

    return resource;
  }

  async createResource(data: {
    categoryId: number;
    title: string;
    caption?: string;
    telegramChatId: string;
    telegramMessageId: number;
    telegramFileId?: string;
  }) {
    await this.getCategory(data.categoryId);

    return this.repository.createResource(data);
  }

  async categoryHasChildren(categoryId: number) {
    await this.getCategory(categoryId);

    return this.repository.hasChildren(categoryId);
  }

  async updateResource(id: number, data: Prisma.ExternalResourceUpdateInput) {
    await this.getResource(id);

    return this.repository.updateResource(id, data);
  }

  async deleteResource(id: number) {
    await this.getResource(id);

    return this.repository.deleteResource(id);
  }

  async categoryHasResources(categoryId: number) {
    await this.getCategory(categoryId);

    return this.repository.hasResources(categoryId);
  }
}
