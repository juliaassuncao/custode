import type { ReactNode } from 'react';
export interface MediaAssetProps {
  id: string;
  relativePath: string;
  alt: string;
  source: string[];
}

export interface SocialIdentityProps {
  id: string;
  displayName: string;
  username: string;
  avatarMediaId?: string;
  avatarInitials?: string;
  isPrivate?: boolean;
  verification?: 'blue' | 'gold';
}

export interface SocialPostMetricsProps {
  retweets?: string;
  quoteTweets?: string;
  likes?: string;
  replies?: string;
}

export interface SocialPostContentProps {
  id: string;
  authorId: string;
  text: ReactNode;
  timestamp?: string;
  relativeTimestamp?: string;
  views?: string;
  metrics?: SocialPostMetricsProps;
  mediaIds?: string[];
  source: string[];
  replyingTo?: {
    postId: string;
    username: string;
  };
  replies?: SocialPostContentProps[];
  quotedPostId?: string;
}

export interface SocialPostProps {
  post: SocialPostContentProps;
  posts: Record<string, SocialPostContentProps>;
  identities: Record<string, SocialIdentityProps>;
  media: Record<string, MediaAssetProps>;
  isReply?: boolean;
  isQuote?: boolean;
  connectsFromPreviousReply?: boolean;
  connectsToNextReply?: boolean;
}
