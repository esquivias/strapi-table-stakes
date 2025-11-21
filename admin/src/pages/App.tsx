import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';

import { HomePage } from './HomePage';
import { TasksPage } from './TasksPage';

const App = () => {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
};

export { App };
