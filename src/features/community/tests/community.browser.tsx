// Development-only React integration harness. Run on a spare local Vite origin.
// It replaces transport/Auth/widget only for the duration of this function.
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { ChapterCommunity } from '../ChapterCommunity';
import { supabase } from '../../../lib/supabase/client';
import type { TurnstileApi } from '../services/turnstileScript';
import type { Mutation } from '../services/communityWrite';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export async function runChapterCommunityBrowserTests() {
  check(import.meta.env.DEV && ['127.0.0.1','localhost'].includes(location.hostname), 'Use local Vite');
  check(supabase, 'Public test configuration required');
  check(!document.querySelector('.chapter-community'), 'Run on the Home route, without a mounted community');
  const client = supabase;
  const original = { fetch: window.fetch, api: window.turnstile, getSession: client.auth.getSession,
    onAuthStateChange: client.auth.onAuthStateChange, signInAnonymously: client.auth.signInAnonymously, setTimeout: window.setTimeout };
  const flags = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const originalAct = flags.IS_REACT_ACT_ENVIRONMENT;
  flags.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  let root = createRoot(host);
  let session: Session | null = null;
  const subscriptions = new Set<(event: AuthChangeEvent, session: Session | null) => void | Promise<void>>();
  let widgetOptions: Parameters<TurnstileApi['render']>[1] | undefined;
  let signup = 0, reads = 0, writes = 0, count = 2, hasClover = false;
  const readOrders: (string | null)[] = [];
  let timeout = false, rateLimit = false, readFailure = false, rejectProof = false;
  let holdViewerRead = false;
  let releaseViewerRead: (() => void) | undefined;
  let expireFeedback: (() => void) | undefined;
  let signupProof = '';
  window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    const id = original.setTimeout.call(window, handler, delay, ...args);
    if (delay === 8000 && typeof handler === 'function') expireFeedback = () => { clearTimeout(id); handler(...args); };
    return id;
  }) as typeof window.setTimeout;
  const sent: Mutation[] = [];
  const published = new Map<string, {id:string;created_at:string}>();
  const first = { id:'00000000-0000-4000-8000-000000000001', pseudonym:'Primeira leitora',
    body:'<img src=x onerror="alert(1)"> Texto literal.', created_at:'2026-11-03T10:00:00Z' };
  const second = {...first,id:'00000000-0000-4000-8000-000000000002',pseudonym:'Segunda leitora',body:'Uma segunda impressão.',created_at:'2026-11-03T11:00:00Z'};
  const draftKeys = [1,2].map(n=>`custode-community-comment-${n}`);
  const savedDrafts = draftKeys.map(key=>sessionStorage.getItem(key));
  draftKeys.forEach(key=>sessionStorage.removeItem(key));
  const settle = async () => { await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));}); };
  const mount = async (chapter=1) => { await act(async()=>root.render(<StrictMode><ChapterCommunity key={chapter} chapterNumber={chapter} /></StrictMode>)); await settle(); };
  const click = async (element: Element | null) => {
    check(element instanceof HTMLElement,'Missing clickable element');
    await act(async()=>{element.focus();element.click();});
    await settle();
  };
  const text = () => host.textContent ?? '';
  const button = (label:string) => [...host.querySelectorAll('button')].find(b=>b.textContent?.replace(/[↗↓]/g,'').trim()===label) ?? null;
  const proof = async () => {
    check(widgetOptions,'Challenge not mounted');
    await act(async()=>widgetOptions!.callback(crypto.randomUUID()));
    await settle();
  };
  const fill = async(selector:string,value:string) => {
    const input=host.querySelector(selector);
    check(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement,'Missing field');
    const prototype=input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  };
  client.auth.getSession = (async()=>({data:{session},error:null})) as typeof client.auth.getSession;
  client.auth.onAuthStateChange = ((callback)=>{
    subscriptions.add(callback);
    return {data:{subscription:{id:crypto.randomUUID(),callback,unsubscribe:()=>{subscriptions.delete(callback);}}}};
  }) as typeof client.auth.onAuthStateChange;
  client.auth.signInAnonymously = (async(options)=>{
    check(options?.options?.captchaToken,'Signup skipped proof'); signup++;
    signupProof = options!.options!.captchaToken!;
    session={access_token:'synthetic-browser-session',refresh_token:'synthetic-refresh',expires_at:Date.now()/1000+3600,
      user:{id:'synthetic-browser-viewer',is_anonymous:true}} as Session;
    subscriptions.forEach(callback=>void callback('SIGNED_IN',session));
    return {data:{session,user:session.user},error:null};
  }) as typeof client.auth.signInAnonymously;
  window.turnstile={render:(_node,options)=>{widgetOptions=options;return crypto.randomUUID();},remove:()=>{}};
  window.fetch=async(input,options)=>{
    const url=new URL(String(input));
    check(url.hostname==='127.0.0.1' || url.hostname==='localhost','Unexpected nonlocal transport');
    if(url.pathname.endsWith('/community-read')) {
      reads++;
      readOrders.push(url.searchParams.get('order'));
      if(readFailure) return Response.json({error:{code:'internal_error'}},{status:500});
      const next=url.searchParams.has('cursor');
      const desc=url.searchParams.get('order')==='desc';
      if(next) check(url.searchParams.get('cursor')===(desc?'page-2-desc':'page-2'),'Cursor crossed ordering');
      const payload={chapter_number:Number(url.searchParams.get('chapter')),comments:desc?(next?[first]:[second]):(next?[second]:[first]),
        clover_count:count,has_left_clover:hasClover,next_cursor:next?null:desc?'page-2-desc':'page-2'};
      if(holdViewerRead && session) {holdViewerRead=false;await new Promise<void>(resolve=>{releaseViewerRead=resolve;});}
      return Response.json(payload);
    }
    check(url.pathname.endsWith('/community-write'),'Unexpected endpoint');
    const command=JSON.parse(String(options?.body));
    check(command.captcha_token,'Mutation without proof');
    check(command.captcha_token!==signupProof,'Auth proof reused for write');
    check(!('author_id' in command) && !('status' in command),'Client controls actor/status');
    writes++; sent.push(command);
    if(rejectProof) {rejectProof=false;return Response.json({error:{code:'captcha_failed'}},{status:403});}
    if(rateLimit) {rateLimit=false;return Response.json({error:{code:'rate_limited'}},{status:429,headers:{'Retry-After':'1'}});}
    if(command.operation==='clover') {const already=hasClover;if(!hasClover)count++;hasClover=true;return Response.json({operation:'clover',clover_count:count,already_left:already});}
    if(command.operation==='report') return Response.json({operation:'report',reported:true,already_reported:false});
    const existing=published.get(command.client_request_id);
    const result=existing??{id:crypto.randomUUID(),created_at:new Date().toISOString()};
    published.set(command.client_request_id,result);
    if(timeout) {timeout=false;throw new Error('Synthetic timeout after commit');}
    return Response.json({operation:'comment',comment_id:result.id,created_at:result.created_at,replayed:!!existing});
  };
  try {
    await mount();
    check(Number(signup)===0 && Number(writes)===0,'Read caused participation');
    check(Number(reads)===1,'StrictMode duplicated the initial request');
    check(text().includes('Segunda leitora'),'Comments not loaded: '+text());
    check(readOrders[0]==='desc' && host.querySelector<HTMLSelectElement>('.community-order select')?.value==='desc','Initial query/order must be newest first');
    check(host.querySelector('.chapter-community__clover')?.nextElementSibling?.classList.contains('chapter-community__heading'),'Clover must precede Comments');
    check(host.querySelectorAll('.community-comment img').length===0,'Comment HTML executed');
    check(host.querySelectorAll('.community-comment .chapter-clover').length===0,'Comment has a clover');
    await click(button('Carregar mais comentários'));
    check(host.querySelectorAll('.community-comment').length===2,'Cursor did not append');
    check(text().indexOf('Segunda leitora')<text().indexOf('Primeira leitora'),'Descending pagination failed');

    const order = host.querySelector<HTMLSelectElement>('.community-order select')!;
    await act(async()=>{order.value='asc';order.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
    check(host.querySelectorAll('.community-comment').length===1 && text().includes('Primeira leitora'),'Order did not restart at server page');
    await click(button('Carregar mais comentários'));
    check(text().indexOf('Primeira leitora')<text().indexOf('Segunda leitora'),'Ascending pagination failed');
    await act(async()=>{order.value='desc';order.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
    check(host.querySelectorAll('.community-comment').length===1 && text().includes('Segunda leitora'),'Descending reset mixed pages');
    await click(button('Publicar'));
    check(text().includes('Use um pseudônimo de 2 a 40 caracteres.'),'Empty form validation lost');
    check(host.querySelector('[name=pseudonym][aria-invalid=true]'),'Invalid name not exposed accessibly');
    check(Number(signup)===0 && Number(writes)===0,'Validation triggered participation');
    const leave = host.querySelector<HTMLButtonElement>('.chapter-clover')!;
    await act(async()=>{leave.focus();leave.click();leave.click();});await settle();
    check(document.activeElement===host.querySelector('.community-action h3'),'Action heading not focused');
    check(widgetOptions?.size==='compact','Mobile widget must fit');
    holdViewerRead=true;
    check(!text().includes('Iniciar sessão anônima'),'Separate auth button remains');
    await proof();
    check(Number(signup)===1 && Number(writes)===0,'Signup reused its proof for a mutation');
    await proof();
    check(Number(writes)===1,'Double click duplicated a mutation');
    check(host.querySelector('.chapter-clover')?.hasAttribute('disabled'),'Clover not confirmed/disabled');
    check(host.querySelector('.chapter-clover--active'),'Clover not filled');
    check(host.querySelector('.chapter-community__count')?.textContent?.includes('3'),'Confirmed clover left the feed unavailable');
    check(host.querySelector('.chapter-community__clover [role=status] .community-message--success'),'Clover feedback misplaced');
    check(expireFeedback,'Missing temporary feedback timer');
    await act(async()=>expireFeedback!());
    check(!host.querySelector('.community-message--success'),'Feedback did not expire');
    await act(async()=>releaseViewerRead?.());await settle();
    check(host.querySelector('.chapter-clover--active'),'An older personalization response undid a confirmed clover');
    await act(async()=>root.unmount());root=createRoot(host);await mount();
    check(host.querySelector<HTMLSelectElement>('.community-order select')?.value==='desc','Reload retained an old ordering preference');
    check(host.querySelector('.chapter-clover--active'),'Reload did not read server clover state');
    check(Number(signup)===1,'Reload created another identity');

    await click(host.querySelector('.community-comment button'));
    await click(button('Enviar denúncia')); await proof();
    check(text().includes('Denúncia enviada.'),'Report success missing');
    check(host.querySelectorAll('.community-comment').length===1,'Report hid a comment');
    check(text().includes('Denúncia enviada'),'Reported state missing');

    await fill('[name=pseudonym]','Leitora');await fill('[name=comment]','Um comentário para guardar.');
    await click(button('Publicar'));timeout=true;await proof();
    check(text().includes('Não foi possível confirmar'),'Timeout not explained');
    const pending=JSON.parse(sessionStorage.getItem(draftKeys[0])!);
    check(pending.client_request_id,'Retry UUID not preserved before sending');
    rejectProof=true;await click(button('Tentar novamente'));await proof();
    check(JSON.parse(sessionStorage.getItem(draftKeys[0])!).client_request_id===pending.client_request_id,
      'Rejected retry discarded an earlier uncertain commit');
    await act(async()=>root.unmount());root=createRoot(host);await mount();
    check(button('Reenviar'),'Pending draft lost on reload');
    await click(button('Reenviar'));await proof();
    check(text().includes('Comentário publicado.'),'Uncertain write not confirmed');
    check(host.querySelector('.community-composer + [role=status] .community-message--success'),'Comment feedback misplaced');
    const comments=sent.filter((command):command is Extract<Mutation,{operation:'comment'}>=>command.operation==='comment');
    check(comments.length===3 && comments.every(comment=>comment.client_request_id===comments[0].client_request_id),'Retry UUID changed');
    check(published.size===1 && sessionStorage.getItem(draftKeys[0])===null,'Duplicate publication or draft retained');

    await fill('[name=comment]','Outro comentário.');await click(button('Publicar'));
    rateLimit=true;await proof();
    check(text().includes('1s'),'Retry-After not displayed');
    check(host.querySelector('.community-action .community-button')?.hasAttribute('disabled'),'Rate limit did not disable confirmation');
    await click(button('Cancelar'));
    readFailure=true;await mount(2);
    check(text().includes('indisponível'),'Community failure not isolated');
    readFailure=false;await click(button('Tentar novamente'));
    check(text().includes('Segunda leitora'),'Error retry failed');
    check(!button('Reenviar'),'Chapter retained another chapter draft');
    return {passed:true,checks:['lazy participation','StrictMode read deduplication','literal HTML','both cursor orders',
      'focus','compact challenge','automatic continuation with fresh proofs','double click','server clover recovery','report stays visible',
      'uncertain write/reload/idempotency','Retry-After','temporary feedback and placement','error recovery','chapter isolation'],reads,writes,signup};
  } finally {
    await act(async()=>root.unmount());host.remove();
    window.fetch=original.fetch;window.turnstile=original.api;window.setTimeout=original.setTimeout;
    client.auth.getSession=original.getSession;client.auth.onAuthStateChange=original.onAuthStateChange;client.auth.signInAnonymously=original.signInAnonymously;
    draftKeys.forEach((key,index)=>{if(savedDrafts[index]===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,savedDrafts[index]!);});
    flags.IS_REACT_ACT_ENVIRONMENT=originalAct;
  }
}
