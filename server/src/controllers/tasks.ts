import type { Core } from '@strapi/strapi';

const tasksController = ({ strapi }: { strapi: Core.Strapi }) => ({
  // Get all tasks (optionally filter by status)
  async find(ctx: any) {
    try {
      const { status } = ctx.query;

      const where: any = {};
      if (status) {
        where.status = status;
      }

      const tasks = await strapi.documents('plugin::strapi-table-stakes.task').findMany({
        ...where,
      });

      ctx.body = tasks;
    } catch (error) {
      ctx.throw(500, 'Failed to fetch tasks');
    }
  },

  // Get single task by documentId
  async findOne(ctx: any) {
    try {
      const { id } = ctx.params;

      const task = await strapi.documents('plugin::strapi-table-stakes.task').findOne({
        documentId: id,
      });

      if (!task) {
        return ctx.notFound('Task not found');
      }

      ctx.body = task;
    } catch (error) {
      ctx.throw(500, 'Failed to fetch task');
    }
  },

  // Create new task
  async create(ctx: any) {
    try {
      const data = ctx.request.body;

      // Validate required fields
      if (!data.name || !data.scheduled_at) {
        return ctx.badRequest('name and scheduled_at are required');
      }

      const task = await strapi.documents('plugin::strapi-table-stakes.task').create({
        data: {
          name: data.name,
          documents: data.documents || [],
          scheduled_at: data.scheduled_at,
          status: 'pending',
        },
      });

      ctx.body = task;
    } catch (error) {
      strapi.log.error('Failed to create task:', error);
      ctx.throw(500, 'Failed to create task');
    }
  },

  // Update task
  async update(ctx: any) {
    try {
      const { id } = ctx.params;
      const data = ctx.request.body;

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.documents !== undefined) updateData.documents = data.documents;
      if (data.scheduled_at !== undefined) updateData.scheduled_at = data.scheduled_at;
      if (data.status !== undefined) updateData.status = data.status;

      const task = await strapi.documents('plugin::strapi-table-stakes.task').update({
        documentId: id,
        data: updateData,
      });

      ctx.body = task;
    } catch (error) {
      strapi.log.error('Failed to update task:', error);
      ctx.throw(500, 'Failed to update task');
    }
  },

  // Delete task
  async delete(ctx: any) {
    try {
      const { id } = ctx.params;

      await strapi.documents('plugin::strapi-table-stakes.task').delete({
        documentId: id,
      });

      ctx.body = { message: 'Task deleted' };
    } catch (error) {
      strapi.log.error('Failed to delete task:', error);
      ctx.throw(500, 'Failed to delete task');
    }
  },
});

export default tasksController;
