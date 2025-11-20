import type { Core } from '@strapi/strapi';

export interface TaskDocument {
  content_type: string;
  document_id: string;
  operation: 'publish' | 'unpublish';
  locale?: string;
}

export interface TaskResult {
  content_type: string;
  document_id: string;
  operation: string;
  success: boolean;
  error?: string;
}

const task = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Execute a scheduled task
   */
  async execute(taskId: string) {
    try {
      // Fetch the task
      const task = await strapi.documents('plugin::strapi-table-stakes.task').findOne({
        documentId: taskId,
      });

      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.status !== 'pending') {
        strapi.log.warn(`Task ${taskId} is not pending (status: ${task.status})`);
        return;
      }

      const documents = task.documents as TaskDocument[];
      if (!Array.isArray(documents) || documents.length === 0) {
        throw new Error(`Task ${taskId} has no documents to process`);
      }

      strapi.log.info(`Executing task ${taskId} with ${documents.length} document(s)`);

      // Execute operations on all documents
      const results: TaskResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const doc of documents) {
        try {
          strapi.log.info(`  ${doc.operation} ${doc.content_type}/${doc.document_id}`);

          if (doc.operation === 'publish') {
            await (strapi.documents as any)(doc.content_type).publish({
              documentId: doc.document_id,
              locale: doc.locale,
            });
          } else if (doc.operation === 'unpublish') {
            await (strapi.documents as any)(doc.content_type).unpublish({
              documentId: doc.document_id,
              locale: doc.locale,
            });
          }

          results.push({
            content_type: doc.content_type,
            document_id: doc.document_id,
            operation: doc.operation,
            success: true,
          });
          successCount++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          strapi.log.error(`  Failed: ${errorMsg}`);

          results.push({
            content_type: doc.content_type,
            document_id: doc.document_id,
            operation: doc.operation,
            success: false,
            error: errorMsg,
          });
          failureCount++;
        }
      }

      // Determine final status
      let status: 'completed' | 'partial' | 'failed';
      if (failureCount === 0) {
        status = 'completed';
      } else if (successCount === 0) {
        status = 'failed';
      } else {
        status = 'partial';
      }

      // Mark task as completed/partial/failed
      await strapi.documents('plugin::strapi-table-stakes.task').update({
        documentId: taskId,
        data: {
          status,
          executed_at: new Date().toISOString(),
          results,
        } as any,
      });

      strapi.log.info(`Task ${taskId} ${status}: ${successCount} succeeded, ${failureCount} failed`);
      return results;
    } catch (error) {
      strapi.log.error(`Task ${taskId} failed:`, error);

      // Mark task as failed
      await strapi.documents('plugin::strapi-table-stakes.task').update({
        documentId: taskId,
        data: {
          status: 'failed',
          executed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
        } as any,
      });

      throw error;
    }
  },

  /**
   * Process all pending tasks that are due
   */
  async processPendingTasks() {
    const now = new Date().toISOString();

    try {
      // Find all pending tasks that are due
      const dueTasks = await strapi.db.query('plugin::strapi-table-stakes.task').findMany({
        where: {
          status: 'pending',
          scheduled_at: {
            $lte: now,
          },
        },
        orderBy: { scheduled_at: 'asc' },
      });

      strapi.log.info(`Found ${dueTasks.length} pending tasks to process`);

      // Execute each task
      for (const task of dueTasks) {
        try {
          await this.execute(task.documentId);
        } catch (error) {
          // Log error but continue processing other tasks
          strapi.log.error(`Failed to execute task ${task.documentId}:`, error);
        }
      }

      return dueTasks.length;
    } catch (error) {
      strapi.log.error('Failed to process pending tasks:', error);
      throw error;
    }
  },
});

export default task;
