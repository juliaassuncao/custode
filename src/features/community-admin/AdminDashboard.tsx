import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listedChapters } from '../../data/chapter28/metadata';
import { AdminAccessError } from './adminAuth';
import { AdminModerationActions } from './AdminModerationActions';
import type { AdminMutation } from './adminMutate';
import { adminRead, commentStates, reportStates, type AdminComment, type AdminHistory, type AdminPage, type AdminReport, type AdminResource } from './adminRead';
import './admin-dashboard.scss';

const resources: Record<AdminResource, string> = { comments: 'Comentários', reports: 'Denúncias', history: 'Histórico' };
const actions: Record<string, string> = {
  comment_hidden: 'Comentário ocultado', comment_restored: 'Comentário restaurado',
  comment_removed: 'Comentário removido', report_resolved: 'Denúncia resolvida', report_dismissed: 'Denúncia descartada',
};
const reasons: Record<string, string> = {
  spam: 'Spam', harassment: 'Assédio', hate_or_discrimination: 'Ódio ou discriminação',
  spoiler: 'Spoiler', inappropriate_content: 'Conteúdo impróprio', other: 'Outro motivo',
};
const dates = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
function timestamp(value: string) { return <time dateTime={value}>{dates.format(new Date(value))}</time>; }
function status(value: string | null) {
  return value === null ? 'Não registrado' : ({ ...commentStates, ...reportStates } as Record<string, string>)[value] ?? 'Estado não reconhecido';
}

function CommentCard({ item, children }: { item: AdminComment; children: ReactNode }) {
  return <article className="admin-dashboard__entry">
    <header><h3>{item.pseudonym}</h3><span className="admin-dashboard__badge">{commentStates[item.status]}</span></header>
    <p className="admin-dashboard__meta">Capítulo {item.chapter_number} · {timestamp(item.created_at)}</p>
    <p className="admin-dashboard__body">{item.body}</p>
    {item.moderation_reason && <p className="admin-dashboard__note"><strong>Motivo da moderação:</strong> {item.moderation_reason}</p>}
    {item.moderated_at && <p className="admin-dashboard__meta">Moderado em {timestamp(item.moderated_at)}</p>}
    {children}
  </article>;
}

function ReportCard({ item, children }: { item: AdminReport; children: ReactNode }) {
  return <article className="admin-dashboard__entry">
    <header><h3>{reasons[item.reason_code] ?? 'Denúncia'}</h3><span className="admin-dashboard__badge">{reportStates[item.status]}</span></header>
    <p className="admin-dashboard__meta">Capítulo {item.comment.chapter_number} · {timestamp(item.created_at)}</p>
    {item.details && <p className="admin-dashboard__body">{item.details}</p>}
    <blockquote><p className="admin-dashboard__meta">Comentário de {item.comment.pseudonym} · {commentStates[item.comment.status]}</p><p className="admin-dashboard__body">{item.comment.body}</p></blockquote>
    {item.resolution_note && <p className="admin-dashboard__note"><strong>Observação da resolução:</strong> {item.resolution_note}</p>}
    {item.resolved_at && <p className="admin-dashboard__meta">Encerrada em {timestamp(item.resolved_at)}</p>}
    {children}
  </article>;
}

function HistoryCard({ item }: { item: AdminHistory }) {
  return <article className="admin-dashboard__entry">
    <header><h3>{actions[item.action] ?? 'Evento de moderação'}</h3>{timestamp(item.created_at)}</header>
    <p>{status(item.before)} → {status(item.after)}</p>
    {item.reason && <p className="admin-dashboard__body"><strong>Motivo:</strong> {item.reason}</p>}
  </article>;
}

type Props = { onAccessDenied(message: string): void };
export function AdminDashboard({ onAccessDenied }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const resource: AdminResource = tab === 'reports' || tab === 'history' ? tab : 'comments';
  const [chapterDraft, setChapterDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [filters, setFilters] = useState({ chapter: '', status: '' });
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [revision, setRevision] = useState(0);
  // Keep unresolved commands when moving between tabs/pages; retries reuse them.
  const [pending, setPending] = useState<Record<string, AdminMutation>>({});
  const [feedback, setFeedback] = useState('');
  const cursor = cursors[cursors.length - 1];
  const query = { resource, ...filters, cursor };
  const key = JSON.stringify(query);
  const [result, setResult] = useState<{ key: string; page?: AdminPage<AdminResource>; error?: string }>({ key: '' });
  const loading = result.key !== key || (!result.page && !result.error);

  useEffect(() => {
    const controller = new AbortController();
    setResult(previous => previous.key === key && previous.page ? { key, page: previous.page } : { key });
    void adminRead({ resource, chapter: filters.chapter, status: filters.status, cursor }, controller.signal).then(page => {
      if (!controller.signal.aborted) setResult({ key, page });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AdminAccessError && error.reason !== 'unavailable') { onAccessDenied(error.message); return; }
      setResult(previous => ({ key, page: previous.key === key ? previous.page : undefined,
        error: 'Não foi possível carregar os registros. Tente novamente.' }));
    });
    return () => controller.abort();
  }, [key, resource, filters.chapter, filters.status, cursor, revision, onAccessDenied]);

  function selectResource(next: AdminResource) {
    setSearchParams(previous => {
      const params = new URLSearchParams(previous);
      params.set('tab', next);
      return params;
    }, { replace: true });
    setStatusDraft('');
    setFilters(previous => ({ ...previous, status: '' })); setCursors([null]);
  }
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ chapter: chapterDraft ? String(Number(chapterDraft)) : '', status: statusDraft });
    setCursors([null]); setRevision(value => value + 1);
  }

  const states: Record<string, string> = resource === 'comments' ? commentStates : resource === 'reports' ? reportStates : {};
  const page = result.key === key ? result.page : undefined;
  function moderationControls(item: AdminComment | AdminReport, kind: 'comment' | 'report') {
    return <AdminModerationActions key={`${item.id}:${item.moderation_version}`} target={item.id} version={item.moderation_version}
      kind={kind} status={item.status} pending={pending[item.id]} onPending={command => setPending(previous => {
        const next = { ...previous };
        if (command) next[item.id] = command; else delete next[item.id];
        return next;
      })} onSuccess={message => { setFeedback(message); setRevision(value => value + 1); }}
      onRefresh={() => setRevision(value => value + 1)} onAccessDenied={onAccessDenied} />;
  }
  return <section className="admin-dashboard" aria-label="Registros de moderação">
    <nav className="admin-dashboard__tabs" aria-label="Consultas administrativas">
      {(Object.keys(resources) as AdminResource[]).map(value => <button key={value} type="button" aria-pressed={resource === value} onClick={() => selectResource(value)}>{resources[value]}</button>)}
    </nav>
    <form className="admin-dashboard__filters" onSubmit={applyFilters}>
      <label>Capítulo<select value={chapterDraft} onChange={event => setChapterDraft(event.target.value)}>
        <option value="">Todos os capítulos</option>
        {listedChapters.map(chapter => <option key={chapter.number} value={chapter.number}>{chapter.title}</option>)}
      </select></label>
      <label>Estado<select value={statusDraft} disabled={resource === 'history'} onChange={event => setStatusDraft(event.target.value)}>
        <option value="">{resource === 'history' ? 'Não se aplica' : 'Todos os estados'}</option>
        {Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="nav-button" type="submit">Aplicar filtros</button>
      <button className="nav-button" type="button" onClick={() => { setChapterDraft(''); setStatusDraft(''); setFilters({ chapter: '', status: '' }); setCursors([null]); setRevision(value => value + 1); }}>Limpar filtros</button>
    </form>
    <div className="admin-dashboard__heading"><h2>{resources[resource]}</h2><p>{filters.chapter ? `Capítulo ${filters.chapter}` : 'Todos os capítulos'} · Mais recentes primeiro</p></div>
    {feedback && <p role="status" className="admin-dashboard__note">{feedback}</p>}
    {resource === 'history' && <p className="admin-dashboard__meta">O histórico permite filtrar por capítulo. O filtro por estado está disponível em comentários e denúncias.</p>}
    <div aria-busy={loading}>
      {loading ? <p role="status" className="admin-dashboard__notice">Carregando registros…</p> : <>
        {result.error && <div className="admin-dashboard__notice"><p role="alert">{result.error}</p><button className="nav-button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>}
        {page && <>
        <p role="status" className="admin-dashboard__meta">{page.items.length === 0 ? 'Nenhum registro encontrado para esta consulta.' : `${page.items.length} registro(s) nesta página.`}</p>
        {page.items.map(item => resource === 'comments' ? <CommentCard key={item.id} item={item as AdminComment}>{moderationControls(item as AdminComment, 'comment')}</CommentCard> : resource === 'reports' ? <ReportCard key={item.id} item={item as AdminReport}>{moderationControls(item as AdminReport, 'report')}</ReportCard> : <HistoryCard key={item.id} item={item as AdminHistory} />)}
        </>}
      </>}
    </div>
    <nav className="admin-dashboard__pagination" aria-label="Paginação dos registros">
      <button className="nav-button" disabled={loading || cursors.length === 1} onClick={() => setCursors(previous => previous.slice(0, -1))}>Página anterior</button>
      <span>Página {cursors.length}</span>
      <button className="nav-button" disabled={loading || !page?.next_cursor} onClick={() => { if (page?.next_cursor) setCursors(previous => [...previous, page.next_cursor]); }}>Próxima página</button>
    </nav>
  </section>;
}
