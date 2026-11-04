import { SocialPost } from '../../../../components/SocialPost';
import type { MediaAssetProps, SocialIdentityProps, SocialPostContentProps } from '../../../../components/SocialPost/props';
import tweets from '../../../../data/chapter28/tweets.json';
import styles from './styles.module.scss';

const avatarFiles: Record<string, string> = {
  '@Custorette': 'custorette.png',
  '@Daniliiima': 'dani-lima.jpg',
  '@GEFerette': 'ge-ferette.jpeg',
  '@LorenaFeretteBrasil': 'portal.jpg',
  '@TimeLoarda': 'time-loarda.jpg',
};
const media: Record<string, MediaAssetProps> = Object.fromEntries(Object.entries(avatarFiles).map(([username, file]) => [username, {
  id: username,
  relativePath: `avatars/chapter28/${file}`,
  alt: '',
  source: ['Avatar fornecido pela autora'],
}]));

const identities: Record<string, SocialIdentityProps> = Object.fromEntries(tweets.map((tweet) => [tweet.username, {
  id: tweet.username,
  displayName: tweet.username.slice(1),
  username: tweet.username,
  avatarInitials: tweet.avatarInitials,
  avatarMediaId: avatarFiles[tweet.username] ? tweet.username : undefined,
}]));
const posts: SocialPostContentProps[] = tweets.map((tweet) => ({
  id: tweet.id,
  authorId: tweet.username,
  text: <span style={{ color: 'inherit' }} dangerouslySetInnerHTML={{ __html: tweet.html }} />,
  source: ['Capítulo 28.docx'],
}));
const postIndex = Object.fromEntries(posts.map((post) => [post.id, post]));

export function Chapter28Tweets() {
  return (
    <section className={styles.posts} aria-label="Publicações no X">
      {posts.map((post) => <SocialPost key={post.id} post={post} posts={postIndex} identities={identities} media={media} />)}
    </section>
  );
}
