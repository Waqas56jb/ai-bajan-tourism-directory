import { useId, useRef, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { formatBytes } from '@/utils/formatNumber';

/**
 * Drag-and-drop file picker with client-side validation (type + size).
 * DEMO: files are only read for their name/size/type — nothing is uploaded or parsed.
 *
 * accept: { 'application/pdf': ['.pdf'], ... }
 */
export function FileUpload({
  accept,
  maxSizeMb = 10,
  multiple = true,
  files,
  onChange,
  label = 'Upload files',
  helper,
}) {
  const id = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const extensions = Object.values(accept).flat();

  const validate = (list) => {
    const ok = [];
    const errs = [];
    for (const file of list) {
      const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!extensions.includes(ext))
        errs.push(`${file.name}: unsupported type. Allowed: ${extensions.join(', ')}.`);
      else if (file.size > maxSizeMb * 1024 * 1024) errs.push(`${file.name}: larger than ${maxSizeMb} MB.`);
      else if (files.some((f) => f.name === file.name && f.size === file.size))
        errs.push(`${file.name}: already added.`);
      else
        ok.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          type: file.type || ext,
          file,
        });
    }
    setErrors(errs);
    if (ok.length) onChange(multiple ? [...files, ...ok] : ok.slice(0, 1));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          validate([...e.dataTransfer.files]);
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-50' : 'border-line bg-subtle/40'}`}
      >
        <UploadCloud className="mb-2 h-7 w-7 text-accent" aria-hidden="true" />
        <p className="text-sm font-medium text-ink">
          Drag and drop, or{' '}
          <button
            type="button"
            className="font-semibold text-accent-600 underline-offset-2 hover:underline"
            onClick={() => inputRef.current?.click()}
          >
            browse files
          </button>
        </p>
        <p id={`${id}-help`} className="mt-1 text-xs text-muted">
          {helper ?? `${extensions.join(', ').toUpperCase()} · up to ${maxSizeMb} MB each`}
        </p>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={extensions.join(',')}
          aria-describedby={`${id}-help`}
          onChange={(e) => {
            validate([...e.target.files]);
            e.target.value = '';
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul className="mt-2 space-y-1" role="alert">
          {errors.map((e) => (
            <li key={e} className="text-xs font-medium text-danger">
              {e}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line" aria-label="Selected files">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                <p className="text-xs text-muted">
                  {formatBytes(f.size)} · {f.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-subtle hover:text-danger"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
