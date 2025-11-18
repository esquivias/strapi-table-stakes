import type { Core } from '@strapi/strapi';
import config from '../config';

// Recursively omit specified fields from an object or array
const deepOmitFields = (obj: any, fieldsToOmit: Set<string>): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepOmitFields(item, fieldsToOmit));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip fields that should be omitted
      if (fieldsToOmit.has(key)) {
        continue;
      }
      // Recursively process nested objects/arrays
      result[key] = deepOmitFields(value, fieldsToOmit);
    }
    return result;
  }

  // Primitive values
  return obj;
};

// Build populate object by inspecting content type schema
// Automatically detects circular references and populates until no more relations
const _buildPopulate = (
  strapi: Core.Strapi,
  uid: string,
  visitedTypes: Set<string> = new Set()
): any => {
  const omitFields = new Set(config.audit.omitFields);

  // Prevent circular references
  if (visitedTypes.has(uid)) {
    return true;
  }

  const model = strapi.contentTypes[uid];
  if (!model?.attributes) return true;

  // Mark this type as visited in the current path
  const newVisited = new Set(visitedTypes);
  newVisited.add(uid);

  const populate: any = {};

  for (const [key, attr] of Object.entries(model.attributes)) {
    const attribute = attr as any;

    // Skip fields from populate
    if (omitFields.has(key)) {
      continue;
    }

    if (attribute.type === 'relation' && attribute.target) {
      const nested = _buildPopulate(strapi, attribute.target, newVisited);
      populate[key] = nested === true ? true : { populate: nested };
    } else if (attribute.type === 'component' && attribute.component) {
      const nested = _buildPopulate(strapi, attribute.component, newVisited);
      populate[key] = nested === true ? true : { populate: nested };
    } else if (attribute.type === 'dynamiczone' && attribute.components) {
      // Dynamic zones contain multiple components - build populate for each
      const on: any = {};
      for (const componentUid of attribute.components) {
        const nested = _buildPopulate(strapi, componentUid, newVisited);
        on[componentUid] = nested === true ? true : { populate: nested };
      }
      populate[key] = { on };
    } else if (attribute.type === 'media') {
      populate[key] = true;
    }
  }

  return Object.keys(populate).length > 0 ? populate : true;
};

const audit = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Build populate configuration for deep content snapshots
   */
  buildPopulate(uid: string) {
    return _buildPopulate(strapi, uid);
  },

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

      // Serialize snapshots to pure JSON (prevents Strapi from converting relations to counts)
      let snapshot_before = data.before ? JSON.parse(JSON.stringify(data.before)) : null;
      let snapshot_after = data.after ? JSON.parse(JSON.stringify(data.after)) : null;

      // Recursively omit configured fields from snapshots
      const fieldsToOmit = new Set(config.audit.omitFields);
      if (snapshot_before) {
        snapshot_before = deepOmitFields(snapshot_before, fieldsToOmit);
      }
      if (snapshot_after) {
        snapshot_after = deepOmitFields(snapshot_after, fieldsToOmit);
      }

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
          snapshot_before,
          snapshot_after,
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
