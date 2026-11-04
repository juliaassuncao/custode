import { useEffect, useState } from 'react';
import { CommunityIcon } from './CommunityIcon';
export type CommunityNotice = { operation: 'comment' | 'clover' | 'report'; serial: number; message: string };
export function CommunityFeedback({ notice }: { notice: CommunityNotice | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(!!notice);
    if (!notice) return;
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  return <div role="status" aria-live="polite" aria-atomic="true">{visible && notice &&
    <p className="community-message community-message--success"><CommunityIcon name="check" />{notice.message}</p>}</div>;
}
