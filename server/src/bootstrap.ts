import type { Core } from '@strapi/strapi';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  // bootstrap phase
  strapi.documents.use(async (ctx, next) => {
    const { uid, action, params } = ctx;
    const documentId = (params as {documentId:string})?.documentId;

    // Skip auditing the audit itself to prevent infinite loops
    if (uid === 'plugin::strapi-table-stakes.audit') {
      return next();
    }

    // Skip fetch operations
    if (!['create', 'update', 'delete', 'publish', 'unpublish'].includes(action)) {
      return next();
    }

    // Capture the "before" state for update, delete, publish, and unpublish operations
    let before = null;
    if (['update', 'delete', 'publish', 'unpublish'].includes(action) && documentId) {
      try {
        // Use db.query to bypass Document Service middleware (prevents infinite loop)
        before = await strapi.db.query(uid).findOne({
          where: { documentId },
        });
      } catch (error) {
        // Silently fail - audit will still be created without before snapshot
      }
    }

    // Execute the operation
    const result = await next();

    // Capture audit (async, don't block)
    setImmediate(async () => {
      try {
        await strapi.plugin('strapi-table-stakes').service('audit').capture({
          uid,
          action,
          before,
          after: result,
          params: ctx.params,
        });
      } catch (error) {
        strapi.log.error('Failed to create audit log:', error);
      }
    });

    return result;
  });
};

export default bootstrap;
