'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormDef {
  name: string;
  slug: string;
  fields: FormField[];
  successMessage?: string;
}

export default function PublicFormPage({ params }: { params: { slug: string } }) {
  const [form, setForm] = useState<FormDef | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const siteSettings = useSiteSettings();
  const siteName = siteSettings.site_title || 'Shacky CMS';

  useEffect(() => {
    fetch(`/api/forms/public/${params.slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setForm(d);
        const initial: Record<string, string> = {};
        for (const f of d.fields) initial[f.name] = '';
        setValues(initial);
      })
      .catch(() => setNotFound(true));
  }, [params.slug]);

  const set = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const e = { ...prev }; delete e[name]; return e; });
  };

  const validate = (): boolean => {
    if (!form) return false;
    const errs: Record<string, string> = {};
    for (const field of form.fields) {
      if (field.required && !values[field.name]?.trim()) {
        errs[field.name] = `${field.label} is required`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError('');
    try {
      const res = await fetch(`/api/forms/public/${params.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      setSuccessMsg(data.message || 'Thank you for your submission.');
      setSubmitted(true);
    } catch (err: any) {
      setServerError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Form not found</p>
          <p className="text-sm mt-1">This form may be inactive or the link may be incorrect.</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <p className="text-sm text-muted-foreground">{siteName}</p>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {submitted ? (
            <div className="bg-card border rounded-xl p-8 text-center space-y-3 shadow-sm">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
              </div>
              <h1 className="text-xl font-semibold">{successMsg}</h1>
              <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setValues(Object.fromEntries(form.fields.map((f) => [f.name, '']))); }}>
                Submit another response
              </Button>
            </div>
          ) : (
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
              <div className="bg-primary px-6 py-5">
                <h1 className="text-xl font-semibold text-primary-foreground">{form.name}</h1>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                {form.fields.map((field) => (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={field.name} className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>

                    {field.type === 'textarea' ? (
                      <Textarea
                        id={field.name}
                        placeholder={field.placeholder}
                        value={values[field.name] || ''}
                        onChange={(e) => set(field.name, e.target.value)}
                        rows={4}
                        className={errors[field.name] ? 'border-destructive' : ''}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={field.name}
                        value={values[field.name] || ''}
                        onChange={(e) => set(field.name, e.target.value)}
                        className={`w-full h-9 text-sm rounded-md border bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring ${errors[field.name] ? 'border-destructive' : 'border-input'}`}
                      >
                        <option value="">— select —</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div className="space-y-1.5">
                        {(field.options || []).map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name={field.name}
                              value={opt}
                              checked={values[field.name] === opt}
                              onChange={(e) => set(field.name, e.target.value)}
                              className="accent-primary"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={values[field.name] === 'true'}
                          onChange={(e) => set(field.name, e.target.checked ? 'true' : '')}
                          className="accent-primary"
                        />
                        {field.placeholder || field.label}
                      </label>
                    ) : (
                      <Input
                        id={field.name}
                        type={field.type === 'phone' ? 'tel' : field.type}
                        placeholder={field.placeholder}
                        value={values[field.name] || ''}
                        onChange={(e) => set(field.name, e.target.value)}
                        className={errors[field.name] ? 'border-destructive' : ''}
                      />
                    )}

                    {errors[field.name] && (
                      <p className="text-xs text-destructive">{errors[field.name]}</p>
                    )}
                  </div>
                ))}

                {serverError && (
                  <p className="text-sm text-destructive">{serverError}</p>
                )}

                <Button type="submit" disabled={submitting} className="w-full gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
