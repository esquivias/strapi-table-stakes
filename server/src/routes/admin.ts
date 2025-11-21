export default [
  // Audits routes for admin panel
  {
    method: 'GET',
    path: '/audits',
    handler: 'audits.find',
    config: {
      policies: [],
    },
  },
  // Tasks CRUD routes for admin panel
  {
    method: 'GET',
    path: '/tasks',
    handler: 'tasks.find',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/tasks/:id',
    handler: 'tasks.findOne',
    config: {
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/tasks',
    handler: 'tasks.create',
    config: {
      policies: [],
    },
  },
  {
    method: 'PUT',
    path: '/tasks/:id',
    handler: 'tasks.update',
    config: {
      policies: [],
    },
  },
  {
    method: 'DELETE',
    path: '/tasks/:id',
    handler: 'tasks.delete',
    config: {
      policies: [],
    },
  },
];
