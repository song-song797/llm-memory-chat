import { useState } from 'react';

interface ProjectFormDialogProps {
  title: string;
  initialName?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export default function ProjectFormDialog({
  title,
  initialName = '',
  onSubmit,
  onClose,
}: ProjectFormDialogProps) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  const handleSubmit = () => {
    if (!trimmed) {
      return;
    }

    onSubmit(trimmed);
  };

  return (
    <div className="project-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="project-dialog-title">{title}</h2>
        <input
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="Project name"
        />
        <div className="project-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={!trimmed}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
