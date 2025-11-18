import type { Core } from '@strapi/strapi';
import config from '../config';

const audit = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Capture audit from Document Service middleware
   */
  async capture(data: {
    uid: string;
    action: string;
    before: any;
    after: any;
    params: any;
  }) {
    try {
      // Get current user from context (if available)
      const ctx = strapi.requestContext?.get();
      const user = ctx?.state?.user;

      // Create audit entry
      await strapi.documents('plugin::strapi-table-stakes.audit').create({
        data: {
          schema_version: config.schema.version.audit,
          target_document_id: data.after?.documentId || data.before?.documentId || 'unknown',
          content_type: data.uid,
          locale: data.params?.locale || data.after?.locale,
          operation: data.action,
          operation_status: 'success',
          operation_user_id: user?.id,
          operation_user_email: user?.email,
          operation_user_name: user?.username || user?.firstname,
          snapshot_before: data.before,
          snapshot_after: data.after,
          ip_address: ctx?.request?.ip,
          user_agent: ctx?.request?.get?.('user-agent'),
        },
      });
    } catch (error) {
      // Log error but don't break the operation
      strapi.log.error('Failed to create audit log (capture):', error);
    }
  },
});

export default audit;
