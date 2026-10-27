export const roles = ['owner','admin','member','viewer'] as const;
export type Role = typeof roles[number];
export const capabilities = ['read','create','update','delete','invite','manage_members','audit','ownership'] as const;
export type Capability = typeof capabilities[number];
const grants: Record<Role,readonly Capability[]> = {
 owner:capabilities,admin:['read','create','update','delete','invite','manage_members','audit'],
 member:['read','update'],viewer:['read']
};
// Display hints only. PostgreSQL independently enforces access.
export function can(role:Role|undefined, action:Capability) { return !!role && grants[role].includes(action); }
