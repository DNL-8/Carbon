import { handleApiRequest } from '../../../src/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export {
  handleApiRequest as GET,
  handleApiRequest as POST,
  handleApiRequest as PUT,
  handleApiRequest as PATCH,
  handleApiRequest as DELETE,
  handleApiRequest as OPTIONS,
  handleApiRequest as HEAD,
};
