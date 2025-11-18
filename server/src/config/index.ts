export default {
  default: {},
  audit: {
    omitFields: ['createdAt','createdBy','updatedAt','updatedBy','publishedAt','users','roles','permissions'],
  },
  schema:{
    version: {
      audit: '1.0.0',
    }
  },
  validator() {},
};
