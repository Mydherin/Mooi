import type { DeploymentActivity } from '../types/DeploymentActivity';

export const formatDeploymentActivity = (item: DeploymentActivity): string => {
  const time = Number.isNaN(Date.parse(item.at)) ? item.at : new Date(item.at).toLocaleTimeString(undefined, { hour12: false });
  const prefix = `[${time}] [${item.source}] [${item.level}]${item.phase ? ` [${item.phase}]` : ''}`;
  return `${prefix} ${item.title}${item.status ? ` (${item.status})` : ''}${item.detail ? `\n${item.detail}` : ''}`;
};
