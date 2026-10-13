import { useState } from 'react';
import { Globe } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { TextField, CheckboxField } from '@/components/common/Fields';
import { useApiMutation } from '@/hooks/useApi';
import { importDocumentFromUrl } from '@/services/knowledgeService';
import { isValidUrl } from '@/utils/validation';

/** Suggested reliable Barbadian sources (the team decides what to import). */
const SUGGESTED = [
  'gov.bb (Government of Barbados)',
  'barbadosparliament.com',
  'barbadosmuseum.org',
  'visitbarbados.org',
  'barbados.gov.bb ministries',
  'nationnews.com / barbadostoday.bb (news)',
];

/**
 * Import a page from a trusted website into the knowledge base. The API fetches the page, extracts
 * the readable text and keeps the URL so chatbot answers can cite it.
 */
export function ImportFromWebsite({ open, onOpenChange, canPublish }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [publish, setPublish] = useState(false);
  const urlOk = isValidUrl(url);

  const imp = useApiMutation(() => importDocumentFromUrl({ url: url.trim(), title: title.trim() || undefined, publish }), {
    invalidate: [['documents'], ['syncJobs']],
    success: (doc) => `Imported “${doc.title}”${publish ? ' and queued for indexing' : ' as a draft'}`,
    error: 'Import failed',
    onSuccess: () => {
      setUrl('');
      setTitle('');
      setPublish(false);
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Import from a website"
      description="Add a page from a reliable Barbadian source. Its text becomes searchable knowledge and answers will link back to it."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button icon={Globe} disabled={!urlOk} loading={imp.isPending} onClick={() => imp.mutate()}>
            Import page
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Page URL"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.gov.bb/…"
          error={url && !urlOk ? 'Enter a full URL starting with https://' : undefined}
        />
        <TextField label="Title (optional)" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} helper="Defaults to the page title." />
        {canPublish && (
          <CheckboxField
            label="Publish immediately"
            description="Otherwise it is saved as a draft for review before the assistant can use it."
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
        )}
        <div className="rounded-xl bg-subtle p-3 text-xs text-muted">
          <p className="font-semibold text-ink">Good sources to start with</p>
          <p className="mt-1">{SUGGESTED.join(' · ')}</p>
          <p className="mt-1">Web pages (HTML) only for now; PDFs are not supported yet.</p>
        </div>
      </div>
    </Modal>
  );
}
