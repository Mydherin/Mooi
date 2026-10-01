interface InheritedEnvironment {
  /** Short tag shown next to the variable. */
  tag: string;
  /** Where its value is managed. */
  owner: string;
}

const OWNERS: Record<string, InheritedEnvironment> = {
  MOOI_DEVELOPMENT_: { tag: 'dev', owner: 'any session of this project' },
  MOOI_PRODUCTION_: { tag: 'prod', owner: 'Deployments' },
};

/** Where an inherited variable comes from, by its name prefix. */
export const inheritedEnvironment = (name: string): InheritedEnvironment =>
  Object.entries(OWNERS).find(([prefix]) => name.startsWith(prefix))?.[1] ?? { tag: 'shared', owner: 'another configuration' };
