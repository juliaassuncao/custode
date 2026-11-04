import { useState } from "react";
import { resolveAssetUrl } from "./resolve-asset-url";
import type { SocialPostProps } from "./props";
import C from "./constants";
import S from "./styles.module.scss";

const SocialPostContent = ({
  post,
  posts,
  identities,
  media,
  isReply = false,
  isQuote = false,
  connectsFromPreviousReply = false,
  connectsToNextReply = false,
}: SocialPostProps) => {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const quotedPost = post.quotedPostId ? posts[post.quotedPostId] : undefined;

  if (post.quotedPostId && !quotedPost) {
    throw new Error(
      `SocialPost ${post.id}: unknown quoted post ${post.quotedPostId}.`,
    );
  }

  const author = identities[post.authorId];

  if (!author) {
    throw new Error(`SocialPost ${post.id}: unknown author ${post.authorId}.`);
  }

  const avatar = author.avatarMediaId ? media[author.avatarMediaId] : undefined;
  const nameParts = author.displayName.trim().split(/\s+/).filter(Boolean);
  const initials =
    author.avatarInitials ??
    [
      nameParts[0],
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined,
    ]
      .filter(Boolean)
      .map((part) => part!.slice(0, 1))
      .join("")
      .toLocaleUpperCase("pt-BR");

  if (author.avatarMediaId && !avatar) {
    throw new Error(
      `SocialPost ${post.id}: unknown avatar ${author.avatarMediaId}.`,
    );
  }

  const postMedia = (post.mediaIds ?? []).map((id) => {
    const asset = media[id];

    if (!asset) {
      throw new Error(`SocialPost ${post.id}: unknown media ${id}.`);
    }

    return asset;
  });

  const metrics =
    isReply || isQuote
      ? []
      : C.metrics.filter(({ key }) => post.metrics?.[key] !== undefined);
  const compactTimestamp = isQuote ? post.relativeTimestamp : post.timestamp;

  const hasTwoMedia = postMedia.length === 2;
  const hasFourMedia = postMedia.length === 4;
  const postBody = (
    <p className={`${S.body} lt-social-post__body`}>{post.text}</p>
  );
  const postActions = (
    <div className={`${S.postActions} lt-social-post__post-actions`}>
      {C.actions
        .filter(({ replyOnly }) => !replyOnly || isReply)
        .map(({ id, icon, label, smallerOnMainPost, metricKey }) => {
          const actionMetric =
            isReply && metricKey ? post.metrics?.[metricKey] : undefined;

          return (
            <span key={id} className={`${S.action} lt-social-post__action`}>
              <img
                className={`${S.iconImage}${smallerOnMainPost && !isReply ? ` ${S.smallerMainIcon} lt-social-post__icon-image--smaller-main` : ""} lt-social-post__icon-image`}
                src={resolveAssetUrl(icon)}
                alt={label}
              />
              {actionMetric && (
                <span
                  className={`${S.actionMetric} lt-social-post__action-metric`}
                >
                  {actionMetric}
                </span>
              )}
            </span>
          );
        })}
    </div>
  );

  return (
    <article
      className={`${S.post} lt-social-post${isReply ? ` ${S.reply} lt-social-post__reply` : ""}${isQuote ? ` ${S.quote} lt-social-post__quote` : ""}${connectsFromPreviousReply ? ` ${S.replyConnectionFromPrevious} lt-social-post__reply--connected-from-previous` : ""}${connectsToNextReply ? ` ${S.replyConnectionToNext} lt-social-post__reply--connected-to-next` : ""}`}
    >
      <div className={`${S.header} lt-social-post__header`}>
        <div className={`${S.avatar} lt-social-post__avatar`}>
          {avatar && failedAvatar !== avatar.relativePath ? (
            <img
              className={`${S.avatarImage} lt-social-post__avatar-image`}
              src={resolveAssetUrl(avatar.relativePath)}
              alt=""
              onError={() => setFailedAvatar(avatar.relativePath)}
            />
          ) : (
            <span className={S.avatarInitials} aria-hidden="true">
              {initials}
            </span>
          )}
        </div>
        <div className={`${S.identity} lt-social-post__identity`}>
          <div className={`${S.identityLine} lt-social-post__identity-line`}>
            <p className={`${S.author} lt-social-post__author`}>
              <strong>{author.displayName}</strong>
              {author.verification === "blue" && (
                <span className={`${S.badge} lt-social-post__badge`}>
                  <img
                    className={`${S.badgeImage} lt-social-post__badge-image`}
                    src={resolveAssetUrl(C.icons.verified)}
                    alt={C.labels.verified}
                  />
                </span>
              )}
              {author.verification === "gold" && (
                <span
                  className={`${S.badge} ${S.goldBadge} lt-social-post__badge lt-social-post__gold-badge`}
                >
                  <img
                    className={`${S.badgeImage} lt-social-post__badge-image`}
                    src={resolveAssetUrl(C.icons.verifiedGold)}
                    alt={C.labels.verifiedGold}
                  />
                </span>
              )}
              {author.isPrivate && (
                <span className={`${S.badge} lt-social-post__badge`}>
                  <img
                    className={`${S.badgeImage} lt-social-post__badge-image`}
                    src={resolveAssetUrl(C.icons.private)}
                    alt={C.labels.private}
                  />
                </span>
              )}
            </p>
            <p className={`${S.username} lt-social-post__username`}>
              {author.username}
            </p>
            {(isReply || isQuote) && compactTimestamp && (
              <span
                className={`${S.replyTimestamp} lt-social-post__reply-timestamp`}
              >
                {" · "}
                {compactTimestamp}
              </span>
            )}
          </div>

          {post.replyingTo && (
            <p className={`${S.replyingTo} lt-social-post__replying-to`}>
              {C.labels.replyingTo}{" "}
              <span className={`${S.replyTarget} lt-social-post__reply-target`}>
                {post.replyingTo.username}
              </span>
            </p>
          )}

          {isReply && !isQuote && (
            <>
              {postBody}
              {postActions}
            </>
          )}
        </div>
        {!isQuote && (
          <div className={`${S.more} lt-social-post__more-info`}>
            <img
              className={`${S.moreImage} lt-social-post__more-image`}
              src={resolveAssetUrl(C.icons.moreImage)}
              alt={C.labels.moreImage}
            />
          </div>
        )}
      </div>

      {(!isReply || isQuote) && postBody}

      {!isQuote && quotedPost && (
        <SocialPostContent
          post={quotedPost}
          posts={posts}
          identities={identities}
          media={media}
          isQuote
        />
      )}

      {postMedia.length > 0 && (
        <div
          className={`${S.media} lt-social-post__media${hasTwoMedia ? ` ${S.twoMedia} lt-social-post__media--two` : ""}${hasFourMedia ? ` ${S.fourMedia} lt-social-post__media--four` : ""}`}
        >
          {postMedia.map((asset) => (
            <figure
              key={asset.id}
              className={`${S.mediaItem} lt-social-post__media-item`}
            >
              <img
                className={`${S.mediaImage} lt-social-post__media-image`}
                src={resolveAssetUrl(asset.relativePath)}
                alt={asset.alt}
              />
            </figure>
          ))}
        </div>
      )}

      {!isReply && !isQuote && (post.timestamp || post.views) && (
        <p className={`${S.timestamp} lt-social-post__timestamp`}>
          {post.timestamp}
          {post.views && (
            <>
              {post.timestamp && " · "}
              <strong
                className={`${S.metricValue} lt-social-post__metric-value`}
              >
                {post.views}
              </strong>{" "}
              {C.labels.views}
            </>
          )}
        </p>
      )}

      {metrics.length > 0 && (
        <div className={`${S.metrics} lt-social-post__metrics`}>
          {metrics.map(({ key, label }) => (
            <p key={key} className={`${S.metric} lt-social-post__metric`}>
              <strong
                className={`${S.metricValue} lt-social-post__metric-value`}
              >
                {post.metrics?.[key]}
              </strong>{" "}
              {label}
            </p>
          ))}
        </div>
      )}

      {!isReply && !isQuote && postActions}

      {!isQuote && post.replies && post.replies.length > 0 && (
        <div className={`${S.replies} lt-social-post__replies`}>
          {post.replies.map((reply, index, replies) => {
            const previousReply = replies[index - 1];
            const nextReply = replies[index + 1];

            return (
              <SocialPostContent
                key={reply.id}
                post={reply}
                posts={posts}
                identities={identities}
                media={media}
                isReply
                connectsFromPreviousReply={
                  previousReply !== undefined &&
                  reply.replyingTo?.postId === previousReply.id
                }
                connectsToNextReply={nextReply?.replyingTo?.postId === reply.id}
              />
            );
          })}
        </div>
      )}
    </article>
  );
};

// Portado do Linha Tenue. O escopo local protege o componente dos estilos do leitor.
export const SocialPost = (props: SocialPostProps) => (
  <div className={S.scope}>
    <SocialPostContent {...props} />
  </div>
);
