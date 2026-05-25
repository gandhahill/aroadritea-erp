'use client';

import { Button, Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createTicketAction } from '../actions';

export function NewTicketClient() {
  const t = useTranslations('helpdesk');
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [category, setCategory] = useState<'bug' | 'request' | 'question' | 'other'>('other');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (subject.trim().length < 3) {
      setError(t('subjectRequired'));
      return;
    }
    if (body.trim().length < 3) {
      setError(t('bodyRequired'));
      return;
    }
    startTransition(async () => {
      const res = await createTicketAction({
        subject: subject.trim(),
        body: body.trim(),
        priority,
        category,
        createdVia: 'manual',
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.id) router.push(`/helpdesk/${res.id}`);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-cream-3 bg-card p-4">
      <label className="block space-y-1 text-sm">
        <span className="text-brand-ink-2">{t('subject')}</span>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('subjectPlaceholder')}
          maxLength={200}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('priority.label')}</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          >
            <option value="low">{t('priority.low')}</option>
            <option value="normal">{t('priority.normal')}</option>
            <option value="high">{t('priority.high')}</option>
            <option value="urgent">{t('priority.urgent')}</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('category.label')}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          >
            <option value="bug">{t('category.bug')}</option>
            <option value="request">{t('category.request')}</option>
            <option value="question">{t('category.question')}</option>
            <option value="other">{t('category.other')}</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-brand-ink-2">{t('body')}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={5000}
          placeholder={t('bodyPlaceholder')}
          className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        />
      </label>
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button variant="primary" size="md" disabled={pending} onClick={submit}>
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </div>
  );
}
