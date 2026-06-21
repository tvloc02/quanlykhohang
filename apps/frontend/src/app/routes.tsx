import { Navigate } from 'react-router-dom';

export const routes = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
];
