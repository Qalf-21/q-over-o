// src/features/profile/pages/UserProfilePage.tsx
// REDIRECTS to /dashboard/profile — all settings are now at that route.
// This file is kept as a safety net in case any in-app link still points here.

import React from 'react';
import { Navigate } from 'react-router-dom';

export const UserProfilePage: React.FC = () => {
  return <Navigate to="/dashboard/profile" replace />;
};
