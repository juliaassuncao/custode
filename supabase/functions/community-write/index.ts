import { createCommunityWriteHandler } from '../_shared/community-write-handler.ts';

Deno.serve(createCommunityWriteHandler({ env: (name) => Deno.env.get(name), fetch }));
