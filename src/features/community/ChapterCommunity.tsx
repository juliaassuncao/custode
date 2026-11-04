import { useId, useRef, useState } from 'react';
import { useChapterCommunity } from './hooks/useChapterCommunity';
import { ChapterCloverButton } from './components/ChapterCloverButton';
import { CommentComposer } from './components/CommentComposer';
import { CommunityComments } from './components/CommunityComments';
import { CommentReportForm } from './components/CommentReportForm';
import { CommunityAction } from './components/CommunityAction';
import { CommunityFeedback, type CommunityNotice } from './components/CommunityFeedback';
import { clearComment, commentValidation, preserveComment, restoreComment, type CommentDraft } from './services/commentDraft';
import type { Mutation } from './services/communityWrite';
import type { CommentOrder, CommunityComment, WriteResults } from './types';
import './chapter-community.scss';

export function ChapterCommunity({ chapterNumber }: { chapterNumber: number }) {
  const [order, setOrder] = useState<CommentOrder>('desc');
  const feed = useChapterCommunity(chapterNumber, order);
  const [pending, setPending] = useState<CommentDraft | null>(() => restoreComment(chapterNumber));
  const [pseudonym, setPseudonym] = useState(pending?.pseudonym ?? '');
  const [body, setBody] = useState(pending?.body ?? '');
  const attempted = useRef(!!pending);
  const uncertain = useRef(!!pending);
  const [intent, setIntent] = useState<Mutation | null>(null);
  const [reportFor, setReportFor] = useState<CommunityComment | null>(null);
  const [reported, setReported] = useState(new Set<string>());
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState<CommunityNotice | null>(null);
  const serial = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  function rememberFocus() { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  function restoreFocus() { requestAnimationFrame(() => {
    if (opener.current?.isConnected && !(opener.current instanceof HTMLButtonElement && opener.current.disabled)) opener.current.focus({ preventScroll: true });
    else heading.current?.focus({ preventScroll: true });
  }); }
  function cancel() {
    if (intent?.operation === 'comment' && !attempted.current) setPending(null);
    setIntent(null); restoreFocus();
  }
  function publish() {
    if (intent || !feed.ready) return;
    const error = commentValidation(pseudonym, body);
    setValidation(error ?? '');
    if (error) return;
    rememberFocus(); setNotice(null); setReportFor(null);
    const command = pending ?? { operation: 'comment' as const, chapter_number: chapterNumber,
      pseudonym: pseudonym.trim(), body: body.trim(), client_request_id: crypto.randomUUID() };
    setPending(command); setIntent(command);
  }
  function success(result: WriteResults[Mutation['operation']]) {
    if (result.operation === 'clover') {
      feed.confirmClover(result.clover_count);
    } else if (result.operation === 'comment') {
      clearComment(chapterNumber); setPending(null); attempted.current = false; uncertain.current = false; setBody('');
      void feed.load(true);
    } else {
      if (intent?.operation === 'report') setReported((old) => new Set([...old, intent.comment_id]));
      setReportFor(null);
    }
    setIntent(null);
    setNotice({ operation: result.operation, serial: ++serial.current, message: result.operation === 'comment' ? 'Comentário publicado.' : result.operation === 'clover' ? 'Você deixou um trevo.' : 'Denúncia enviada.' });
    restoreFocus();
  }
  const action = intent && <CommunityAction key={`${intent.operation}:${intent.operation === 'report' ? intent.comment_id : chapterNumber}`}
    command={intent} onSuccess={success} onCancel={cancel}
    onAttempt={() => {
      if (intent.operation === 'comment') { preserveComment(intent); attempted.current = true; }
    }} onUncertain={() => {
      if (intent.operation === 'comment') uncertain.current = true;
    }} onRejected={() => {
      // A rejected retry does not resolve an earlier attempt that may have committed.
      if (intent.operation === 'comment' && !uncertain.current) { clearComment(chapterNumber); attempted.current = false; }
    }} />;
  return <section className="chapter-community" aria-labelledby={titleId}>
    <ChapterCloverButton count={feed.clover_count} hasLeft={feed.has_left_clover} ready={feed.ready}
      disabled={!!intent} onLeave={() => { rememberFocus(); setReportFor(null); setNotice(null); setIntent({ operation: 'clover', chapter_number: chapterNumber }); }}>
      {intent?.operation === 'clover' && action}
      <CommunityFeedback notice={notice?.operation === 'clover' ? notice : null} />
    </ChapterCloverButton>
    <header className="chapter-community__heading">
      <div className="chapter-community__title"><h2 id={titleId} ref={heading} tabIndex={-1}>Comentários</h2>
        <span className="chapter-community__chapter">CAP. {String(chapterNumber).padStart(2, '0')}</span></div>
    </header>
    <CommentComposer pseudonym={pseudonym} body={body} locked={!!pending} pending={!!pending && attempted.current}
      disabled={!feed.ready || !!intent} error={validation} onPseudonym={setPseudonym} onBody={setBody} onPublish={publish} />
    {intent?.operation === 'comment' && action}
    <CommunityFeedback notice={notice?.operation === 'comment' ? notice : null} />
    <div className="chapter-community__conversation" aria-busy={feed.loading}>
      <div className="chapter-community__list-heading"><h3 className="community-visually-hidden">Comentários deste capítulo</h3>
        <label className="community-order"><span className="community-visually-hidden">Ordenar comentários</span>
          <select value={order} disabled={!!intent} onChange={(event) => setOrder(event.target.value as CommentOrder)}>
            <option value="desc">Mais recentes primeiro</option><option value="asc">Mais antigos primeiro</option>
          </select></label></div>
      {reportFor && <CommentReportForm key={reportFor.id} comment={reportFor} locked={!!intent}
        onCancel={() => { setReportFor(null); restoreFocus(); }} onSubmit={(command) => { setNotice(null); setIntent(command); }} />}
      {intent?.operation === 'report' && action}
      <CommunityFeedback notice={notice?.operation === 'report' ? notice : null} />
      {!feed.ready && feed.loading && <p className="community-empty" role="status">Abrindo a conversa…</p>}
      {feed.ready && !feed.comments.length && <div className="community-empty">
        <p>Ainda não há comentários.</p></div>}
      <CommunityComments comments={feed.comments} reported={reported} disabled={!!intent || !feed.ready} onReport={(comment) => {
        rememberFocus(); setReportFor(comment); setNotice(null);
      }} />
      {feed.error && <div className="community-message community-message--error" role="alert"><p>{feed.error}</p>
        <button className="community-text-button" type="button" disabled={feed.loading} onClick={() => void feed.retry()}>Tentar novamente</button></div>}
      {feed.next_cursor && <button className="community-button community-button--secondary community-load-more" type="button" disabled={feed.loading}
        onClick={() => void feed.load()}>{feed.loading ? 'Carregando…' : 'Carregar mais comentários'}<span aria-hidden="true">↓</span></button>}
    </div>
  </section>;
}
