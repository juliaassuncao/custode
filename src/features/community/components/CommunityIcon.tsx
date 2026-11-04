type Name = 'person' | 'shield' | 'flag' | 'check';
const paths: Record<Name, string> = {
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  shield: 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3ZM8 12l3 3 5-6',
  flag: 'M5 21V4m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0',
  check: 'm5 12 4 4L19 6',
};
export function CommunityIcon({ name }: { name: Name }) {
  return <svg className="community-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
