import { useState } from 'react';
import { ChangedFileRow } from '@/features/sessions/components/changes/ChangedFileRow';
import { ChangesSummary } from '@/features/sessions/components/changes/ChangesSummary';
import { DiffView } from '@/features/sessions/components/changes/DiffView';
import { changedFiles } from '@/features/sessions/data/changedFiles';

export const ChangesPanel = () => {
  const [selectedId, setSelectedId] = useState(changedFiles[0].id);
  const selectedFile = changedFiles.find((file) => file.id === selectedId) ?? changedFiles[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <ChangesSummary />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] lg:grid-cols-[minmax(220px,30%)_1fr] lg:grid-rows-[1fr]">
        <ul className="min-w-0 max-h-44 overflow-y-auto border-b border-line py-1 lg:max-h-none lg:border-r lg:border-b-0">
          {changedFiles.map((file) => (
            <ChangedFileRow
              key={file.id}
              file={file}
              selected={file.id === selectedFile.id}
              onSelect={setSelectedId}
            />
          ))}
        </ul>

        <div className="flex min-w-0 min-h-0 flex-col">
          <DiffView path={selectedFile.path} />
        </div>
      </div>
    </div>
  );
};
