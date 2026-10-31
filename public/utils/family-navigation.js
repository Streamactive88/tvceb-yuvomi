const SIMPLE_PATHS=new Set(['/','/tasks','/calendar','/shopping','/settings','/m/tvceb-family','/m/tvceb-knowledgebase','/m/tvceb-whatsapp','/m/tvceb-cctv','/m/tvceb-vaultwarden']);
export function simplifyFamilyNavigation(items,enabled){
  // Never strand an installation where Family home is absent or disabled.
  if(!enabled||!items.some(item=>item.path==='/m/tvceb-family'))return items;
  return items.filter(item=>SIMPLE_PATHS.has(item.path));
}
