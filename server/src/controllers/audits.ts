import type { Core } from '@strapi/strapi';

const auditsController = ({ strapi }: { strapi: Core.Strapi }) => ({
  // Get audits filtered by content_type and document_id
  async find(ctx: any) {
    try {
      const { content_type, document_id } = ctx.query;

      const where: any = {};
      if (content_type) {
        where.content_type = content_type;
      }
      if (document_id) {
        where.target_document_id = document_id;
      }

      const audits = await strapi.documents('plugin::strapi-table-stakes.audit').findMany({
        filters: where,
        sort: { createdAt: 'desc' },
        limit: 50, // Limit to recent 50 snapshots
      });

      ctx.body = audits;
    } catch (error) {
      strapi.log.error('Failed to fetch audits:', error);
      ctx.throw(500, 'Failed to fetch audits');
    }
  },
});

export default auditsController;
