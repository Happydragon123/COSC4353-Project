export function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function dateLabel(value){return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
export function timeLabel(value){return new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}
