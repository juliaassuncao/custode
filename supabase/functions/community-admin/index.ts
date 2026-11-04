import { createCommunityAdminHandler } from '../_shared/community-admin-handler.ts';

Deno.serve(createCommunityAdminHandler({ env: name => Deno.env.get(name), fetch }));
