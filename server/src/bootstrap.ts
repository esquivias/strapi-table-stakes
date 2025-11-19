import type { Core } from '@strapi/strapi';
import auditService from './services/audit';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  // Initialize the audit service
  const audit = auditService({ strapi });

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
        const populate = audit.buildPopulate(uid);
        before = await strapi.documents(uid).findOne({
          documentId,
          populate,
        });
      } catch (error) {
        strapi.log.error('Failed to capture before snapshot:', error);
      }
    }

    // Inject populate into operation params to get fully populated result
    // This eliminates the need for a separate "after" query
    const originalPopulate = (params as any).populate;
    try {
      (params as any).populate = audit.buildPopulate(uid);
    } catch (error) {
      strapi.log.error('Failed to inject populate for audit:', error);
    }

    // Execute the operation (now with full population)
    const result = await next();

    // Restore original populate in case it's used elsewhere
    (params as any).populate = originalPopulate;

    // Capture audit (async, don't block)
    setImmediate(async () => {
      try {
        await audit.capture({
          uid,
          action,
          before,
          after: result, // Use result directly - already fully populated
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
