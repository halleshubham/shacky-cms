'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gatedFileFromHref, hasLead, normaliseMobile, rememberLead, validateLead, type GatedFile, type LeadErrors } from '@/lib/download-gate';

interface Props {
  /** Slug of the CMS form that receives the entries (name, mobile, email, file, page, consent). */
  formSlug: string;
  title?: string;
  intro?: string;
  consent?: string;
  lang?: string;
}

const TEXT: Record<string, Record<string, string>> = {
  en: {
    title: 'Before you download', intro: 'Please tell us who you are. We ask only once on this device.',
    consent: 'I agree that my name, mobile number and email may be stored and used to contact me about this organisation’s work.',
    name: 'Name', mobile: 'Mobile number', email: 'Email', submit: 'Continue to download', cancel: 'Cancel', file: 'File',
    errName: 'Please enter your name.', errMobile: 'Please enter a valid mobile number.', errEmail: 'Please enter a valid email address.', errConsent: 'Please tick the box to continue.',
    sending: 'Saving…', offline: 'We could not save your details just now, but your download will start.',
  },
  mr: {
    title: 'डाउनलोड करण्यापूर्वी', intro: 'कृपया तुमची माहिती द्या. या उपकरणावर आम्ही ती फक्त एकदाच विचारतो.',
    consent: 'माझे नाव, मोबाईल क्रमांक आणि ईमेल या संस्थेच्या कामाबद्दल माझ्याशी संपर्क साधण्यासाठी साठवले व वापरले जाण्यास माझी संमती आहे.',
    name: 'नाव', mobile: 'मोबाईल क्रमांक', email: 'ईमेल', submit: 'डाउनलोड सुरू करा', cancel: 'रद्द करा', file: 'फाईल',
    errName: 'कृपया तुमचे नाव लिहा.', errMobile: 'कृपया योग्य मोबाईल क्रमांक लिहा.', errEmail: 'कृपया योग्य ईमेल पत्ता लिहा.', errConsent: 'पुढे जाण्यासाठी चौकटीत खूण करा.',
    sending: 'साठवत आहे…', offline: 'तुमची माहिती आत्ता साठवता आली नाही, पण डाउनलोड सुरू होईल.',
  },
};

interface Pending { file: GatedFile; target: string | null; download: boolean; opener: Element | null }

function startDownload(p: Pending) {
  const a = document.createElement('a');
  a.href = p.file.url;
  if (p.target) { a.target = p.target; a.rel = 'noopener'; }
  if (p.download) a.setAttribute('download', '');
  a.setAttribute('data-gate-bypass', '');
  a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
}

/**
 * Mounted once in the public layout when the site has set `download_gate_form`. Intercepts clicks on links to documents
 * hosted on this site, asks for name / mobile / email in a dialog the first time, posts them to the CMS form, remembers
 * the visitor in this browser and then starts the download. It is a soft gate: it collects details from people who use
 * the site's links; the file URLs themselves stay public so existing shared links keep working.
 */
export function DownloadGate({ formSlug, title, intro, consent, lang }: Props) {
  const t = TEXT[(lang || 'en').slice(0, 2)] ?? TEXT.en;
  const [pending, setPending] = useState<Pending | null>(null);
  const [vals, setVals] = useState({ name: '', mobile: '', email: '', consent: false, website: '' });
  const [errors, setErrors] = useState<LeadErrors>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setPending((p) => { (p?.opener as HTMLElement | null)?.focus?.(); return null; });
    setErrors({}); setNote(''); setBusy(false);
  }, []);

  // intercept clicks on gated document links
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.hasAttribute('data-gate-bypass') || a.closest('[data-download-gate]')) return;
      const file = gatedFileFromHref(a.getAttribute('href'), window.location.origin);
      if (!file || hasLead(formSlug)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      setPending({ file, target: a.getAttribute('target'), download: a.hasAttribute('download'), opener: a });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [formSlug]);

  // dialog behaviour: focus, Esc, Tab trap, no background scroll
  useEffect(() => {
    if (!pending) return;
    firstField.current?.focus();
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('input,button,a[href]')).filter((x) => !x.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [pending, close]);

  if (!pending) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateLead(vals);
    setErrors(errs);
    if (Object.keys(errs).length) { (dialogRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(); return; }
    // a bot filled the hidden field: pretend it worked, record nothing
    if (vals.website) { startDownload(pending); close(); return; }
    setBusy(true);
    const lead = { name: vals.name.trim(), mobile: normaliseMobile(vals.mobile)!, email: vals.email.trim().toLowerCase(), at: new Date().toISOString() };
    try {
      const res = await fetch(`/api/forms/public/${encodeURIComponent(formSlug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, file: pending.file.name, page: window.location.pathname, consent: 'yes' }),
      });
      if (res.ok) { rememberLead(formSlug, lead); }
      else if (res.status === 400 || res.status === 404) {
        // the form rejected the entry or the form is gone: let the visitor retry / do not hold the file hostage to a broken form
        if (res.status === 400) { const d = await res.json().catch(() => ({})); setNote(d.message || ''); setBusy(false); return; }
      } else { setNote(t.offline); }
    } catch { setNote(t.offline); }
    startDownload(pending); close();
  };

  const field = (id: 'name' | 'mobile' | 'email', label: string, type: string, auto: string, mode?: 'tel' | 'email', err?: string) => (
    <div className="space-y-1" data-gate-field>
      <label htmlFor={`dg-${id}`} className="block text-sm font-medium">{label}<span aria-hidden="true" className="text-destructive"> *</span></label>
      <input id={`dg-${id}`} ref={id === 'name' ? firstField : undefined} type={type} autoComplete={auto} inputMode={mode} required
        value={vals[id]} onChange={(e) => setVals({ ...vals, [id]: e.target.value })}
        aria-invalid={err ? true : undefined} aria-describedby={err ? `dg-${id}-err` : undefined}
        className="w-full h-11 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
      {err && <p id={`dg-${id}-err`} role="alert" className="text-xs text-destructive">{err}</p>}
    </div>
  );

  return (
    <div data-download-gate className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dg-title" data-download-gate-panel
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-background text-foreground rounded-t-xl sm:rounded-xl shadow-xl p-5 sm:p-6">
        <h2 id="dg-title" className="text-xl font-bold leading-tight">{title || t.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{intro || t.intro}</p>
        <p className="mt-3 text-xs text-muted-foreground break-all" data-gate-file><span className="font-semibold">{t.file}:</span> {pending.file.name}</p>
        <form onSubmit={submit} noValidate className="mt-4 space-y-4" data-gate-form>
          {field('name', t.name, 'text', 'name', undefined, errors.name && t.errName)}
          {field('mobile', t.mobile, 'tel', 'tel', 'tel', errors.mobile && t.errMobile)}
          {field('email', t.email, 'email', 'email', 'email', errors.email && t.errEmail)}
          {/* honeypot: real visitors never see or fill this */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
            <label>Website<input tabIndex={-1} autoComplete="off" value={vals.website} onChange={(e) => setVals({ ...vals, website: e.target.value })} /></label>
          </div>
          <div className="space-y-1">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={vals.consent} onChange={(e) => setVals({ ...vals, consent: e.target.checked })}
                aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? 'dg-consent-err' : undefined} className="mt-1 h-5 w-5 flex-none accent-primary" />
              <span>{consent || t.consent}</span>
            </label>
            {errors.consent && <p id="dg-consent-err" role="alert" className="text-xs text-destructive">{t.errConsent}</p>}
          </div>
          {note && <p role="status" className="text-sm text-destructive">{note}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
            <button type="button" onClick={close} className="h-11 px-4 rounded-md border border-input text-sm font-semibold hover:bg-muted">{t.cancel}</button>
            <button type="submit" disabled={busy} className="h-11 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60" data-gate-submit>{busy ? t.sending : t.submit}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
