import React from 'react';
import { Navigate } from 'react-router-dom';

export default function DocumentsPage() {
  return <Navigate to="/documents/sales-invoice" replace />;
}
