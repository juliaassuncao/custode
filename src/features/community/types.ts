export type CommunityComment = { id: string; pseudonym: string; body: string; created_at: string };
export type CommentOrder = 'asc' | 'desc';
export type CommunityPage = {
  chapter_number: number;
  comments: CommunityComment[];
  clover_count: number;
  has_left_clover: boolean;
  next_cursor: string | null;
};
export type NumberedCommunityPage = CommunityPage & {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
};
export type WriteResults = {
  comment: { operation: 'comment'; comment_id: string; created_at: string; replayed: boolean };
  clover: { operation: 'clover'; clover_count: number; already_left: boolean };
  report: { operation: 'report'; reported: boolean; already_reported: boolean };
};
