/**
 * Auth API route — mounts better-auth handler.
 * SD §11.1: All auth endpoints served via /api/auth/*
 */

import { auth } from '@erp/services/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
