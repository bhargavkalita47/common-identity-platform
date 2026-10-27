import {describe,it,expect} from 'vitest';
import {can,roles,capabilities} from '../src/lib/permissions';
describe('Display permissions mirror the documented access matrix',()=>{
 it('grants owners all capabilities',()=>{for(const c of capabilities)expect(can('owner',c)).toBe(true);});
 it('keeps ownership restricted',()=>{for(const r of roles.filter(r=>r!=='owner'))expect(can(r,'ownership')).toBe(false);});
 it('restricts member and viewer mutations',()=>{expect(can('member','update')).toBe(true);expect(can('member','create')).toBe(false);expect(can('viewer','update')).toBe(false);expect(can(undefined,'read')).toBe(false);});
});
