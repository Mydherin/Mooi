import { useId } from 'react';
import { Globe, Package } from 'lucide-react';
import { ProjectKindOption } from '@/features/projects/components/ProjectKindOption';
import { Eyebrow } from '@/shared/components/Eyebrow';

interface ProjectKindFieldProps {
  value: boolean | null;
  onChange: (webApplication: boolean) => void;
  hint: string;
}

/** The web application question, shared by the add flow and the edit dialog. */
export const ProjectKindField = ({ value, onChange, hint }: ProjectKindFieldProps) => {
  const name = useId();
  const questionId = useId();

  return (
    <div role="radiogroup" aria-labelledby={questionId} className="flex flex-col gap-3">
      <div>
        <Eyebrow>Project type</Eyebrow>
        <p id={questionId} className="mt-1 text-[17px] font-extrabold tracking-[-0.02em] text-ink">
          Is this a web application?
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{hint}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ProjectKindOption
          name={name}
          icon={Globe}
          title="Web application"
          description="Something you open in a browser: a site, a SPA or a full-stack app."
          features={['Chat & code', 'Deploy', 'Live preview']}
          checked={value === true}
          onSelect={() => onChange(true)}
        />
        <ProjectKindOption
          name={name}
          icon={Package}
          title="Other project"
          description="A library, CLI, API-only service or anything without a browser UI."
          features={['Chat & code']}
          checked={value === false}
          onSelect={() => onChange(false)}
        />
      </div>
    </div>
  );
};
