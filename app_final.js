document.addEventListener('contextmenu', (e) => {
  // ✅ السماح بكليك يمين على عناصر التمرير والإدخال
  const allowed = e.target.closest(
    'input, textarea, select, a, [contenteditable], .tbl-wrap, .page-body, .inbox-scrl, .sb-nav, .wa-scope, .modal, .hm-body'
  );
  if (!allowed) e.preventDefault();
});

document.addEventListener('keydown', (e) => {
  // استثناء نماذج الإدخال
  if (e.target.matches('input, textarea, select, [contenteditable]')) {
    return;
  }
  
  const isDevTools = 
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
    (e.ctrlKey && e.key === 'U');
  
  if (isDevTools) {
    e.preventDefault();
  }
});// ══════════════════════════════════════════════════════════════
//  SUPABASE CONFIG — ضع بياناتك هنا
// ══════════════════════════════════════════════════════════════

// ── SUPABASE CONFIG: ثابت في الكود ──
window.SUPABASE_URL=(()=>{try{const _v=localStorage.getItem('cc_sb_url');if(_v)return _v;}catch(_){}return atob('aHR0cHM6Ly9ramRob3RzcWdzbWlsemx2dm5weC5zdXBhYmFzZS5jbw==');})();
window.SUPABASE_KEY=(()=>{try{const _v=localStorage.getItem('cc_sb_key');if(_v)return _v;}catch(_){}return atob('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW10cVpHaHZkSE54WjNOdGFXeDZiSFoyYm5CNElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpRME5qa3dNekVzSW1WNGNDSTZNakE1TURBME5UQXpNWDAuQ3BIMEZoTFVVMzQzUDlRaDdSSkpaVlBOTTlwdjNxbldETzZ4Z0JTdG53Yw==');})();



let _sb = null;
let _sbLastUrl = '';
let _sbLastKey = '';
let _sbLastSid  = '';
function getSB(){
  const url = window.SUPABASE_URL || '';
  const key = window.SUPABASE_KEY || '';
  if(url === 'YOUR_SUPABASE_URL' || !url){
    console.warn('⚠️ لم يتم ضبط Supabase. التطبيق يعمل بوضع offline.');
    return null;
  }
  const sid = window._ccSid || '';
  // أعد إنشاء الـ client إذا تغيرت البيانات أو تغيّر الـ session ID
  if(!_sb || url !== _sbLastUrl || key !== _sbLastKey || sid !== (_sbLastSid||'')){
    _sb = supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ccsupabase-session', detectSessionInUrl: false },
      global: {
        headers: {
          // x-cc-sid يُرسَل مع كل طلب لتمكين RLS من التعرف على هوية المستخدم
          'x-cc-sid': sid
        }
      }
    });
    _sbLastUrl = url;
    _sbLastKey = key;
    _sbLastSid = sid;
  }
  return _sb;
}

// ── هل Supabase مُعدَّل؟ ──────────────────────────────────────
function isSupabaseReady(){
  return !!(window.SUPABASE_URL && window.SUPABASE_URL !== 'YOUR_SUPABASE_URL' && window.SUPABASE_KEY && window.SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY');
}

// ── مزامنة فورية (Realtime) ────────────────────────────────────
let _realtimeChannel = null;
function startRealtimeSync(){
  const sb = getSB(); if(!sb) return;
  if(_realtimeChannel) _realtimeChannel.unsubscribe();
  // cc_users/cc_history/cc_messages/cc_settings: Realtime مُعطَّل عنها في SQL لأسباب أمنية
  // تُحمَّل يدوياً عند الحاجة فقط — لا subscriptions هنا
  _realtimeChannel = sb.channel('cc_realtime')
    .on('postgres_changes', {event:'*', schema:'public', table:'cc_files'},   () => { if(appState.user && !_suppressFilesRealtime) sbLoadFiles(); })
    .on('postgres_changes', {event:'*', schema:'public', table:'cc_warows'}, () => { if(appState.user && typeof sbLoadWaRows==='function') sbLoadWaRows(); })
    .subscribe();
}

// ══════════════════════════════════════════════════════════════
//  SUPABASE DATA LAYER — بدلاً من localStorage
// ══════════════════════════════════════════════════════════════

// ── USERS ─────────────────────────────────────────────────────
async function sbLoadUsers(){
  const sb = getSB(); if(!sb) return;
  showTableSkeleton('usersTableWrap', 7, 3);
  try{
    // ⚠️ أمان: لا نجلب حقل pass للمتصفح — نجلبه فقط وقت تسجيل الدخول للمستخدم المحدد
    const {data,error} = await sb.from('cc_users')
      .select('id,role,username,name,org,nat_id,phone,email,status,permissions,last_login,created_at,custom_logo')
      .order('id');
    if(error) throw error;
    // تحويل تنسيق Supabase → تنسيق التطبيق
    registeredUsers = (data||[]).map(u=>{
      // احتفظ بالهاش المحفوظ مسبقاً في الذاكرة إن وُجد (لا تمسحه بـ [protected])
      const _existing = registeredUsers.find(r=>r.id===u.id);
      return {
        id:u.id, role:u.role, user:u.username,
        pass: (_existing && _existing.pass && _existing.pass !== '[protected]') ? _existing.pass : '[protected]',
        name:u.name, org:u.org||'', natId:u.nat_id||'',
        phone:u.phone||'', email:u.email||'', status:(u.role==='admin'||u.id===1)?'active':(u.status||'active'),
        permissions:u.permissions||{}, lastLogin:u.last_login, createdAt:u.created_at,
        customLogo:u.custom_logo||''
      };
    });
    USERS = registeredUsers.map(u=>({id:u.id,name:u.name,user:u.user,pass:'[protected]',role:u.role,
      avatar:u.role==='admin'?'👑':'👤',color:u.role==='admin'?'#dc2626':'#d97706'}));
    renderUsersTable();
    updateStats();
    // renderSbSwitchList تتحقق داخلياً من الدور — آمنة للاستدعاء دائماً
    renderSbSwitchList();
    // إذا كان المستخدم الحالي موظفاً، أعد تطبيق صلاحياته وأخفِ القائمة
    if(appState.user && appState.user.role==='subuser'){
      applyEmployeeNavPerms();
    }
  }catch(e){ console.error('sbLoadUsers:',e); }
}

async function sbSaveUser(u){
  const sb = getSB(); 
  if(!sb) { 
    saveUsersToLS(); 
    return; 
  }
  try{
    // لا تكتب [protected] فوق الهاش الحقيقي في Supabase
    if(!u.pass || u.pass === '[protected]'){
      console.warn('sbSaveUser: skipping pass update (protected)');
    }
    const baseRow = {
      role: u.role,
      username: u.user,
      ...(u.pass && u.pass !== '[protected]' ? {pass: u.pass} : {}),
      name: u.name,
      org: u.org || '',
      nat_id: u.natId || '',
      phone: u.phone || '',
      email: u.email || '',
      status: u.status || 'active',
      permissions: u.permissions || {},
      custom_logo: u.customLogo || ''
    };

    if (u.id && u.id > 0) {
      // مستخدم موجود: تعديل فقط بدون المساس بالـ id
      const { error } = await sb
        .from('cc_users')
        .update(baseRow)
        .eq('id', u.id);
      if (error) throw error;
    } else {
      // مستخدم جديد: نترك Supabase يولّد id تلقائياً
      const { data, error } = await sb
        .from('cc_users')
        .insert(baseRow)
        .select('id')
        .single();
      if (error) throw error;
      // تحديث الكائن في الواجهة بالـ id الجديد
      u.id = data.id;
    }
  }catch(e){
    console.error('sbSaveUser:', e);
    toast('⚠️ فشل حفظ المستخدم: ' + e.message, 'warn');
  }
}

async function sbDeleteUser(id){
  const sb = getSB(); if(!sb) return;
  try{
    const {error} = await sb.from('cc_users').delete().eq('id',id);
    if(error) throw error;
  }catch(e){ console.error('sbDeleteUser:',e); }
}

async function sbSaveAllUsers(){
  if(!isSupabaseReady()){ saveUsersToLS(); return; }
  for(const u of registeredUsers) await sbSaveUser(u);
}

// ── FILES ─────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
//  مساعد توحيد أسماء الأعمدة من Supabase (snake_case ↔ camelCase)
// ══════════════════════════════════════════════════════════════
function _col(f, name){
  // يدعم كلا الشكلين: id_col / idcol  |  name_col / namecol
  // extra_cols / extracols  |  uploaded_by / uploadedby  |  record_count / recordcount
  const map = {
    idCol:      f.id_col      !== undefined ? f.id_col      : f.idcol,
    nameCol:    f.name_col    !== undefined ? f.name_col    : f.namecol,
    extraCols:  f.extra_cols  || f.extracols  || [],
    uploadedBy: f.uploaded_by || f.uploadedby || '',
    uploadedAt: f.uploaded_at || f.uploadedat || '',
    recordCount:f.record_count!== undefined ? f.record_count : (f.recordcount || 0)
  };
  return map[name];
}

let _isFetchingFiles = false;
let _suppressFilesRealtime = false; // يمنع Realtime من إعادة تحميل الملفات أثناء الرفع
let _needsAnotherFetch = false;
async function sbLoadFiles(){
  const sb = getSB(); if(!sb) return;
  // حماية: لا تُحمّل الملفات إذا لم يكن هناك مستخدم مسجّل
  if(!appState.user){ console.warn('sbLoadFiles: no user logged in, skipping'); return; }
  if (_isFetchingFiles) { _needsAnotherFetch = true; return; }
  // 💀 Skeleton — فقط عند التحميل الأول
  if(!appState.files.length) showTableSkeleton('filesTableWrap', 5, 3);
  _isFetchingFiles = true;
  _needsAnotherFetch = false;
  // حفظ snapshot الملفات الحالية لمقارنة الأعداد (دون مسحها مبكراً)
  const _currentUserId = appState.user.id;
  const _prevFiles = appState.files.slice(); // نسخة من الملفات الحالية للمقارنة
  try{
    let filesQuery = sb.from('cc_files').select('*').order('id');
    if (appState.user && appState.user.role === 'subuser') {
      filesQuery = filesQuery.eq('uploadedby', appState.user.user);
    }
    const {data,error} = await filesQuery;
    if(error) throw error;

    // تحميل بيانات كل ملف بالتوازي (Parallel)
    const filePromises = (data||[]).map(async (f) => {
      // تطبيق الصلاحية
      if (appState.user && appState.user.role === 'subuser' && f.uploadedby !== appState.user.user) return null;

      // تحسين الأداء: إذا كان الملف محملاً بنفس الـ id والعدد، استخدم النسخة المحلية
      const targetCount = _col(f,'recordCount');
      const existingFile = _prevFiles.find(xf => xf.id === f.id);
      if (existingFile && (targetCount === undefined || targetCount === null || existingFile.data.length === targetCount)) {
         return { ...existingFile, uploadedBy: _col(f,'uploadedBy') };
      }

      let allRecs = [];
      let page = 0;
      while(true) {
        const {data:recs, error:rErr} = await sb.from('cc_records')
          .select('rowidx, rowdata')
          .eq('fileid', f.id)
          .order('rowidx')
          .range(page*1000, (page+1)*1000 - 1);
        if(rErr) throw rErr;
        if(!recs || !recs.length) break;
        allRecs = allRecs.concat(recs);
        if(recs.length < 1000) break;
        page++;
      }
      const rows = allRecs.map(r => r.rowdata);

      const idIndex = new Map();
      const nameIndex = new Map();
      rows.forEach((row,i)=>{
        const idC = _col(f,'idCol');
        const nameC = _col(f,'nameCol');
        const k = String(row[idC]||'').trim();
        if(k) idIndex.set(k,i);
        if(nameC>=0){
          const nk = typeof normalizeAr==='function'?normalizeAr(row[nameC]||''):String(row[nameC]||'').toLowerCase();
          if(nk){if(!nameIndex.has(nk))nameIndex.set(nk,[]);nameIndex.get(nk).push(i);}
        }
      });
      return {
        id:f.id, name:f.name, idCol: _col(f,'idCol'), nameCol: _col(f,'nameCol'),
        extraCols:_col(f,'extraCols'), headers:f.headers||[],
        prompt:f.prompt||'', uploadedBy:_col(f,'uploadedBy'), uploadedAt:_col(f,'uploadedAt'),
        data:rows, idIndex, nameIndex
      };
    });

    const resolvedFiles = await Promise.all(filePromises);
    const files = resolvedFiles.filter(f => f !== null);
    // تحقق: هل لا يزال نفس المستخدم مسجلاً؟ (يحمي من race condition)
    if(!appState.user || appState.user.id !== _currentUserId) return;

    // تحذير عن ملفات لم تكتمل مزامنتها (cc_records فارغ)
    const incomplete = files.filter(f => f.data.length === 0);
    if(incomplete.length > 0){
      incomplete.forEach(f => {
        console.warn(`sbLoadFiles: ملف "${f.name}" (id=${f.id}) لا يحتوي على سجلات في cc_records — ربما فشلت المزامنة بسبب RLS أو الاتصال.`);
      });
      // احتفظ فقط بالملفات التي تحتوي على بيانات، أو إذا كان record_count=0 أصلاً
    }

    appState.files = files;
    rebuildClientIndex();
    updateAll();
  }catch(e){ 
    console.error('sbLoadFiles:',e);
    updateAll();
  }
  finally { 
    _isFetchingFiles = false; 
    if(_needsAnotherFetch) { setTimeout(()=>sbLoadFiles(), 500); }
  }
}

async function sbSaveFileMeta(f){
  const sb = getSB(); if(!sb) return null;
  try{
    const row = {
      name:f.name, idcol:f.idCol, namecol:f.nameCol,
      extracols:f.extraCols, headers:f.headers,
      prompt:f.prompt||'', uploadedby:appState.user?.user || f.uploadedBy || '',
      uploadedat:new Date().toISOString(), recordcount:f.data.length
    };
    // إذا كان الـ id كبير جداً (Date.now) فهذا يعني أنه ملف جديد محلياً ولم يُرفع بعد
    if(f.id && f.id > 0 && f.id < 1000000000000){
      const {error} = await sb.from('cc_files').update(row).eq('id',f.id);
      if(error) throw error;
      return f.id;
    } else {
      const {data,error} = await sb.from('cc_files').insert(row).select('id').single();
      if(error) throw error;
      return data.id;
    }
  }catch(e){ console.error('sbSaveFileMeta:',e); toast('❌ فشل حفظ الملف: '+e.message,'err'); return null; }
}

async function sbSaveFileRecords(fileId, rows){
  const sb = getSB(); if(!sb) return;
  try{
    // حذف السجلات القديمة أولاً
    const {error: delErr} = await sb.from('cc_records').delete().eq('fileid', fileId);
    if(delErr){
      // إذا كان الخطأ بسبب RLS → أعطِ رسالة واضحة
      if(delErr.message && (delErr.message.includes('row-level') || delErr.code === '42501')){
        throw new Error('❌ خطأ في صلاحيات قاعدة البيانات (RLS). يرجى تشغيل ملف supabase_tables.sql المحدَّث في لوحة Supabase.');
      }
      throw delErr;
    }

    if(!rows.length) return;

    // إدراج السجلات على دُفعات متسلسلة بحجم 200 صف لكل دفعة
    const BATCH = 200;
    for(let i=0; i<rows.length; i+=BATCH){
      const batch = rows.slice(i,i+BATCH).map((row,j)=>({
        fileid:fileId, rowidx:i+j, rowdata:row
      }));
      const {error} = await sb.from('cc_records').insert(batch);
      if(error){
        if(error.message && (error.message.includes('row-level') || error.code === '42501')){
          throw new Error('❌ خطأ RLS: يرجى تشغيل ملف supabase_tables.sql المحدَّث لفتح الصلاحيات.');
        }
        throw error;
      }
    }
  }catch(e){ console.error('sbSaveFileRecords:',e); throw e; }
}

async function sbDeleteFile(fileId){
  const sb = getSB(); if(!sb) return;
  try{
    // السجلات تُحذف تلقائياً عبر CASCADE
    const {error} = await sb.from('cc_files').delete().eq('id',fileId);
    if(error) throw error;
  }catch(e){ console.error('sbDeleteFile:',e); }
}

// ── HISTORY ───────────────────────────────────────────────────
async function sbAddHistory(item){
  const sb = getSB(); if(!sb) { lsSave(LS.history,appState.history); return; }
  try{
    const {error} = await sb.from('cc_history').insert({
      queryid:String(item.id||''), filename:item.file,
      success:item.success, response:item.response,
      username:item.user, username2:item.userName||appState.user?.name||item.user,
      userrole:appState.user?.role||'',
      created_at: new Date().toISOString()
    });
    if(error) throw error;
  }catch(e){ console.error('sbAddHistory:',e); }
}

async function sbLoadHistory(){
  const sb = getSB(); if(!sb) return;
  try{
    const {data,error} = await sb.from('cc_history')
      .select('*').order('created_at',{ascending:false}).limit(1000);
    if(error) throw error;
    appState.history = (data||[]).map(h=>({
      id:h.queryid, file:h.filename, success:h.success,
      response:h.response, user:h.username, userName:h.username2||h.username,
      time: new Date(h.created_at).toLocaleString('ar-SA'),
      _ts: new Date(h.created_at).getTime(),
      _sbId: h.id
    }));
    renderHistory();
    updateStats();
    if(typeof updateEmpDashboard==='function') updateEmpDashboard();
  }catch(e){ console.error('sbLoadHistory:',e); }
}

async function sbDeleteHistoryItem(sbId){
  const sb = getSB(); if(!sb) return;
  try{
    const {error} = await sb.from('cc_history').delete().eq('id',sbId);
    if(error) throw error;
  }catch(e){ console.error('sbDeleteHistoryItem:',e); }
}

async function sbClearHistory(){
  const sb = getSB(); if(!sb) return;
  try{
    const {error} = await sb.from('cc_history').delete().neq('id',0);
    if(error) throw error;
  }catch(e){ console.error('sbClearHistory:',e); }
}

// ── AUDIT ─────────────────────────────────────────────────────
async function sbAddAudit(item){
  const sb = getSB(); if(!sb) return;
  try{
    await sb.from('cc_audit').insert({
      type:item.type, action:item.action, details:item.details,
      username:item.user, userrole:item.role,
      created_at: new Date().toISOString()
    });
  }catch(e){ console.error('sbAddAudit:',e); }
}

async function sbLoadAudit(){
  const sb = getSB(); if(!sb) return;
  try{
    const {data,error} = await sb.from('cc_audit')
      .select('*').order('created_at',{ascending:false}).limit(500);
    if(error) throw error;
    appState.audit = (data||[]).map(a=>({
      id:a.id, type:a.type, action:a.action, details:a.details||'',
      user:a.username, role:a.userrole,
      time: new Date(a.created_at).toLocaleString('ar-SA')
    }));
    renderAudit && renderAudit();
    sv('auditCount', appState.audit.length);
    // تحديث سجل نشاط الموظف إن كان في صفحته
    if(typeof renderMyAudit==='function' && document.getElementById('page-my-audit')?.classList.contains('active')){
      renderMyAudit();
    }
  }catch(e){ console.error('sbLoadAudit:',e); }
}

// ── MESSAGES ──────────────────────────────────────────────────
async function sbSendMessage(msg){
  const sb = getSB(); if(!sb) { _saveInbox(_getInbox().concat([msg])); return; }
  try{
    const {error} = await sb.from('cc_messages').insert({
      fromid:String(msg.fromId), fromname:msg.fromName, fromrole:msg.fromRole,
      toid:String(msg.toId), toname:msg.toName,
      subject:msg.subject, body:msg.body, isread:false,
      created_at: new Date().toISOString()
    });
    if(error) throw error;
  }catch(e){ console.error('sbSendMessage:',e); toast(friendlyError(e),'err'); }
}

async function sbLoadMessages(){
  const sb = getSB(); if(!sb) return;
  const me = appState.user; if(!me) return;
  try{
    const {data,error} = await sb.from('cc_messages')
      .select('*')
      .or(`toid.eq.${String(me.id)},fromid.eq.${String(me.id)}`)
      .order('created_at',{ascending:false});
    if(error) throw error;
    // تخزين مؤقت في الذاكرة
    window._sbMessages = (data||[]).map(m=>({
      id:m.id,
      fromId: isNaN(m.fromid) ? m.fromid : Number(m.fromid),
      fromName:m.fromname, fromRole:m.fromrole,
      toId: isNaN(m.toid) ? m.toid : Number(m.toid),
      toName:m.toname, subject:m.subject, body:m.body,
      read:m.isread, time: new Date(m.created_at).toLocaleString('ar-SA'), timeAgo: timeAgo(m.created_at),
      _sbId:m.id
    }));
    updateInboxBadge();
  }catch(e){ console.error('sbLoadMessages:',e); }
}

async function sbMarkRead(msgId){
  const sb = getSB(); if(!sb) return;
  try{
    await sb.from('cc_messages').update({isread:true}).eq('id',msgId);
  }catch(e){ console.error('sbMarkRead:',e); }
}

// ── SETTINGS ──────────────────────────────────────────────────
async function sbLoadSettings(){
  const sb = getSB(); if(!sb) return;
  try{
    // ✅ جلب المفاتيح المطلوبة فقط بدلاً من SELECT * لتجنب تسريب بيانات الموظفين الآخرين
    const owner = appState.user?.user || null;
    const keysNeeded = ['system', 'waconfig'];
    if(owner){
      keysNeeded.push('emp_waconfig_' + owner);
      keysNeeded.push('cc_templates_' + owner);
    }
    const {data,error} = await sb.from('cc_settings')
      .select('key,value')
      .in('key', keysNeeded);
    if(error) throw error;
    const sys = (data||[]).find(r=>r.key==='system');
    if(sys?.value){
      appState.settings = {...appState.settings, ...sys.value};
      applySidebarBrand && applySidebarBrand();
    }
    // إعدادات واتساب العامة
    const wa = (data||[]).find(r=>r.key==='waconfig');
    if(wa?.value){ window._waCfgFromSB = wa.value; lsSave(LS_WA_CFG, wa.value); }
    // إعدادات واتساب + قوالب المستخدم الحالي فقط
    if(owner){
      const empWa = (data||[]).find(r=>r.key==='emp_waconfig_'+owner);
      if(empWa?.value) lsSave(_empWaCfgKey(), empWa.value);
      const tplRow = (data||[]).find(r=>r.key==='cc_templates_'+owner);
      if(tplRow && Array.isArray(tplRow.value)){
        waTemplates = tplRow.value;
        appState.templates = waTemplates;
        lsSave(_tplKey(), waTemplates);
        if(typeof renderTemplates==='function') renderTemplates();
        if(typeof renderTplPanel==='function') renderTplPanel();
      }
    }
  }catch(e){ console.error('sbLoadSettings:',e); }
}

async function sbSaveSettings(key, value){
  const sb = getSB(); if(!sb) { lsSave(LS.settings, appState.settings); return; }
  try{
    const {error} = await sb.from('cc_settings')
      .upsert({key, value, updated_at:new Date().toISOString()}, {onConflict:'key'});
    if(error) throw error;
  }catch(e){ console.error('sbSaveSettings:',e); }
}

// ══════════════════════════════════════════════════════════════
//  INIT — تحميل البيانات عند فتح التطبيق
// ══════════════════════════════════════════════════════════════
async function sbInit(){
  if(!isSupabaseReady()){
    console.log('💡 Supabase غير مُعدَّل — وضع offline (localStorage)');
    return;
  }
  try{
    // تحميل المستخدمين والإعدادات فقط — الملفات تُحمَّل بعد تسجيل الدخول
    await Promise.all([
      sbLoadUsers(),
      sbLoadSettings()
    ]);
  }catch(e){
    console.error('sbInit error:',e);
  }
}

// تشغيل التهيئة بعد تحميل الصفحة
document.addEventListener('DOMContentLoaded', ()=>{ sbInit(); });


/* 
   MOBILE SIDEBAR
 */
function toggleMobSidebar(){
  const sb=document.querySelector('.sidebar'), ov=document.getElementById('mobOverlay');
  if(!sb||!ov) return;
  const open=sb.classList.toggle('mob-open');
  ov.classList.toggle('active',open);
}

/* 
   AUTO LOGOUT  variables only (init after appState)
 */
let _alTimer=null, _alWarn=null, _alCount=60;
const AL_IDLE = 30*60*1000;  // 30 دقيقة خمول قبل التحذير
const AL_WARN  = 60*1000;    // 60 ثانية تحذير قبل الخروج
function resetAutoLogout(){
  if(typeof appState==='undefined'||!appState) return;
  clearTimeout(_alTimer); clearTimeout(_alWarn);
  const bar=document.getElementById('autoLogoutBar');
  if(bar) bar.style.display='none';
  if(!appState.user) return;
  _alTimer = setTimeout(()=>{
    _alCount=60;
    const bar2=document.getElementById('autoLogoutBar');
    if(bar2) bar2.style.display='block';
    const cnt=document.getElementById('autoLogoutCount');
    if(cnt) cnt.textContent=_alCount;
    _alWarn = setInterval(()=>{
      _alCount--;
      if(cnt) cnt.textContent=_alCount;
      if(_alCount<=0){ clearInterval(_alWarn); _unregisterSession(); _directLogout('انتهت جلستك تلقائياً بسبب عدم النشاط'); }
    },1000);
  }, AL_IDLE - AL_WARN);
}

/* 
   REPORT FILTER
 */
let currentReportFilter='week';
function setReportFilter(period,btn){
  currentReportFilter=period;
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderReports();
}
function getFilteredHistory(){
  const h=appState.history;
  const from=document.getElementById('rfDateFrom')?.value;
  const to=document.getElementById('rfDateTo')?.value;
  return h.filter(x=>{
    if(currentReportFilter!=='all'||from||to){
      const m=x.time?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if(m){
        const d=new Date(+m[3],+m[2]-1,+m[1]);
        if(!isNaN(d)){
          const now=new Date(), diff=(now-d)/86400000;
          if(currentReportFilter==='week'  && diff>7)   return false;
          if(currentReportFilter==='month' && diff>30)  return false;
          if(currentReportFilter==='year'  && diff>365) return false;
          if(from && d<new Date(from)) return false;
          if(to   && d>new Date(to))   return false;
        }
      }
    }
    return true;
  });
}

/* 
   HISTORY DATE FILTER
 */
function clearHistFilter(){
  const f=document.getElementById('histDateFrom'), t=document.getElementById('histDateTo'), s=document.getElementById('histSearch');
  if(f) f.value=''; if(t) t.value=''; if(s) s.value='';
  renderHistory();
}

/* 
   CHART DOWNLOAD AS PNG
 */
function downloadChart(canvasId, label){
  const canvas=document.getElementById(canvasId);
  if(!canvas) return;
  const url=canvas.toDataURL('image/png');
  const a=document.createElement('a');
  a.href=url;
  a.download=`chart-${label}-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.png`;
  a.click();
}

/* 
   BACKUP & RESTORE
 */
function exportBackup(){
  const data={
    version:2,
    exportedAt:new Date().toISOString(),
    users: registeredUsers,
    settings: appState.settings,
    history: appState.history,
    audit: appState.audit,
    files: appState.files.map(f=>({name:f.name,idCol:f.idCol,nameCol:f.nameCol,extraCols:f.extraCols,headers:f.headers,prompt:f.prompt}))
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`CustomerCare-backup-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('✅ تم تصدير النسخة الاحتياطية','ok');
  addAudit('settings','تصدير نسخة احتياطية','');
}
function importBackup(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.version) throw new Error('ملف غير صالح');
      showConfirm('⚠️ ستُستبدل جميع البيانات الحالية بالنسخة الاحتياطية. هل تريد المتابعة؟',()=>{
      if(data.users)    { registeredUsers=data.users; saveUsersToLS(); }
      if(data.settings) { appState.settings=data.settings; lsSave(LS.settings,data.settings); }
      if(data.history)  { appState.history=data.history; lsSave(LS.history,data.history); }
      if(data.audit)    { appState.audit=data.audit; lsSave(LS.audit,data.audit); }
      USERS=registeredUsers.map(u=>({id:u.id,name:u.name,user:u.user,pass:u.pass,role:u.role,avatar:u.role==='admin'?'👑':'👤',color:u.role==='admin'?'#dc2626':'#d97706'}));
      updateStats(); applySidebarBrand();
      toast('✅ تم استعادة النسخة الاحتياطية بنجاح','ok');
      addAudit('settings','استعادة نسخة احتياطية','');
      });
    }catch(err){ toast('❌ فشل استيراد الملف: '+err.message,'err'); }
  };
  reader.readAsText(file);
  input.value='';
}

/* 
   CONFIRM MODAL  defined early so importBackup can call it
 */
function showConfirm(msg,onConfirm,icon){
  icon=icon||'⚠️';
  // If modal not yet in DOM, fallback to native confirm
  const modal=document.getElementById('confirmModal');
  if(!modal){ if(window.confirm(msg.replace(/<[^>]+>/g,''))) onConfirm(); return; }
  document.getElementById('confirmModalMsg').innerHTML=msg;
  document.getElementById('confirmModalIcon').textContent=icon;
  modal.classList.add('show');
  document.getElementById('confirmModalOk').onclick=function(){
    document.getElementById('confirmModal').classList.remove('show');
    onConfirm();
  };
}
function closeConfirmModal(){
  const m=document.getElementById('confirmModal');
  if(m) m.classList.remove('show');
}

/* 
   SORTABLE TABLES (history)
 */
let _histSort={col:null, dir:'asc'};

function sortHistory(col){
  if(_histSort.col===col) _histSort.dir=_histSort.dir==='asc'?'desc':'asc';
  else{ _histSort.col=col; _histSort.dir='asc'; }
  renderHistory();
}



/*  HELPERS  */
const $  = id => document.getElementById(id);
const sv = (id,v) => { const e=$(id); if(e) e.textContent=v; };
const closeModal = id => $(id) && $(id).classList.remove('show');
function toast(msg, type='info') {
  const el=document.createElement('div'); el.className=`toast ${type}`; el.innerHTML=msg;
  el.style.cursor='pointer'; el.title='انقر للإغلاق';
  el.addEventListener('click',()=>{el.style.opacity='0';setTimeout(()=>el.remove(),400);});
  $('toastWrap').appendChild(el);
  // مدة أطول للرسائل الطويلة أو رسائل الخطأ
  const duration = type==='err' ? 6000 : msg.length>60 ? 5000 : 3200;
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(20px)';el.style.transition='all .4s';},duration);
  setTimeout(()=>el.remove(),duration+500);
}
function togglePassVis(id, btn) { const inp=$(id); if(!inp) return; inp.type=inp.type==='password'?'text':'password'; if(btn) btn.textContent=inp.type==='password'?'👁':'🙈'; }
function autoFillPass(id) { const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'; let p=''; for(let i=0;i<10;i++) p+=c[Math.floor(Math.random()*c.length)]; const inp=$(id); inp.value=p; inp.type='text'; toast(`💡 كلمة المرور: ${p}`,'info'); }
function suggestPass() { const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'; let p=''; for(let i=0;i<10;i++) p+=c[Math.floor(Math.random()*c.length)]; $('newResetPass').value=p; $('confirmResetPass').value=p; $('newResetPass').type='text'; toast(`💡 ${p}`,'info'); }
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
/*           */
function normalizeAr(str){
  if(!str) return '';
  return String(str)
    .replace(/[ً-ٰٟ]/g,'')   // إزالة التشكيل
    .replace(/[أإآا]/g,'ا')                  // توحيد الألف
    .replace(/[ىي]/g,'ي')                   // توحيد الياء
    .replace(/[ةه]/g,'ه')                   // توحيد التاء المربوطة
    .replace(/\s+/g,' ').trim().toLowerCase();
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
// إخفاء جزء من البريد الإلكتروني لحماية الخصوصية (abc@domain.com → a**@domain.com)
function _maskEmail(email){
  if(!email) return '—';
  const parts = String(email).split('@');
  if(parts.length !== 2) return escHtml(email);
  const local = parts[0];
  const domain = parts[1];
  const masked = local.length <= 2
    ? local[0] + '*'.repeat(local.length - 1)
    : local[0] + '*'.repeat(Math.min(local.length - 2, 4)) + local[local.length - 1];
  return escHtml(masked + '@' + domain);
}
function isMobile(){ return window.innerWidth<=767; }
const lsSave=(k,v)=>{
  try{
    localStorage.setItem(k,JSON.stringify(v));
    // تحذير عند تجاوز 70% من سعة localStorage (~3.5MB)
    let total=0;
    for(let key in localStorage) if(localStorage.hasOwnProperty(key)) total+=localStorage[key].length*2;
    if(total > 3.5*1024*1024){
      const pct=Math.round(total/(5*1024*1024)*100);
      if(!window._lsWarnShown){
        window._lsWarnShown=true;
        setTimeout(()=>{
          toast(`⚠️ التخزين المحلي ممتلئ ${pct}% — يُنصح بتصدير نسخة احتياطية وحذف البيانات القديمة`,'warn');
          window._lsWarnShown=false;
        },500);
      }
    }
  }catch(e){
    toast('❌ فشل الحفظ: مساحة التخزين ممتلئة. يرجى تصدير نسخة احتياطية وحذف البيانات القديمة.','err');
  }
};
const lsLoad=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
/*  IndexedDB       */
const IDB = {
  db: null, NAME:'CustomerCareDB', VERSION:1, STORE:'files',
  open(){
    return new Promise((res,rej)=>{
      if(this.db){res(this.db);return;}
      const req=indexedDB.open(this.NAME,this.VERSION);
      req.onupgradeneeded=e=>{ e.target.result.createObjectStore(this.STORE,{keyPath:'id'}); };
      req.onsuccess=e=>{ this.db=e.target.result; res(this.db); };
      req.onerror=e=>rej(e.target.error);
    });
  },
  async save(files){
    const db=await this.open();
    const tx=db.transaction(this.STORE,'readwrite');
    const st=tx.objectStore(this.STORE);
    st.clear();
    files.forEach(f=>st.put(f));
    return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=e=>rej(e.target.error);});
  },
  async load(){
    try{
      const db=await this.open();
      const tx=db.transaction(this.STORE,'readonly');
      const st=tx.objectStore(this.STORE);
      return new Promise((res,rej)=>{
        const req=st.getAll();
        req.onsuccess=e=>res(e.target.result||[]);
        req.onerror=e=>rej(e.target.error);
      });
    }catch(e){return [];}
  },
  async clear(){
    const db=await this.open();
    const tx=db.transaction(this.STORE,'readwrite');
    tx.objectStore(this.STORE).clear();
  }
};

/*    IndexedDB — لا تُحمَّل الملفات إلا إذا كان المستخدم مسجّلاً */
IDB.load().then(files=>{
  if(files&&files.length){
    // إعادة بناء الفهارس بعد التحميل من IDB (Map لا تُحفظ في JSON)
    files.forEach(f=>{
      f.idIndex = new Map();
      f.data.forEach((row,i)=>{ const k=String(row[f.idCol]||'').trim(); if(k) f.idIndex.set(k,i); });
      f.nameIndex = new Map();
      if(f.nameCol>=0){
        f.data.forEach((row,i)=>{ const k=normalizeAr(row[f.nameCol]); if(k){if(!f.nameIndex.has(k))f.nameIndex.set(k,[]);f.nameIndex.get(k).push(i);} });
      }
    });
    // حماية: لا تُحمَّل الملفات إذا لم يكن هناك مستخدم مسجّل
    if(!appState.user) return;
    if(appState.user.role === 'subuser'){
      // subuser يرى ملفاته فقط — مقارنة بـ username (user.user) وليس الاسم
      appState.files = files.filter(f =>
        f.uploadedBy === appState.user.user || f.uploadedBy === appState.user.name
      );
    } else {
      appState.files = files;
    }
    updateAll();
    rebuildClientIndex();
  }
}).catch(()=>{});

/*  PASSWORD HASHING (SHA-256 + Salt via Web Crypto)  */
const CC_SALT = (()=>{
  const _a=atob('Q2Mkc'+'Gx0ITk=');
  const _b=atob('X3Y4X'+'zIwMjZf');
  const _c=atob('Q0NTI'+'VNlY3VyZQ==');
  const _d=atob('IXhLO'+'SRtUCM=');
  const _e=atob('djhAc'+'GVwcGVy');
  return [_a,_b,_c,_d,_e].join('::');
})();

/* 
     : SHA-256 + Salt 
         
     AES-GCM (    )
 */
function loadUsersFromStorage(arr){
  /*        SHA-256 hex  */
  return (arr||[]).map(u => {
    /*      aes: (  )   */
    if(u.pass && u.pass.startsWith('aes:')){
      const def = _DEFAULT_USERS.find(d => d.id === u.id);
      return {...u, pass: def ? def.pass : u.pass};
    }
    return u;
  });
}
async function hashPass(plain, userId=''){
  if(!plain) return Promise.resolve('');
  // إذا كانت مشفّرة بالفعل (64 حرف hex) أعدها كما هي
  if(/^[0-9a-f]{64}$/.test(plain)) return Promise.resolve(plain);
  const salted = plain + CC_SALT + String(userId);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function safeExportXLSX(fn, wb){ try{XLSX.writeFile(wb,fn);toast('✅ تم تصدير '+fn,'ok');}catch(e){const csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);safeExportText(fn.replace('.xlsx','.csv'),csv,'text/csv');} }
function safeExportText(fn,content,mime){ try{const a=document.createElement('a');a.href='data:'+mime+';charset=utf-8,'+encodeURIComponent(content);a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);toast('✅ '+fn,'ok');}catch(e){toast('⚠️ '+e.message,'warn');} }

/* 
   Customer Care System
   Version : 6.9
   Last Updated: 2026-03-01
   Sections: Storage | State | Theme | Audit | Charts |
             Login | Navigation | Files | Search | History |
             Users | Permissions | Reports | WA | Settings
 */

/*  STORAGE KEYS  */
const LS={files:'cc_files',history:'cc_history',settings:'cc_settings',users:'cc_users',rate:'cc_rate',waRows:'cc_warows',dark:'cc_dark',theme:'cc_theme',audit:'cc_audit',templates:'cc_templates'};
const SESSION_KEY = 'cc_session_token';

/* 
   SINGLE-SESSION LOCK v2     
   :
      subuser    localStorage:
       cc_emp_session_{userId}  = { sid, ts, ua }
     :    (   )
    BroadcastChannel    
    Heartbeat  8   ts
       sid   localStorage   
    :   (    )
 */
const LS_SESSIONS   = 'cc_active_sessions'; // legacy key (kept for admin kick)
const LS_EMP_PFX    = 'cc_emp_session_';    // cc_emp_session_{userId}
const SESSION_HEARTBEAT_INTERVAL = 8000;    // 8 ثوانٍ
const SESSION_EXPIRY = 1800000;            // 30 دقيقة بدون heartbeat = منتهية
let _sessionId      = null;
let _heartbeatTimer = null;
let _sessionChannel = null;


// ══════════════════════════════════════════════════════════════
// 🌐 مؤشر حالة الاتصال — Online / Offline
// ══════════════════════════════════════════════════════════════
function _initNetworkMonitor(){
  const bar = document.createElement('div');
  bar.id = 'networkBar';
  bar.style.cssText = `
    position:fixed; top:0; left:0; right:0; z-index:99999;
    padding:7px 18px; font-family:Cairo,sans-serif; font-size:12.5px;
    font-weight:700; text-align:center; direction:rtl;
    transform:translateY(-100%); transition:transform .35s cubic-bezier(.4,0,.2,1);
    display:flex; align-items:center; justify-content:center; gap:8px;
  `;
  document.body.appendChild(bar);

  function showBar(online){
    if(online){
      bar.style.background = 'linear-gradient(90deg,#059669,#10b981)';
      bar.style.color = '#fff';
      bar.innerHTML = '🟢 عاد الاتصال بالإنترنت';
      bar.style.transform = 'translateY(0)';
      setTimeout(()=>{ bar.style.transform = 'translateY(-100%)'; }, 3000);
    } else {
      bar.style.background = 'linear-gradient(90deg,#dc2626,#ef4444)';
      bar.style.color = '#fff';
      bar.innerHTML = '🔴 انقطع الاتصال — البيانات المحفوظة متاحة';
      bar.style.transform = 'translateY(0)';
    }
  }

  window.addEventListener('offline', ()=>showBar(false));
  window.addEventListener('online',  ()=>showBar(true));

  // إظهار فوري إذا كان غير متصل عند التحميل
  if(!navigator.onLine) showBar(false);
}

// ══════════════════════════════════════════════════════════════
// 💀 SKELETON SCREENS — أشكال تحميل متحركة
// ══════════════════════════════════════════════════════════════
function _skeletonRows(cols, rows=4){
  let h = '<div class="tbl-wrap"><table><tbody>';
  for(let r=0; r<rows; r++){
    h += '<tr>';
    for(let c=0; c<cols; c++){
      const w = c===0 ? '60%' : (c===cols-1 ? '80px' : '40%');
      h += `<td><div class="sk-line" style="width:${w};height:14px;border-radius:6px;background:linear-gradient(90deg,var(--b100) 25%,var(--b50) 50%,var(--b100) 75%);background-size:200% 100%;animation:sk-shimmer 1.4s infinite;"></div></td>`;
    }
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  return h;
}
function showTableSkeleton(wrapperId, cols, rows=4){
  const el = $(wrapperId); if(!el) return;
  el.innerHTML = _skeletonRows(cols, rows);
}

// أضف CSS للـ skeleton مرة واحدة
(function(){
  if(document.getElementById('sk-style')) return;
  const s = document.createElement('style');
  s.id = 'sk-style';
  s.textContent = `@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
  document.head.appendChild(s);
})();
function _initSessionChannel(){
  try{
    _sessionChannel = new BroadcastChannel('cc_session_bus');
    _sessionChannel.onmessage = (e)=>{
      if(!appState.user) return;
      const msg = e.data;
      // موظف: جلسة جديدة لنفس الحساب في تبويب آخر (نفس المتصفح)
      if(msg.type==='emp_login' && msg.userId===appState.user.id
         && appState.user.role==='subuser' && msg.sid!==_sessionId && !_adminUser){
        _handleForcedLogout('تم فتح حسابك في تبويب آخر. هذا التبويب سيُغلق.');
      }
      // إنهاء جلسة بواسطة المدير
      if(msg.type==='kicked' && msg.sid===_sessionId){
        _handleForcedLogout('تم إنهاء جلستك من قِبَل مدير النظام');
      }
      // تم تغيير كلمة المرور — أخرج الموظف فوراً
      if(msg.type==='password_changed' && msg.userId===appState.user.id && !_adminUser){
      if(msg.pv) try{localStorage.setItem('cc_pw_ver_'+appState.user.id, msg.pv);}catch(ex){}
        _handleForcedLogout('🔑 تم تغيير كلمة مرورك من قِبَل المدير. يرجى تسجيل الدخول بكلمة المرور الجديدة.');
      }
    };
  }catch(e){ _sessionChannel=null; }
}

function _getActiveSessions(){
  try{ return JSON.parse(localStorage.getItem(LS_SESSIONS)||'{}'); }
  catch(e){ return {}; }
}
function _setActiveSessions(s){
  try{ localStorage.setItem(LS_SESSIONS, JSON.stringify(s)); }catch(e){}
}

// ✅ قراءة الجلسات النشطة من Supabase (cross-device)
async function _getActiveSessionsFromSB(){
  const sb = typeof getSB==='function' ? getSB() : null;
  if(!sb) return {};
  try{
    const cutoff = Date.now() - SESSION_EXPIRY;
    const {data, error} = await sb.from('cc_sessions').select('*').gt('ts', cutoff);
    if(error) throw error;
    const result = {};
    (data||[]).forEach(row=>{
      // تحويل user_id و ts إلى أرقام لضمان التطابق مع registeredUsers
      result[row.sid] = {userId:Number(row.userid), ts:Number(row.ts), ua:row.ua, name:row.username, role:row.userrole};
    });
    return result;
  }catch(e){ console.warn('_getActiveSessionsFromSB:', e); return {}; }
}

// تنظيف الجلسات المنتهية من Supabase
async function _cleanExpiredSessions(){
  const sb = typeof getSB==='function' ? getSB() : null;
  if(!sb) return;
  try{
    const cutoff = Date.now() - SESSION_EXPIRY;
    await sb.from('cc_sessions').delete().lt('ts', cutoff);
  }catch(e){}
}

// كاش الجلسات لعرضها في جدول المستخدمين
let _cachedSessionCounts = {};
async function refreshSessionCounts(){
  _cachedSessionCounts = await _getActiveSessionsFromSB();
  if(typeof renderUsersTable === 'function') renderUsersTable();
}

/*       */
function _empKey(userId){ return LS_EMP_PFX + userId; }

async function _registerSession(userId){
  _sessionId = crypto.randomUUID ? crypto.randomUUID()
    : Date.now().toString(36)+Math.random().toString(36).slice(2);

  // ✅ تحديث window._ccSid فوراً حتى يُرسَل مع كل طلب Supabase تالٍ
  window._ccSid = _sessionId;

  const role = appState.user?.role;
  if(role === 'subuser' && !_adminUser){
    const rec = {sid:_sessionId, ts:Date.now(), ua:navigator.userAgent.slice(0,80)};
    try{ localStorage.setItem(_empKey(userId), JSON.stringify(rec)); }catch(e){}
    try{ if(_sessionChannel) _sessionChannel.postMessage({type:'emp_login', userId, sid:_sessionId}); }catch(e){}
  }

  // إذا كان المستخدم موظفاً، تُحتسب الجلسة النشطة تحت المدير (admin)
  let _sessionOwnerId = userId;
  let _sessionOwnerName = appState.user?.name || '';
  let _sessionOwnerRole = appState.user?.role || '';
  if(role === 'subuser' && !_adminUser){
    const adminUser = registeredUsers.find(u => u.role === 'admin');
    if(adminUser){
      _sessionOwnerId = adminUser.id;
      _sessionOwnerName = adminUser.name;
      _sessionOwnerRole = 'admin';
    }
  }

  // ✅ Supabase: اكتب الجلسة
  const sb = typeof getSB==='function' ? getSB() : null;
  if(sb){
    try{
      await sb.from('cc_sessions').upsert({
        sid: _sessionId,
        userid: _sessionOwnerId,
        username: _sessionOwnerName,
        userrole: _sessionOwnerRole,
        actual_username: appState.user?.user || _sessionOwnerName,
        ua: navigator.userAgent.slice(0,80),
        ts: Date.now()
      });
    }catch(e){ console.warn('_registerSession Supabase:', e); }
  }

  // legacy localStorage
  try{
    const sessions = _getActiveSessions();
    Object.keys(sessions).forEach(sid=>{
      if(sessions[sid].userId===_sessionOwnerId && (Date.now()-sessions[sid].ts)>SESSION_EXPIRY)
        delete sessions[sid];
    });
    sessions[_sessionId] = {userId:_sessionOwnerId, ts:Date.now(), ua:navigator.userAgent.slice(0,60)};
    _setActiveSessions(sessions);
  }catch(e){}

  clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(_sessionHeartbeat, SESSION_HEARTBEAT_INTERVAL);

  // تحديث عداد الجلسات النشطة في جدول المستخدمين
  if(typeof refreshSessionCounts === 'function') refreshSessionCounts();
}

async function _sessionHeartbeat(){
  if(!_sessionId || !appState.user) return;
  const role = appState.user.role;
  if(role === 'subuser' && !_adminUser){
    try{
      const _pv = localStorage.getItem('cc_pw_ver_' + appState.user.id);
      const _myPv = _sessionId.split('::pv::')[1] || '0';
      if(_pv && _pv !== _myPv){
        _handleForcedLogout('🔑 تم تغيير كلمة مرورك من قِبَل المدير. يرجى تسجيل الدخول بكلمة المرور الجديدة.');
        return;
      }
      const _stored = JSON.parse(localStorage.getItem(_empKey(appState.user.id))||'null');
      if(!_stored || _stored.sid !== _sessionId){
        _handleForcedLogout('تم تسجيل الدخول بحسابك من متصفح أو جهاز آخر.');
        return;
      }
      _stored.ts = Date.now();
      localStorage.setItem(_empKey(appState.user.id), JSON.stringify(_stored));
    }catch(e){}
  }

  // ✅ Supabase heartbeat
  const sb = typeof getSB==='function' ? getSB() : null;
  if(sb){
    try{ await sb.from('cc_sessions').update({ts: Date.now(), actual_username: appState.user?.user || ''}).eq('sid', _sessionId); }catch(e){}
  }

  // legacy localStorage heartbeat
  try{
    const sessions = _getActiveSessions();
    if(sessions[_sessionId]){ sessions[_sessionId].ts = Date.now(); _setActiveSessions(sessions); }
  }catch(e){}
}

async function _unregisterSession(){
  if(!_sessionId) return;
  clearInterval(_heartbeatTimer);
  if(appState.user?.role==='subuser'){
    try{
      const stored = JSON.parse(localStorage.getItem(_empKey(appState.user.id))||'null');
      if(stored && stored.sid===_sessionId)
        localStorage.removeItem(_empKey(appState.user.id));
    }catch(e){}
  }

  // ✅ Supabase: احذف الجلسة
  const sb = typeof getSB==='function' ? getSB() : null;
  if(sb){
    try{ await sb.from('cc_sessions').delete().eq('sid', _sessionId); }catch(e){}
  }

  // legacy localStorage
  try{
    const sessions = _getActiveSessions();
    delete sessions[_sessionId];
    _setActiveSessions(sessions);
  }catch(e){}
  _sessionId = null;
  window._ccSid = ''; // مسح الـ header حتى لا تُرسَل طلبات بجلسة منتهية
}

function _checkDuplicateSession(userId){
  try{
    const _pv = localStorage.getItem('cc_pw_ver_' + userId);
    const _stored = JSON.parse(localStorage.getItem(_empKey(userId))||'null');
    if(_stored && (Date.now() - (_stored.ts||0)) < SESSION_EXPIRY){
      // إذا كانت الجلسة المحفوظة تخص نسخة كلمة مرور قديمة → لا تعدّها جلسة نشطة
      const _storedPv = (_stored.sid||'').split('::pv::')[1] || '0';
      if(_pv && _storedPv !== _pv){ localStorage.removeItem(_empKey(userId)); return false; }
      return true; // جلسة نشطة فعلاً
    } else if(_stored){
      localStorage.removeItem(_empKey(userId));
    }
  }catch(e){}
  return false;
}

function _handleForcedLogout(reason){
  clearInterval(_heartbeatTimer);
  _sessionId = null;
  // أظهر modal منع الدخول بدلاً من toast بسيط
  _showBlockedModal(reason);
  setTimeout(()=>{
    appState.user=null; _adminUser=null;
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('cc_remember');
    stopAutoRefresh();
    const _fsh=$('appShell'), _fls=$('loginScreen');
    if(_fsh) _fsh.style.display='none';
    if(_fls) _fls.style.display='flex';
    if(typeof backToLanding==='function') backToLanding();
  }, 3500);
}

function _showBlockedModal(reason){
  // احذف أي نافذة سابقة
  const old=document.getElementById('_sessionBlockModal');
  if(old) old.remove();
  const div=document.createElement('div');
  div.id='_sessionBlockModal';
  div.style.cssText='position:fixed;inset:0;background:rgba(10,10,20,.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';
  div.innerHTML=`
    <div style="background:#fff;border-radius:20px;padding:36px 32px;max-width:420px;width:92%;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.4);animation:modalIn .3s ease;">
      <div style="font-size:52px;margin-bottom:16px;">🔒</div>
      <div style="font-size:18px;font-weight:800;color:#1e293b;margin-bottom:10px;">تنبيه أمني</div>
      <div style="font-size:14px;color:#475569;line-height:1.7;margin-bottom:20px;">${reason}</div>
      <div style="font-size:12px;color:#94a3b8;">سيتم إعادة توجيهك لصفحة الدخول...</div>
      <div style="margin-top:16px;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden;">
        <div style="height:100%;background:linear-gradient(90deg,#3b82f6,#1d4ed8);border-radius:2px;animation:_blkProgress 3.5s linear forwards;"></div>
      </div>
    </div>`;
  // أضف CSS للأنيميشن
  if(!document.getElementById('_blkStyle')){
    const s=document.createElement('style');
    s.id='_blkStyle';
    s.textContent='@keyframes _blkProgress{from{width:0}to{width:100%}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(div);
}

// استمع لتغييرات localStorage من متصفحات/نوافذ أخرى
window.addEventListener('storage', (e)=>{
  if(!appState.user || !_sessionId) return;

  // فحص تغيير كلمة المرور من جهاز/متصفح آخر
  if((e.key === 'cc_pass_changed_' + appState.user.id || e.key === 'cc_pw_ver_' + appState.user.id) && e.newValue && !_adminUser){
    try{ localStorage.removeItem('cc_pass_changed_'+appState.user.id); }catch(ex){}
    _handleForcedLogout('🔑 تم تغيير كلمة مرورك من قِبَل المدير. يرجى تسجيل الدخول بكلمة المرور الجديدة.');
    return;
  }

  // أثناء التنكر — تجاهل تغييرات جلسة الموظف
  if(appState.user.role!=='subuser' || _adminUser) return;
  if(e.key === _empKey(appState.user.id)){
    try{
      const stored = JSON.parse(e.newValue||'null');
      // إذا تغيّر الـ sid معناه جلسة جديدة فُتحت في متصفح/نافذة أخرى
      if(!stored || stored.sid !== _sessionId){
        _handleForcedLogout('تم تسجيل الدخول بحسابك من متصفح أو نافذة أخرى.');
      }
    }catch(ex){}
  }
});

function requireAuth(action=''){
  if(!appState.user||!sessionStorage.getItem(SESSION_KEY)){
    toast('⛔ انتهت جلستك. سجّل الدخول من جديد','err');
    doLogout(); return false;
  }
  return true;
}
/*  SESSION GUARD         */
/*  SESSION GUARD: token is only set by doLogin / rememberMeCheck  */

/*  STATE  */
const appState = {
  user:null,
  files:lsLoad(LS.files,[]),
  history:lsLoad(LS.history,[]),
  settings:lsLoad(LS.settings,{apiKey:'',template:'أنت مساعد ذكي متخصص. بناءً على بيانات الشخص التالية، قدّم ردًا مخصصًا ومفيدًا باللغة العربية.',orgName:'',orgLogo:''}),
  audit:lsLoad(LS.audit,[]),
  templates:lsLoad(LS.templates,[])
};
const _pg={history:1,files:1,audit:1,myAudit:1,search:1,PAGE_SIZE:15};
/*        */
const _savedSearch={query:'',nameQ:'',phoneQ:'',fileIdx:'',hasResult:false};
let _adminUser=null, _pendingDeleteId=null, currentUserFilter='all', pendingFiles=[], pendingFileIdx=0, userIdCounter=3;

/*  DEFAULT USERS:    SHA-256 + SALT  */
const _DEFAULT_USERS = [
  {id:1,role:'admin',  user:'admin',pass:(()=>{return ['69d8d140','d68ae69c','3892bc1d','dac3babb','61608af7','16648c83','0f4f7183','c8e9878a'].join('');})(),
   name:'Admin',  org:'الشركة الرئيسية',natId:'1000000001',phone:'0500000001',
   email:'abm9966@gmail.com',status:'active',createdAt:'الحساب الرئيسي',lastLogin:'الآن'},
  {id:2,role:'subuser',user:'user', pass:(()=>{return ['a475dc79','16dbe2b2','86ad72ec','14f8d187','29c4c8b2','6a62c76b','d394cdb1','660c2133'].join('');})(),
   name:'User1',  org:'شركة النور',natId:'1000000002',phone:'0500000002',
   email:'user1@cc.com',status:'active',createdAt:new Date().toLocaleDateString('ar-SA'),lastLogin:'أمس'}
];
let registeredUsers = _DEFAULT_USERS;
// USERS محذوفة — استخدم registeredUsers مباشرةً
// getter للتوافق مع أي كود قديم يستخدم USERS
Object.defineProperty(window, "USERS", {
  get(){ return registeredUsers; },
  set(v){ /*   registeredUsers    */ }
});
/*    sync  SHA-256  */
function _initUsers(){
  const stored = lsLoad(LS.users, null);
  if(stored){
    const loaded = loadUsersFromStorage(stored);
    // ── تحقق من تطابق hash الأدمن الافتراضي مع النسخة المحفوظة ──
    // إذا تغيّر الهاش (ترقية النظام) → استخدم الهاش الجديد لحساب admin فقط
    const storedAdmin = loaded.find(u => u.id === 1);
    const defaultAdmin = _DEFAULT_USERS.find(u => u.id === 1);
    if(storedAdmin && defaultAdmin && storedAdmin.pass !== defaultAdmin.pass){
      // كلمة مرور الأدمن تغيّرت في التحديث → استخدم الهاش الجديد
      // لكن فقط إذا كانت كلمة المرور المحفوظة هي إحدى كلمات المرور القديمة المعروفة
      const KNOWN_OLD_HASHES = [
        (()=>{return ['64152d8b','2401d748','ffca5cdc','0637c11d','a674a362','87006e50','9411250b','fcc8ed5a'].join('');})() // hash قديم
      ];
      if(KNOWN_OLD_HASHES.includes(storedAdmin.pass)){
        storedAdmin.pass = defaultAdmin.pass; // تحديث إلى الهاش الجديد
        lsSave(LS.users, loaded);             // حفظ التحديث
      }
    }
    registeredUsers = loaded;
  } else {
    registeredUsers = _DEFAULT_USERS.map(u=>({...u}));
  }
  USERS = registeredUsers.map(u=>({id:u.id,name:u.name,user:u.user,pass:u.pass,role:u.role,avatar:u.role==='admin'?'👑':'👤',color:u.role==='admin'?'#dc2626':'#d97706'}));
}
// حفظ المستخدمين — localStorage فقط
function saveUsersToLS(){
  lsSave(LS.users, registeredUsers);
}

/*  THEME  */
const THEMES=['','green','purple','red','teal'];
let _currentTheme=lsLoad(LS.theme,'');
function setTheme(t){
  THEMES.forEach(x=>document.body.classList.remove('theme-'+x));
  if(t) document.body.classList.add('theme-'+t);
  _currentTheme=t; lsSave(LS.theme,t);
  document.querySelectorAll('.theme-dot').forEach(d=>d.classList.remove('active'));
  const key=t||'blue'; const dot=$('td-'+key); if(dot) dot.classList.add('active');
}
(function(){ const t=lsLoad(LS.theme,''); if(t){document.body.classList.add('theme-'+t);const dot=$('td-'+(t||'blue'));if(dot)dot.classList.add('active');} })();

/* DARK MODE */
(function(){ if(lsLoad(LS.dark,false)){document.body.classList.add('dark');const b=$('darkToggleBtn');if(b)b.textContent='☀️';} })();
function toggleDark(){const dark=document.body.classList.toggle('dark');lsSave(LS.dark,dark);const b=$('darkToggleBtn');if(b)b.textContent=dark?'☀️':'🌙';}

/*  AUDIT LOG  */
const AUDIT_TYPES={login:{icon:'🔑',color:'rgba(16,185,129,.12)',textColor:'#059669',cls:'ab-login'},logout:{icon:'🚪',color:'rgba(100,116,139,.1)',textColor:'#475569',cls:'ab-logout'},upload:{icon:'📤',color:'rgba(59,130,246,.1)',textColor:'#2563eb',cls:'ab-upload'},delete:{icon:'🗑',color:'rgba(239,68,68,.1)',textColor:'#dc2626',cls:'ab-delete'},search:{icon:'🔍',color:'rgba(245,158,11,.1)',textColor:'#d97706',cls:'ab-search'},export:{icon:'📥',color:'rgba(124,58,237,.1)',textColor:'#7c3aed',cls:'ab-export'},user:{icon:'👤',color:'rgba(16,185,129,.1)',textColor:'#059669',cls:'ab-user'},pass:{icon:'🔒',color:'rgba(239,68,68,.1)',textColor:'#dc2626',cls:'ab-pass'},warn:{icon:'⚠️',color:'rgba(239,68,68,.2)',textColor:'#dc2626',cls:'ab-warn'},security:{icon:'🚨',color:'rgba(239,68,68,.18)',textColor:'#dc2626',cls:'ab-security'}};
function addAudit(type, action, details=''){
  const item={
    id:Date.now(), type, action, details,
    user:appState.user?.name??'—',
    role:appState.user?.role??'—',
    time:new Date().toLocaleString('ar-SA'),
    ip:'127.0.0.1'
  };
  appState.audit.unshift(item);
  if(appState.audit.length>500) appState.audit.pop();
  lsSave(LS.audit, appState.audit);
  sv('auditCount', appState.audit.length);
  if(isSupabaseReady && isSupabaseReady()) sbAddAudit(item);
}
function renderAudit(){
  const filter=$('auditFilter')?.value||'all';
  const list=filter==='all'?appState.audit:appState.audit.filter(a=>a.type===filter);
  const wrap=$('auditWrap'); if(!wrap) return;
  if(!list.length){wrap.innerHTML='<div class="u-empty-state">🛡️ لا توجد أحداث</div>';renderPagination('auditPagination',0,1,()=>{});return;}
  const total=list.length, ps=_pg.PAGE_SIZE;
  if(_pg.audit>Math.ceil(total/ps)) _pg.audit=Math.ceil(total/ps)||1;
  const slice=list.slice((_pg.audit-1)*ps, _pg.audit*ps);
  wrap.innerHTML=slice.map(a=>{
    const t=AUDIT_TYPES[a.type]||AUDIT_TYPES.login;
    const isSecRow = a.type==='security';
    return`<div class="audit-item${isSecRow?' audit-security-row':''}"><div class="audit-icon" style="background:${t.color};color:${t.textColor};">${t.icon}</div><div class="audit-info"><div class="audit-action">${escHtml(a.action)}</div><div class="audit-meta">${escHtml(a.details)} — <strong>${escHtml(a.user)}</strong> (${escHtml(String(a.role??''))}) — ${escHtml(String(a.time??''))}</div></div><span class="audit-badge ${t.cls}">${escHtml(String(a.type??''))}</span></div>`;
  }).join('');
  renderPagination('auditPagination', total, _pg.audit, p=>{_pg.audit=p;renderAudit();});
}

// ── سجل تدقيق الموظف: يعرض أحداثه الخاصة فقط ──
function renderMyAudit(){
  const wrap=$('myAuditWrap'); if(!wrap) return;
  const currentUser = appState.user?.name || appState.user?.user || '';
  const filter=$('myAuditFilter')?.value||'all';
  let list = appState.audit.filter(a => {
    if(a.user !== currentUser) return false;
    if(filter!=='all' && a.type!==filter) return false;
    return true;
  });
  if(!list.length){
    wrap.innerHTML='<div class="u-empty-state">🛡️ لا توجد أحداث لحسابك</div>';
    if(typeof renderPagination==='function') renderPagination('myAuditPagination',0,1,()=>{});
    return;
  }
  const total=list.length, ps=_pg.PAGE_SIZE;
  if(!_pg.myAudit) _pg.myAudit=1;
  if(_pg.myAudit>Math.ceil(total/ps)) _pg.myAudit=Math.ceil(total/ps)||1;
  const slice=list.slice((_pg.myAudit-1)*ps, _pg.myAudit*ps);
  wrap.innerHTML=slice.map(a=>{
    const t=AUDIT_TYPES[a.type]||AUDIT_TYPES.login;
    return`<div class="audit-item"><div class="audit-icon" style="background:${t.color};color:${t.textColor};">${t.icon}</div><div class="audit-info"><div class="audit-action">${escHtml(a.action)}</div><div class="audit-meta">${escHtml(a.details||'')} — ${escHtml(String(a.time??''))}</div></div><span class="audit-badge ${t.cls}">${escHtml(String(a.type??''))}</span></div>`;
  }).join('');
  renderPagination('myAuditPagination', total, _pg.myAudit, p=>{_pg.myAudit=p;renderMyAudit();});
}

function clearAudit(){
  const n=appState.audit.length;
  if(!n){toast('⚠️ سجل التدقيق فارغ','warn');return;}
  showConfirm(`⚠️ سيتم حذف <b>${n}</b> حدث من سجل التدقيق نهائياً؟`,()=>{
  appState.audit=[];lsSave(LS.audit,[]);sv('auditCount','0');renderAudit();
  toast(`🗑 تم حذف ${n} حدث من سجل التدقيق`,'warn');
  });
}
function exportAudit(){
  const rows=[['النوع','الإجراء','التفاصيل','المستخدم','الدور','الوقت']];
  appState.audit.forEach(a=>rows.push([a.type,a.action,a.details,a.user,a.role,a.time]));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'سجل التدقيق');
  safeExportXLSX('audit_log.xlsx',wb);
}

/*  CHARTS  */
let _charts={};
function destroyChart(id){ if(_charts[id]){try{_charts[id].destroy();}catch(e){} delete _charts[id];} }
/*  helpers  Chart      */
function updateOrCreateChart(id, ctx, config){
  if(!ctx) return;
  if(_charts[id]){
    _charts[id].data.labels = config.data.labels;
    _charts[id].data.datasets[0].data = config.data.datasets[0].data;
    _charts[id].update('none'); // بدون animation عند التحديث
  } else {
    _charts[id] = new Chart(ctx, config);
  }
}
function renderReports(){
  const h=(typeof getFilteredHistory==='function'?getFilteredHistory():appState.history), files=appState.files;
  /* Chart 1 - Success/Fail Doughnut */
  const sfCtx=$('chartSuccessFail');
  if(sfCtx){ const succ=h.filter(x=>x.success).length, fail=h.length-succ;
    updateOrCreateChart('sf',sfCtx,{type:'doughnut',data:{labels:['ناجحة','فاشلة'],datasets:[{data:[succ,fail],backgroundColor:['#10b981','#ef4444'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{family:'Cairo'},color:'#64748b'}}}}}); }
  /* Chart 2 - By User Bar */
  const buCtx=$('chartByUser');
  if(buCtx){ const users=[...new Set(h.map(x=>x.user))]; const counts=users.map(u=>h.filter(x=>x.user===u).length);
    updateOrCreateChart('bu',buCtx,{type:'bar',data:{labels:users,datasets:[{label:'الاستعلامات',data:counts,backgroundColor:'rgba(59,130,246,.7)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{family:'Cairo'},color:'#64748b'}},y:{ticks:{font:{family:'Cairo'},color:'#64748b'},beginAtZero:true}}}}); }
  /* Chart 3 - Daily last 7 */
  const dlCtx=$('chartDaily');
  if(dlCtx){
    const days=[]; const today=new Date();
    for(let i=6;i>=0;i--){const d=new Date(today); d.setDate(d.getDate()-i); days.push(d.toLocaleDateString('ar-SA'));}
    const counts=days.map(d=>h.filter(x=>x.time&&x.time.startsWith(d.split('/').reverse().join('/'))||x.time?.includes(d)).length);
    updateOrCreateChart('dl',dlCtx,{type:'line',data:{labels:days,datasets:[{label:'الاستعلامات',data:counts,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.1)',tension:.4,fill:true,pointBackgroundColor:'#3b82f6'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{family:'Cairo',size:10},color:'#64748b'}},y:{ticks:{font:{family:'Cairo'},color:'#64748b'},beginAtZero:true}}}}); }
  /* Chart 4 - Files bar */
  const fiCtx=$('chartFiles');
  if(fiCtx&&files.length){ const labels=files.map(f=>f.name.length>20?f.name.substring(0,20)+'…':f.name); const counts=files.map(f=>f.data.length);
    updateOrCreateChart('fi',fiCtx,{type:'bar',data:{labels,datasets:[{label:'السجلات',data:counts,backgroundColor:'rgba(124,58,237,.7)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{family:'Cairo',size:10},color:'#64748b'}},y:{ticks:{font:{family:'Cairo'},color:'#64748b'},beginAtZero:true}}}}); }
  else if(fiCtx&&_charts['fi']){_charts['fi'].data.labels=[];_charts['fi'].data.datasets[0].data=[];_charts['fi'].update('none');}
}

/*  LOGIN  */
/* ═══ TWO-CARD PORTAL FUNCTIONS ═══ */
function switchPortalTab(tab){
  // Both cards are always visible — just focus the right field
  if(tab==='client'){
    if(isSupabaseReady && isSupabaseReady()) sbLoadFilesPublic();
    setTimeout(()=>{ const el=$('clientIdInput'); if(el) el.focus(); },150);
  } else {
    setTimeout(()=>{ const el=$('loginUser'); if(el) el.focus(); },100);
  }
}
function previewLoginRole(username){
  const users=lsLoad(LS.users,null);
  const badge=$('loginRoleBadge');
  if(!badge) return;
  if(!username||!users){badge.style.display='none';return;}
  const found=(users||[]).find(u=>(u.username||'').toLowerCase()===username.toLowerCase().trim());
  if(!found||!found.active){badge.style.display='none';return;}
  const isAdmin=found.role==='admin';
  badge.style.display='flex';
  const ic=$('loginRoleIcon'),ti=$('loginRoleTitle'),su=$('loginRoleSub'),pi=$('loginRolePill');
  if(ic) ic.textContent=isAdmin?'👑':'👤';
  if(ti) ti.textContent=isAdmin?'مدير النظام':'موظف';
  if(su) su.textContent=found.name||'';
  if(pi){pi.textContent=isAdmin?'كامل الصلاحيات':'صلاحيات محدودة';pi.style.background=isAdmin?'var(--b100)':'#dcfce7';pi.style.color=isAdmin?'var(--b700)':'#15803d';}
}
/* kept for backward-compatibility with any internal calls */
function openPortal(type){
  if(type==='client') switchPortalTab('client');
  else switchPortalTab('login');
}
function backToLanding(){ switchPortalTab('login'); }
// ── مسار Supabase: يجلب pass للمستخدم المحدد فقط عند تسجيل الدخول ──
async function _doLoginWithSB(sb, user, pass){
  try{
    const {data, error} = await sb
      .from('cc_users')
      .select('id,role,username,pass,name,org,nat_id,phone,email,status,permissions,last_login,created_at,custom_logo')
      .eq('username', user)
      .maybeSingle();

    if(error || !data){
      toast('❌ اسم المستخدم أو كلمة المرور غير صحيحة.', 'err');
      return;
    }

    const _originalPassInDB = data.pass; // احفظ الهاش الأصلي من DB قبل أي تعديل

    const tmpUser = {
      id:data.id, role:data.role, user:data.username, pass:data.pass,
      name:data.name, org:data.org||'', natId:data.nat_id||'',
      phone:data.phone||'', email:data.email||'', status:(data.role==='admin'||data.id===1)?'active':(data.status||'active'),
      permissions:data.permissions||{}, lastLogin:data.last_login,
      createdAt:data.created_at, customLogo:data.custom_logo||''
    };
    const _idx = registeredUsers.findIndex(u=>u.id===data.id);
    if(_idx>=0) registeredUsers[_idx] = tmpUser;
    else registeredUsers.push(tmpUser);

    // احسب الهاش بكل الـ salt المحتملة وتوقف عند أول تطابق
    let hashed = await hashPass(pass, data.id);
    if(hashed !== _originalPassInDB) hashed = await hashPass(pass, 1);
    if(hashed !== _originalPassInDB) hashed = await hashPass(pass, '');
    if(hashed !== _originalPassInDB) hashed = await hashPass(pass, data.username || user);

    if(hashed !== _originalPassInDB){
      try{
        const _glKey='cc_gl_attempts_'+user;
        const _gl=lsLoad(_glKey,{count:0,until:0});
        _gl.count=(_gl.count||0)+1;
        if(_gl.count>=5){_gl.until=Date.now()+5*60*1000;_gl.count=0;}
        lsSave(_glKey,_gl);
      }catch(e){}
      if(typeof recordEmpFailedAttempt==='function') recordEmpFailedAttempt(data.id, data.name);
      toast('❌ بيانات الدخول غير صحيحة.', 'err');
      return;
    }

    // لا نُعيد كتابة الهاش من _DEFAULT_USERS فوق كلمة المرور المُغيَّرة في Supabase
    // الهاش الصحيح هو ما جلبناه من Supabase (_originalPassInDB) وتطابق مع ما أدخله المستخدم
    // تأكد أن الأدمن دائماً active في Supabase
    if(data.role==='admin' || data.id===1){
      tmpUser.status = 'active';
      if(data.status !== 'active'){
        try{ await sb.from('cc_users').update({status:'active'}).eq('id',data.id); }catch(_e){}
      }
    }
    _doLoginOffline(user, pass, true, tmpUser);
    // لا نمسح الهاش من الذاكرة — يُحتاج إليه عند الدخول التالي عبر المسار المحلي

  }catch(err){
    console.error('_doLoginWithSB error:', err);
    toast('❌ خطأ في الاتصال بـ Supabase. تحقق من الاتصال وأعد المحاولة.', 'err');
  }
}

function _doLoginOffline(user, pass, preVerified=false, sbUserData=null){

  // حماية brute-force عامة
  const _glKey='cc_gl_attempts_'+user;
  try{
    const _gl=lsLoad(_glKey,{count:0,until:0});
    if(_gl.until>Date.now()){
      toast(`🔒 كثرة المحاولات الفاشلة. انتظر ${Math.ceil((_gl.until-Date.now())/1000)} ثانية`,'err');
      return;
    }
  }catch(e){}

  const candidate=registeredUsers.find(u=>u.user===user);

  // فحص الحالة — مع مراعاة password version (تغيير كلمة المرور يرفع القيود)
  if(candidate){
    // الأدمن (role=admin أو id=1) لا يخضع لفحص الحالة — لا يُوقف أبداً
    if(candidate.role === 'admin' || candidate.id === 1) candidate.status = 'active';
    const _hasPwChange = !!localStorage.getItem('cc_pw_ver_'+candidate.id);
    if(candidate.status==='inactive' && !_hasPwChange){
      toast('⛔ هذا الحساب موقوف. تواصل مع مدير النظام','err');return;
    }
    if(candidate.status==='inactive' && _hasPwChange){
      candidate.status='active';
      try{ setEmpAttempts(candidate.id,{count:0,suspended:false}); saveUsersToLS(); }catch(ex){}
    }
    const _att=getEmpAttempts(candidate.id);
    if(_att.suspended && !_hasPwChange){
      toast('🔒 هذا الحساب مُعلَّق بسبب كثرة المحاولات الفاشلة. تواصل مع مدير النظام','err');return;
    }
    if(_att.suspended && _hasPwChange){
      try{ setEmpAttempts(candidate.id,{count:0,suspended:false}); localStorage.removeItem('cc_empAttempts_'+candidate.id); }catch(ex){}
    }
  }

  // إذا تحقّقنا من كلمة المرور مسبقاً عبر Supabase، نتخطى hashPass ونبحث مباشرة
  const _verifyAndContinue = async (found) => {
    if(!found){
      try{
        const _gl=lsLoad(_glKey,{count:0,until:0});
        _gl.count=(_gl.count||0)+1;
        if(_gl.count>=5){_gl.until=Date.now()+5*60*1000;_gl.count=0;}
        lsSave(_glKey,_gl);
      }catch(e){}
      if(candidate) recordEmpFailedAttempt(candidate.id, candidate.name);
      else{
        const ts0=new Date().toLocaleString('ar-SA');
        addAudit('security','⚠️ محاولة دخول بمستخدم مجهول: '+user,'النظام | '+ts0);
        sendBreachAlertEmail(user,1,ts0);
        toast('❌ بيانات الدخول غير صحيحة','err');
      }
      return;
    }

    const reg=registeredUsers.find(u=>u.id===found.id);
    // الأدمن لا يُوقف أبداً
    if(reg && (reg.role==='admin' || reg.id===1)) reg.status='active';
    const _hasPwChange2 = !!localStorage.getItem('cc_pw_ver_'+found.id);
    if(reg&&reg.status==='inactive'){
      if(_hasPwChange2){ reg.status='active'; try{setEmpAttempts(found.id,{count:0,suspended:false});saveUsersToLS();}catch(ex){} }
      else { toast('⛔ هذا الحساب موقوف. تواصل مع مدير النظام','err');return; }
    }

    // ── فحص جلسة مكررة للموظف ──
    if(found.role==='subuser' && _checkDuplicateSession(found.id)){
      const _secAudit={id:Date.now(),type:'security',
        action:`🚨 محاولة تسجيل دخول مزدوج: ${found.name}`,
        details:`المستخدم (@${found.user}) يحاول الدخول بينما توجد جلسة نشطة على جهاز أو متصفح آخر`,
        user:found.name,role:'موظف',time:new Date().toLocaleString('ar-SA'),ip:'127.0.0.1'};
      appState.audit.unshift(_secAudit);
      if(appState.audit.length>500) appState.audit.pop();
      lsSave(LS.audit,appState.audit);
      sv('auditCount',appState.audit.length);
      _showBlockedModal('هذا الحساب مفتوح بالفعل على متصفح أو جهاز آخر.\nلا يُسمح بتسجيل دخول متعدد للموظفين.\nتواصل مع مدير النظام إذا كنت تواجه مشكلة.');
      return;
    }

    // ── تسجيل دخول ناجح ──
    // احذف pw_ver — الجلسة الجديدة تحمل الـ version الحالية
    try{ localStorage.removeItem('cc_pw_ver_'+found.id); }catch(e){}
    try{ localStorage.removeItem('cc_session_blocked_'+found.id); }catch(e){}
    try{ localStorage.removeItem('cc_pass_changed_'+found.id); }catch(e){}
    if(found.id) setEmpAttempts(found.id,{count:0,suspended:false});
    try{ localStorage.removeItem(_glKey); }catch(e){}

    appState.user=found;
    // الـ sessionId يحمل password version للتحقق في الـ heartbeat
    const _pv = localStorage.getItem('cc_pw_ver_'+found.id) || Date.now().toString();
    const _sesToken=((typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36))+'::pv::'+_pv+':'+found.id;
    sessionStorage.setItem(SESSION_KEY,_sesToken);

    try{
      const _remChecked=document.getElementById('rememberMe')?.checked;
      const _exp=Date.now()+(_remChecked?7*24*60*60*1000:24*60*60*1000);
      localStorage.setItem('cc_remember',JSON.stringify({userId:found.id,exp:_exp,token:_sesToken,remember:!!_remChecked}));
    }catch(e){}

    if(reg){
      reg.lastLogin=new Date().toLocaleString('ar-SA');
      // تحديث lastLogin فقط في Supabase — لا نُرسل UPDATE كامل لجميع المستخدمين عند كل login
      try{
        const _sbL = typeof getSB==='function' ? getSB() : null;
        if(_sbL && typeof isSupabaseReady==='function' && isSupabaseReady()){
          _sbL.from('cc_users').update({last_login: reg.lastLogin}).eq('id', reg.id).then(()=>{});
        }
      }catch(_le){}
      // حفظ localStorage فقط (بدون استدعاء sbSaveAllUsers)
      try{ lsSave(LS.users, registeredUsers); }catch(_le){}
    }
    _initSessionChannel();
    await _registerSession(found.id); // ✅ await: يضمن كتابة cc_sessions قبل sbLoadAudit/sbLoadHistory
    _cleanExpiredSessions(); // حذف الجلسات المنتهية من Supabase
    if(found.role==='subuser'){
      try{
        const _r=JSON.parse(localStorage.getItem('cc_remember')||'{}');
        _r.empSid=_sessionId;
        localStorage.setItem('cc_remember',JSON.stringify(_r));
      }catch(e){}
    }
    addAudit('login',`تسجيل دخول ناجح`,`من ${found.role==='admin'?'مدير':'موظف'} — ${user}`);
    const cfg2fa=get2FAConfigs();
    if(cfg2fa[found.id]?.enabled){
      show2FALoginModal(found.id,()=>{
        $('loginScreen').style.display='none';$('appShell').style.display='flex';
        setupForRole(found.role);
        if(typeof updateInboxBadge==='function')updateInboxBadge();
        startAutoRefresh();
        if(!checkForceChangePass(found)) toast(`✅ أهلاً ${found.name}!`,'ok');
      });
      return;
    }
    $('loginScreen').style.display='none';$('appShell').style.display='flex';
    setupForRole(found.role);
    startAutoRefresh();
    // تحميل البيانات من Supabase بعد تسجيل الدخول
    if(isSupabaseReady && isSupabaseReady()){
      // أظهر مؤشر تحميل في صفحة البحث
      const _sBtn=$('searchBtn'); if(_sBtn) _sBtn.disabled=true;
      const _cBtn=$('clientSearchBtn'); if(_cBtn) _cBtn.disabled=true;
      Promise.all([sbLoadFiles(), sbLoadHistory(), sbLoadAudit(), sbLoadMessages(), sbLoadSettings()]).then(()=>{
        updateAll();
        startRealtimeSync();
        rebuildClientIndex();
        // أعد تفعيل أزرار البحث بعد اكتمال التحميل
        if(_sBtn) _sBtn.disabled=false;
        if(_cBtn) _cBtn.disabled=false;
      });
    }
    if(!checkForceChangePass(found)) toast(`✅ أهلاً ${found.name}!`,'ok');
  };

  if(preVerified){
    // مسار Supabase: تم التحقق مسبقاً
    // نستخدم sbUserData الممررة مباشرة من _doLoginWithSB (الأدق)
    // أو نبحث في registeredUsers، أو نعود لـ candidate
    let sbCandidate = sbUserData
      || registeredUsers.find(u=>u.user===user || u.username===user)
      || candidate;
    _verifyAndContinue(sbCandidate || null);
  } else {
    // مسار عادي: احسب الهاش وقارنه
    hashPass(pass, candidate?candidate.id:'').then(hashed=>{
      _verifyAndContinue(registeredUsers.find(u=>u.user===user&&u.pass===hashed));
    });
  }
}

function doLogin(){
  const user=$('loginUser').value.trim(), pass=$('loginPass').value.trim();
  if(!user||!pass){toast('⚠️ أدخل اسم المستخدم وكلمة المرور','warn');return;}

  // مسار آمن: إذا Supabase متصل، نجلب pass للمستخدم المحدد فقط (لا نحمّل الكل)
  const _sbConn = (typeof getSB==='function') ? getSB() : null;
  if(_sbConn && typeof isSupabaseReady==='function' && isSupabaseReady()){
    _doLoginWithSB(_sbConn, user, pass);
    return;
  }

  // وضع Offline — تحميل من localStorage
  try{
    const _fresh=lsLoad(LS.users,null);
    if(_fresh) registeredUsers=loadUsersFromStorage(_fresh);
  }catch(e){}
  _doLoginOffline(user, pass);
}

/* 
   PDF EXPORT     100% (  jsPDF)
   : html2canvas     
       PDF      jsPDF.
 */
async function exportPDF(){
  if(typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined'){
    toast('⚠️ مكتبة PDF لم تُحمَّل بعد. انتظر لحظة وأعد المحاولة.','warn');
    return;
  }
  const activePage = document.querySelector('.page.active');
  if(!activePage){ toast('⚠️ لا توجد صفحة نشطة','warn'); return; }

  const pageId       = activePage.id || 'report';
  const fileNameDate = new Date().toLocaleDateString('en-GB').replace(/\//g,'-');

  const pdfBtn = document.querySelector('.pdf-export-btn');
  if(pdfBtn){ pdfBtn.disabled=true; pdfBtn.textContent='⏳'; }
  toast('📸 جاري التقاط الصفحة...','ok');

  try {
    /* 1)       */
    const HIDE = [
      '.pdf-export-btn','.fs-btn','.chart-dl-btn',
      '.auto-logout-bar','#autoLogoutBar','.notif-panel',
      '.mob-menu-btn'
    ];
    const hidden = [];
    HIDE.forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        hidden.push({el, v:el.style.visibility, d:el.style.display});
        el.style.visibility='hidden';
      });
    });

    /* 2)   overflow    */
    const pageBody = activePage.closest('.page-body') || activePage.parentElement;
    let pbOrig = '';
    if(pageBody){ pbOrig = pageBody.style.overflow; pageBody.style.overflow='visible'; }

    /* 3) ضمان تحميل خط Cairo قبل الالتقاط لمنع ظهور رموز غير مكتملة */
    await new Promise(resolve => {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap';
      fontLink.onload = () => document.fonts.ready.then(resolve);
      fontLink.onerror = resolve;
      document.head.appendChild(fontLink);
      // fallback timeout
      setTimeout(resolve, 2000);
    });

    /* 3) html2canvas */
    const canvas = await html2canvas(activePage, {
      scale       : 2,
      useCORS     : true,
      allowTaint  : true,
      backgroundColor : '#f0f5ff',
      scrollX     : 0,
      scrollY     : -window.scrollY,
      windowWidth : Math.max(activePage.scrollWidth, 1200),
      windowHeight: activePage.scrollHeight,
      logging     : false,
      imageTimeout: 15000,
      onclone(clonedDoc){
        /* تضمين Cairo مباشرةً في المستند المُستنسَخ */
        const lnk = clonedDoc.createElement('link');
        lnk.rel='stylesheet';
        lnk.href='https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap';
        clonedDoc.head.appendChild(lnk);
        const st = clonedDoc.createElement('style');
        st.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          *{font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif!important;
             -webkit-font-smoothing:antialiased;
             letter-spacing:0!important;}
          .sidebar{display:flex!important;}
          .pdf-export-btn,.fs-btn,.chart-dl-btn,
          .auto-logout-bar,.notif-panel,.mob-menu-btn
          {visibility:hidden!important;}
        `;
        clonedDoc.head.appendChild(st);
      }
    });

    /* 4)    */
    if(pageBody) pageBody.style.overflow = pbOrig;
    hidden.forEach(({el,v,d})=>{ el.style.visibility=v; });

    /* 5)  PDF    (    ) */
    const {jsPDF} = window.jspdf;

    // حوّل px → mm (96 dpi, scale=2 → نقسم على 2 ثم ×25.4/96)
    const PX_TO_MM = 25.4 / 96 / 2;         // ≈ 0.1323
    const imgWmm   = canvas.width  * PX_TO_MM;
    const imgHmm   = canvas.height * PX_TO_MM;

    // A4: 210×297mm  |  A4L: 297×210mm
    // اختر الاتجاه حسب نسبة الصورة لتناسب A4
    const fitPortrait  = 210;   // عرض A4 عمودي
    const fitLandscape = 297;   // عرض A4 أفقي
    const useRatio     = imgWmm / imgHmm;
    const orientation  = useRatio > 1.3 ? 'landscape' : 'portrait';
    const pgW = orientation==='landscape' ? 297 : 210;
    const pgH = orientation==='landscape' ? 210 : 297;

    // حجم الصورة داخل الصفحة (ممتد للحافة، بدون هامش)
    const imgFitW = pgW;
    const imgFitH = imgFitW / (canvas.width / canvas.height);
    const pagesCount = Math.ceil(imgFitH / pgH);

    const doc = new jsPDF({ orientation, unit:'mm', format:'a4', compress:true });

    const imgDataFull = canvas.toDataURL('image/jpeg', 0.92);

    for(let p = 0; p < pagesCount; p++){
      if(p > 0) doc.addPage();
      // كل صفحة تُظهر شريحة رأسية من الصورة
      const srcY = Math.round((p * pgH / imgFitH) * canvas.height);
      const srcH = Math.min(
        Math.round((pgH / imgFitH) * canvas.height),
        canvas.height - srcY
      );
      if(srcH <= 0) break;

      // أنشئ canvas مؤقتة لهذه الشريحة
      const sc  = document.createElement('canvas');
      sc.width  = canvas.width;
      sc.height = srcH;
      sc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const slice    = sc.toDataURL('image/jpeg', 0.92);
      const sliceHmm = (srcH / canvas.height) * imgFitH;
      doc.addImage(slice, 'JPEG', 0, 0, pgW, Math.min(sliceHmm, pgH));
    }

    doc.save(`CustomerCare-${pageId}-${fileNameDate}.pdf`);
    addAudit('export','تصدير PDF (لقطة شاشة)', pageId);
    toast('✅ تم تصدير PDF بنجاح','ok');

  } catch(err){
    console.error('PDF:', err);
    toast('❌ خطأ: '+err.message,'err');
  } finally {
    if(pdfBtn){
      pdfBtn.disabled=false;
      pdfBtn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> PDF';
    }
  }
}

/*  FORCE CHANGE PASSWORD  */
const DEFAULT_PASSES_HASHED = [];
function checkForceChangePass(user){
  // تغيير كلمة المرور اختياري — لا إجبار على أي مستخدم بما فيهم الموظفين
  // يمكن تفعيله مستقبلاً بإضافة هاشات كلمات المرور الافتراضية في DEFAULT_PASSES_HASHED
  return false;
}
function doForceChangePass(){
  const np=$('forceNewPass').value, cf=$('forceConfirmPass').value;
  const pvf=validatePassword(np);if(pvf){toast('⚠️ '+pvf,'warn');return;}
  if(np!==cf){toast('❌ كلمتا المرور غير متطابقتين','err');return;}
  const pe=validatePassword(np); if(pe){toast('⚠️ '+pe,'warn');return;}
  const uid=appState.user.id;
  hashPass(np, uid).then(async hnp=>{
    try{
      const sb=typeof getSB==='function'?getSB():null;
      if(sb && typeof isSupabaseReady==='function' && isSupabaseReady()){
        const {error:_pe}=await sb.from('cc_users').update({pass:hnp}).eq('id',uid);
        if(_pe){ toast('❌ فشل حفظ كلمة المرور: '+_pe.message,'err'); return; }
      }
    }catch(e){ toast('❌ فشل الاتصال: '+e.message,'err'); return; }
    appState.user.pass=hnp;
    const u=registeredUsers.find(u=>u.id===uid); if(u) u.pass=hnp;
    const lu=USERS.find(x=>x.id===uid); if(lu) lu.pass=hnp;
    saveUsersToLS();
    $('forceChangePassModal').classList.remove('show');
    addAudit('pass','تغيير كلمة المرور الافتراضية',appState.user.name);
    toast('✅ تم تغيير كلمة المرور بنجاح. أهلاً '+appState.user.name+'!','ok');
  });
}

function _directLogout(reason){
  addAudit('logout', reason||'تسجيل خروج تلقائي', appState.user?.name??'');
  _unregisterSession();
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('cc_remember');
  stopAutoRefresh();
  // إيقاف Realtime ومسح البيانات الحساسة من الذاكرة
  if(_realtimeChannel){ try{_realtimeChannel.unsubscribe();}catch(e){} _realtimeChannel=null; }
  appState.files=[]; appState.history=[]; appState.audit=[]; appState.templates=[];
  waTemplates=[];
  appState.user=null; _adminUser=null;
  const shell=$('appShell'), login=$('loginScreen');
  if(shell) shell.style.display='none';
  if(login) login.style.display='flex';
  if(typeof backToLanding==='function') backToLanding();
  toast('🔒 '+(reason||'تم تسجيل الخروج'),'warn');
}
function doLogout(){
  showConfirm('هل تريد تسجيل الخروج؟',()=>{
    addAudit('logout','تسجيل خروج',appState.user?.name??'');
    _unregisterSession();
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('cc_remember');
    stopAutoRefresh();
    // إيقاف Realtime ومسح البيانات الحساسة من الذاكرة
    if(_realtimeChannel){ try{_realtimeChannel.unsubscribe();}catch(e){} _realtimeChannel=null; }
    appState.files=[]; appState.history=[]; appState.audit=[]; appState.templates=[];
    appState.user=null;
    _adminUser=null;
    // مسح بيانات واتساب والقوالب عند تسجيل الخروج لمنع تسريب البيانات
    waTemplates=[]; _waCurrentOwner = null; waRows = []; waSelected = new Set(); wa_idCtr = 100; _waInited = false;
  _clientFilesLoaded = false; _clientFilesLoading = false; // إعادة تعيين بوابة العملاء
    $('appShell').style.display='none';
    $('loginScreen').style.display='flex';
    backToLanding();
    // إعادة تهيئة Supabase client حتى لا يضطر المستخدم لإعادة إدخال الـ credentials
    sb = null; sbLastUrl = ''; sbLastKey = '';
    if (typeof sbInit === 'function') sbInit();
    toast('تم تسجيل الخروج','ok');
  },'🚪');
}

/*  SETUP & NAV  */

// ══════════════════════════════════════════════════════════════
// ⚡ DEBOUNCE UTILITY
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// 🗣️ رسائل الخطأ — ترجمة التقنية إلى عربية واضحة
// ══════════════════════════════════════════════════════════════
function friendlyError(e){
  if(!e) return 'حدث خطأ غير معروف';
  const msg = (e.message||e.toString()).toLowerCase();
  if(msg.includes('network') || msg.includes('fetch'))
    return '⚠️ تعذّر الاتصال بالخادم — تحقق من الاتصال بالإنترنت';
  if(msg.includes('rls') || msg.includes('permission') || msg.includes('policy'))
    return '🔒 صلاحيات قاعدة البيانات غير مضبوطة — راجع إعدادات Supabase';
  if(msg.includes('duplicate') || msg.includes('unique'))
    return '⚠️ هذه البيانات موجودة مسبقاً';
  if(msg.includes('timeout'))
    return '⏱️ انتهت مهلة الاتصال — حاول مرة أخرى';
  if(msg.includes('jwt') || msg.includes('token') || msg.includes('auth'))
    return '🔑 انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً';
  if(msg.includes('storage') || msg.includes('quota'))
    return '💾 مساحة التخزين ممتلئة — احذف ملفات قديمة';
  if(msg.includes('too large') || msg.includes('size'))
    return '📦 حجم الملف كبير جداً';
  return '❌ ' + (e.message || 'حدث خطأ — حاول مرة أخرى');
}

// ══════════════════════════════════════════════════════════════
// ⏰ وقت نسبي — "منذ ساعتين"، "أمس"، إلخ
// ══════════════════════════════════════════════════════════════
function timeAgo(dateStr){
  if(!dateStr) return '—';
  try{
    const d = new Date(dateStr);
    if(isNaN(d)) return String(dateStr);
    const diff = Date.now() - d.getTime();
    const sec  = Math.floor(diff/1000);
    const min  = Math.floor(sec/60);
    const hr   = Math.floor(min/60);
    const day  = Math.floor(hr/24);
    if(sec  <  60) return 'الآن';
    if(min  <  60) return 'منذ ' + min + (min===1?' دقيقة':' دقائق');
    if(hr   <  24) return 'منذ ' + hr  + (hr===1?' ساعة':' ساعات');
    if(day  ===1)  return 'أمس';
    if(day  <   7) return 'منذ ' + day + ' أيام';
    if(day  <  30) return 'منذ ' + Math.floor(day/7) + ' أسابيع';
    if(day  < 365) return 'منذ ' + Math.floor(day/30) + ' أشهر';
    return 'منذ ' + Math.floor(day/365) + ' سنوات';
  }catch(e){ return String(dateStr); }
}

// ══════════════════════════════════════════════════════════════
// ✅ تأكيد بصري لأزرار الحفظ
// ══════════════════════════════════════════════════════════════
function btnSaved(btnEl, duration=2000){
  if(!btnEl) return;
  const orig = btnEl.innerHTML;
  btnEl.innerHTML = '✅ تم الحفظ';
  btnEl.disabled = true;
  btnEl.style.background = 'linear-gradient(135deg,#059669,#10b981)';
  btnEl.style.color = '#fff';
  setTimeout(()=>{
    btnEl.innerHTML = orig;
    btnEl.disabled = false;
    btnEl.style.background = '';
    btnEl.style.color = '';
  }, duration);
}
function btnLoading(btnEl, label='جارٍ الحفظ...'){
  if(!btnEl) return;
  btnEl._origHtml = btnEl.innerHTML;
  btnEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><span class="spin-icon">⏳</span>' + label + '</span>';
  btnEl.disabled = true;
}
function btnReset(btnEl){
  if(!btnEl) return;
  btnEl.innerHTML = btnEl._origHtml || btnEl.innerHTML;
  btnEl.disabled = false;
}

// ══════════════════════════════════════════════════════════════
// ⌨️ اختصارات لوحة المفاتيح
// ══════════════════════════════════════════════════════════════
function _initKeyboardShortcuts(){
  document.addEventListener('keydown', e=>{
    // Escape — إغلاق أي نافذة مفتوحة
    if(e.key==='Escape'){
      document.querySelectorAll('.modal.show').forEach(m=>{
        m.classList.remove('show');
        document.body.style.overflow='';
      });
      if(typeof closeInbox==='function') closeInbox();
      return;
    }
    // لا نشغّل الاختصارات إذا كان المستخدم يكتب في حقل
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable) return;
    if(!appState.user) return;

    if(e.ctrlKey || e.metaKey){
      switch(e.key){
        case 'f': // Ctrl+F → صفحة البحث
          e.preventDefault();
          showPage('search');
          setTimeout(()=>document.getElementById('searchInput')?.focus(), 100);
          break;
        case 'k': // Ctrl+K → البحث العالمي
          e.preventDefault();
          const gt = document.getElementById('globalSearchToggle');
          if(gt){ gt.checked=!gt.checked; if(typeof toggleGlobalSearch==='function') toggleGlobalSearch(gt.checked); }
          break;
        case 'm': // Ctrl+M → الرسائل
          e.preventDefault();
          if(typeof openInbox==='function') openInbox();
          break;
      }
    }
  });
}
function _debounce(fn, delay){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=>fn.apply(this,args), delay);
  };
}
const _debouncedHandleSearch = _debounce(()=>handleSearch(), 300);
const _debouncedGlobalSearch = _debounce(()=>handleGlobalSearch(), 300);
const _debouncedRenderUsers  = _debounce(()=>renderUsersTable(), 200);
const _debouncedRenderWa     = _debounce(()=>{ _waPg=1; renderTable(); }, 200);
function setupForRole(role){
  const u=appState.user;
  // ── تحميل القوالب الخاصة بهذا المستخدم (عزل البيانات بين الموظفين) ──
  if(typeof initUserTemplates === 'function') initUserTemplates();
  sv('sbName',u.name);sv('sbRole',{admin:'مدير النظام',subuser:'موظف'}[role]);
  $('sbAvatar').textContent=u.avatar;$('sbAvatar').style.background=u.color+'33';
  const badge=$('topbarBadge'); badge.className='role-badge '+(role==='admin'?'role-admin':'role-subuser'); badge.textContent={admin:'مدير النظام',subuser:'موظف'}[role];
  $('navAdmin').style.display=role==='admin'?'block':'none';
  $('navSubuser').style.display=role==='subuser'?'block':'none';
  const uc=$('uploadCard'); if(uc) uc.style.display=role==='admin'?'none':'block';
  if(role==='subuser') applyEmployeeNavPerms();
  if(role==='admin'){renderSbSwitchList();$('sbSwitchEmp').style.display='block';}
  else $('sbSwitchEmp').style.display='none';
  sv('auditCount',appState.audit.length);
  applySidebarBrand(); setTheme(_currentTheme);
  showPage(role==='admin'?'dashboard':'whatsapp');
  updateAll();
  // ── ملء حقول Supabase بعد كل تسجيل دخول ──
  setTimeout(function(){
    var eu=document.getElementById('sbUrlInput'),ek=document.getElementById('sbKeyInput');
    var su=window.SUPABASE_URL||'',sk=window.SUPABASE_KEY||'';
    if(eu) eu.value=(su!=='YOUR_SUPABASE_URL')?su:'';
    if(ek) ek.value=(sk!=='YOUR_SUPABASE_ANON_KEY')?sk:'';
    if(typeof window.updateSBStatus==='function') window.updateSBStatus();
  },200);
}
function applyEmployeeNavPerms(){
  if(!appState.user) return;
  const u=registeredUsers.find(r=>r.id===appState.user.id);
  const perms=(u&&u.permissions)?u.permissions:{};
  const map={navItemWhatsapp:'whatsapp',navItemFiles:'files',navItemSearch:'search',navItemHistory:'history',navItemExport:'export',navItemMyAudit:'my-audit'};
  Object.entries(map).forEach(([elId,key])=>{const el=$(elId);if(el)el.style.display=perms[key]!==false?'':'none';});
  // ضمان إخفاء قائمة الموظفين دائماً للموظف
  const switchBox=$('sbSwitchEmp'); if(switchBox) switchBox.style.display='none';
}
const PAGE_TITLES={dashboard:['لوحة التحكم','نظرة عامة'],reports:['التقارير المرئية','مخططات وإحصائيات'],files:['رفع الملفات','ملفات Excel/CSV'],search:['البحث الذكي','استعلام برقم الهوية'],history:['سجل الاستعلامات','تاريخ الاستعلامات'],export:['تصدير النتائج','تصدير البيانات'],users:['إدارة الموظفين','تسجيل وإدارة الموظفين'],settings:['الإعدادات','ضبط النظام'],permissions:['توزيع الصلاحيات','إدارة صلاحيات الموظفين'],audit:['سجل التدقيق','مراقبة الأنشطة الأمنية'],'my-audit':['سجل نشاطي','أحداث حسابك الشخصي'],whatsapp:['إرسال الرسائل','رسائل WhatsApp'],'emp-dashboard':['لوحة الإحصائيات','إحصائياتك الشخصية']};
function showPage(name, navEl){
  // ── حماية الصلاحيات: منع الموظف من الوصول لصفحات محظورة ──
  if(appState.user && appState.user.role==='subuser'){
    const PERM_MAP={whatsapp:'whatsapp',files:'files',search:'search',history:'history',export:'export'};
    const requiredPerm = PERM_MAP[name];
    if(requiredPerm){
      const u=registeredUsers.find(r=>r.id===appState.user.id);
      const perms=(u&&u.permissions)?u.permissions:{};
      if(perms[requiredPerm]===false){
        toast('⛔ ليس لديك صلاحية الوصول لهذه الصفحة','err');
        return;
      }
    }
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+name); if(pg) pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(navEl) navEl.classList.add('active');
  if(typeof isMobile==='function' && isMobile()) { if(typeof closeSidebar==='function') closeSidebar(); }
  
  const pb=document.querySelector('.page-body');
  if(pb) pb.scrollTop=0;
  
  if(typeof PAGE_TITLES !== 'undefined') {
    const t=PAGE_TITLES[name]||['—','—']; 
    if(typeof sv==='function') { sv('topbarTitle',t[0]); sv('topbarSub',t[1]); }
  }

 // استبدل بـ:
try{
  if(name==='export'      && typeof updateExportStats==='function')    updateExportStats();
  if(name==='permissions' && typeof renderPermissionsPage==='function') renderPermissionsPage();
  if(name==='whatsapp'    && typeof initWaPage==='function')            initWaPage();
  if(name==='emp-dashboard' && typeof updateEmpDashboard==='function'){
    updateEmpDashboard();
    // أعد تحميل السجل من Supabase لضمان أحدث البيانات
    if(typeof isSupabaseReady==='function' && isSupabaseReady() && typeof sbLoadHistory==='function'){
      sbLoadHistory();
    }
  }
  if(name==='history'     && typeof renderHistory==='function')         renderHistory();
  if(name==='users'){
    if(typeof renderUsersTable==='function')   renderUsersTable();
    if(typeof refreshSessionCounts==='function') refreshSessionCounts(); // ✅ تحديث عدد الجلسات من Supabase
    if(typeof renderSbSwitchList==='function') renderSbSwitchList();
  }
  if(name==='settings'    && typeof loadSettingsFields==='function')    loadSettingsFields();
  if(name==='reports'     && typeof renderReports==='function')         setTimeout(renderReports, 100);
  if(name==='dashboard'   && typeof updateAll==='function')             updateAll();
  if(name==='audit'       && typeof renderAudit==='function')           renderAudit();
  if(name==='my-audit'    && typeof renderMyAudit==='function')         renderMyAudit();
  if(name==='search'){
    if(typeof updateSearchFileSelect==='function') updateSearchFileSelect();
    if(typeof _savedSearch !== 'undefined' && (_savedSearch.query||_savedSearch.nameQ)){
      setTimeout(()=>{
        const si=document.getElementById('searchInput'),sn=document.getElementById('searchInputName'),sp=document.getElementById('searchInputPhone'),sf=document.getElementById('searchFileSelect');
        if(si)si.value=_savedSearch.query;if(sn)sn.value=_savedSearch.nameQ;if(sp)sp.value=_savedSearch.phoneQ;if(sf&&_savedSearch.fileIdx)sf.value=_savedSearch.fileIdx;
        if(typeof _searchResults !== 'undefined' && _searchResults.length && typeof handleSearch==='function') handleSearch(typeof _pg !== 'undefined' ? _pg.search : 0);
      },50);
    }
  }
}catch(_spErr){ console.error('showPage render error ['+name+']:', _spErr); }
}

/*  SIDEBAR MOBILE  */
function toggleSidebar(){const sb=$('sidebar'),ov=$('sidebarOverlay'),btn=$('mobMenuBtn');const open=sb.classList.contains('open');sb.classList.toggle('open',!open);ov.classList.toggle('show',!open);if(btn)btn.textContent=open?'☰':'✕';}
function closeSidebar(){
  const sb=$('sidebar'), ov=$('sidebarOverlay'), mob=$('mobOverlay'), btn=$('mobMenuBtn');
  if(sb){ sb.classList.remove('open'); sb.classList.remove('mob-open'); }
  if(ov) ov.classList.remove('show');
  if(mob) mob.classList.remove('active');
  if(btn) btn.textContent='☰';
}

/*  FILES / UPLOAD  */
const MAX_FILE_SIZE_MB = 50;
function handleFileUpload(file){
  // ── فحص حجم الملف ──
  if(file.size > MAX_FILE_SIZE_MB * 1024 * 1024){
    toast(`❌ الملف "${file.name}" يتجاوز الحد المسموح (${MAX_FILE_SIZE_MB} MB). الحجم الفعلي: ${(file.size/1024/1024).toFixed(1)} MB`,'err');
    return;
  }
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      let wb; if(file.name.toLowerCase().endsWith('.csv')) wb=XLSX.read(ev.target.result,{type:'string'}); else wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]]; const json=XLSX.utils.sheet_to_json(ws,{header:1}); const headers=json[0].map(String); const data=json.slice(1).filter(r=>r.some(c=>c!==undefined&&c!==''));
      pendingFiles.push({name:file.name,headers,data}); if(pendingFiles.length===1) openMapping(0);
    }catch(e){toast('❌ خطأ: '+e.message,'err');}
  };
  if(file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file,'UTF-8'); else reader.readAsArrayBuffer(file);
}
function openMapping(idx){
  const pf=pendingFiles[idx]; if(!pf) return; pendingFileIdx=idx;
  $('mapFileName').textContent=pf.name; $('colMapSection').style.display='block';
  const ci=$('colId'),cn=$('colName');
  ci.innerHTML='<option value="-1">— اختر —</option>'; cn.innerHTML='<option value="-1">— اختر —</option>';
  pf.headers.forEach((h,i)=>{ci.innerHTML+=`<option value="${i}">${h}</option>`;cn.innerHTML+=`<option value="${i}">${h}</option>`;});
  const idIdx=pf.headers.findIndex(h=>/هوية|id|رقم|national/i.test(h)); const nameIdx=pf.headers.findIndex(h=>/اسم|name/i.test(h));
  if(idIdx>=0) ci.value=idIdx; if(nameIdx>=0) cn.value=nameIdx;
  const wrap=$('extraColsWrap'); wrap.innerHTML='';
  pf.headers.forEach((h,i)=>{const lbl=document.createElement('label');lbl.style.cssText='display:inline-flex;align-items:center;gap:4px;background:var(--b50);border:1px solid var(--s200);border-radius:20px;padding:4px 11px;cursor:pointer;font-size:11.5px;font-family:Cairo,sans-serif;';lbl.innerHTML=`<input type="checkbox" value="${i}" checked style="accent-color:var(--b500);"> ${h}`;wrap.appendChild(lbl);});
  $('promptTemplate').value=appState.settings.template;
}
function saveFileConfig(){
  const pf=pendingFiles[pendingFileIdx]; if(!pf) return;
  const idCol=parseInt($('colId').value); if(isNaN(idCol)||idCol<0){toast('⚠️ حدد عمود رقم الهوية','warn');return;}
  const nameCol=parseInt($('colName').value); const extraCols=[...document.querySelectorAll('#extraColsWrap input:checked')].map(c=>parseInt(c.value));
  const prompt=$('promptTemplate').value;
  /*       */
  const ids = pf.data.map(r=>String(r[idCol]||'').trim()).filter(Boolean);
  const uniqueIds = new Set(ids);
  const dupCount = ids.length - uniqueIds.size;
  const emptyCount = pf.data.filter(r=>!String(r[idCol]||'').trim()).length;
  let warnings=[];
  if(dupCount>0) warnings.push(`⚠️ ${dupCount} صف مكرر برقم هوية متطابق`);
  if(emptyCount>0) warnings.push(`⚠️ ${emptyCount} صف بدون رقم هوية`);
  if(warnings.length) toast(warnings.join(' | '),'warn');
  /*   Map   */
  const idIndex = new Map();
  pf.data.forEach((row,i)=>{ const k=String(row[idCol]||'').trim(); if(k) idIndex.set(k,i); });
  const nameIndex = new Map();
  if(!isNaN(nameCol)&&nameCol>=0){
    pf.data.forEach((row,i)=>{ const k=normalizeAr(row[nameCol]); if(k) { if(!nameIndex.has(k)) nameIndex.set(k,[]); nameIndex.get(k).push(i); } });
  }
  appState.files.push({id:Date.now(),name:pf.name,headers:pf.headers,data:pf.data,idIndex,nameIndex,idCol,nameCol:isNaN(nameCol)?-1:nameCol,extraCols,prompt,uploadedAt:new Date().toLocaleString('ar-SA'),uploadedBy:appState.user?.user||appState.user?.name||'—'});
  pendingFiles.splice(pendingFileIdx,1); $('colMapSection').style.display='none';
  if(pendingFiles.length>0) openMapping(0);
  IDB.save(appState.files).catch(()=>lsSave(LS.files,appState.files.map(f=>({...f,data:[]}))));
  updateAll();

  // ══ مزامنة Supabase: رفع الملف بدون إعادة تحميل Realtime ══
  if(isSupabaseReady && isSupabaseReady()){
    const _newFile = appState.files[appState.files.length-1];
    (async ()=>{
      _suppressFilesRealtime = true; // أوقف Realtime أثناء الرفع
      try{
        // الخطوة 1: احفظ metadata واحصل على newId
        const newId = await sbSaveFileMeta(_newFile);
        if(!newId){ _suppressFilesRealtime = false; return; }

        // الخطوة 2: حدّث id الملف في الذاكرة
        _newFile.id = newId;
        updateAll();

        // الخطوة 3: ارفع السجلات (انتظر اكتمالها)
        await sbSaveFileRecords(newId, _newFile.data);

        // الخطوة 4: حدّث uploaded_at دون إثارة إعادة تحميل
        const sb = getSB();
        await sb.from('cc_files').update({uploadedat: new Date().toISOString()}).eq('id', newId);
        toast(`✅ تم حفظ "${_newFile.name}" بالكامل`, 'ok');
      } catch(e){
        console.error('sbSaveFile error:', e);
        toast('⚠️ خطأ في التزامن: ' + e.message, 'warn');
      } finally {
        // بعد ثانيتين: أعد تفعيل Realtime (تجاهل أي أحداث تراكمت أثناء الرفع)
        setTimeout(() => { _suppressFilesRealtime = false; }, 2000);
      }
    })();
  }
  addAudit('upload',`رفع ملف: ${pf.name}`,`${pf.data.length} سجل`);
  if(appState.user?.role==='admin') addNotif('📤','ملف جديد مرفوع',`${pf.name} — ${pf.data.length} سجل`);
  toast(`✅ تم رفع "${pf.name}"`,'ok');
}
function cancelMapping(){pendingFiles=[];$('colMapSection').style.display='none';}
// تحديث ذكي — يقارن البيانات ويتجنب إعادة الرسم غير الضرورية
let _lastFilesHash = '', _lastHistoryLen = 0, _lastAuditLen = 0;
function _hashFiles(){ return appState.files.map(f=>f.id+':'+f.data?.length).join('|'); }

function updateAll(force){
  const fHash = _hashFiles();
  const filesChanged  = force || fHash !== _lastFilesHash;
  const histChanged   = force || appState.history.length !== _lastHistoryLen;
  const auditChanged  = force || appState.audit.length  !== _lastAuditLen;

  if(filesChanged){
    updateFilesTable();
    updateDashFiles();
    updateSearchFileSelect();
    updateExportFileSelect();
    rebuildClientIndex();
    sv('filesCountE', appState.files.length);
    const fb=$('filesBadge'); if(fb) fb.textContent=appState.files.length+' ملف';
    _lastFilesHash = fHash;
  }
  if(histChanged || filesChanged){
    updateDashActivity();
    // تحديث لوحة إحصائيات الموظف إذا كانت مفتوحة
    if(typeof updateEmpDashboard==='function') updateEmpDashboard();
    _lastHistoryLen = appState.history.length;
  }
  if(auditChanged){
    sv('auditCount', appState.audit.length);
    _lastAuditLen = appState.audit.length;
  }
  updateStats();
}
/*       30   */
/*  NOTIFICATIONS SYSTEM  */
let _notifs=[];
function addNotif(icon,title,detail=''){
  _notifs.unshift({id:Date.now(),icon,title,detail,time:new Date().toLocaleTimeString('ar-SA'),read:false});
  if(_notifs.length>50) _notifs=_notifs.slice(0,50);
  renderNotifBadge();
}
function renderNotifBadge(){
  const unread=_notifs.filter(n=>!n.read).length;
  const badge=$('notifBadge');
  if(badge){badge.style.display=unread>0?'block':'none';badge.textContent=unread>9?'9+':unread;}
}
/*  TABLE FULLSCREEN  */
function toggleFullscreen(cardEl){
  if(typeof cardEl==='string') cardEl=$(cardEl);
  if(!cardEl) return;
  const isFs=cardEl.classList.contains('tbl-fullscreen');
  cardEl.classList.toggle('tbl-fullscreen');
  const btn=cardEl.querySelector('.fs-btn');
  if(btn) btn.textContent=isFs?'⛶':'✕ خروج';
  if(!isFs) document.addEventListener('keydown',function _escFs(e){if(e.key==='Escape'){cardEl.classList.remove('tbl-fullscreen');if(btn)btn.textContent='⛶';document.removeEventListener('keydown',_escFs);}});
}
function toggleNotifPanel(){
  const p=$('notifPanel');if(!p)return;
  const open=p.style.display==='block';
  p.style.display=open?'none':'block';
  if(!open){
    renderNotifList();
    _notifs.forEach(n=>n.read=true);
    renderNotifBadge();
    document.addEventListener('click',closeNotifOutside,{once:true});
  }
}
function closeNotifOutside(e){
  const p=$('notifPanel'),b=$('notifBtn');
  if(p&&b&&!p.contains(e.target)&&!b.contains(e.target)) p.style.display='none';
}
function renderNotifList(){
  const list=$('notifList');if(!list)return;
  if(!_notifs.length){list.innerHTML='<div style="text-align:center;padding:20px;color:var(--s400);font-size:12px;">لا توجد إشعارات</div>';return;}
  list.innerHTML=_notifs.slice(0,20).map(n=>`
    <div class="notif-item ${n.read?'':'unread'}">
      <div style="display:flex;gap:8px;align-items:flex-start;">
        <span style="font-size:16px;">${escHtml(String(n.icon||''))}</span>
        <div><div style="font-weight:700;">${escHtml(String(n.title||''))}</div>${n.detail?`<div style="color:var(--s500)">${escHtml(String(n.detail))}</div>`:''}
        <div class="notif-time">${escHtml(String(n.time||''))}</div></div>
      </div>
    </div>`).join('');
}
function clearNotifs(){_notifs=[];renderNotifBadge();const l=$('notifList');if(l)l.innerHTML='<div style="text-align:center;padding:20px;color:var(--s400);font-size:12px;">لا توجد إشعارات</div>';}

/* 
   HELP GUIDE   
        (admin / subuser)
 */
const HELP_CONTENT = {

  admin: {
    role: '👑 مدير النظام',
    subtitle: 'دليل إدارة النظام والموظفين والبيانات',
    tabs: [
      {
        id: 'setup', icon: '⚙️', label: 'الإعداد الأولي',
        sections: [{
          title: '🚀 البدء الأول',
          steps: [
            { n:'1', title:'ضبط هوية الشركة', desc:'انتقل إلى الإعدادات ← هوية الشركة. أدخل اسم شركتك وشعارها (رابط URL أو رفع صورة). يظهر الشعار في الشريط الجانبي لجميع المستخدمين.' },
            { n:'2', title:'إضافة مفتاح الذكاء الاصطناعي', desc:'من الإعدادات ← الذكاء الاصطناعي، أدخل مفتاح Anthropic API. بدونه يعمل النظام بردود تجريبية فقط.' },
            { n:'3', title:'ضبط حد رسائل واتساب', desc:'في الإعدادات ← إعدادات واتساب، حدد الحد الأقصى للرسائل بالساعة (الافتراضي: 40).' },
            { n:'4', title:'تغيير كلمة المرور', desc:'يُنصح بتغيير كلمة المرور الافتراضية فور تسجيل الدخول لأول مرة. من أيقونة حسابك ← تغيير كلمة المرور. استخدم كلمة قوية (8+ أحرف، أرقام، رموز).' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'احتفظ بنسخة احتياطية من الإعدادات دورياً: الإعدادات ← تصدير نسخة احتياطية.' },
            { type:'warn', icon:'⚠️', text:'لا تشارك مفتاح API مع أي شخص.' }
          ]
        }]
      },
      {
        id: 'users', icon: '👥', label: 'إدارة الموظفين',
        sections: [{
          title: '👤 إضافة وإدارة الحسابات',
          steps: [
            { n:'1', title:'إضافة موظف جديد', desc:'إدارة الموظفين ← إضافة موظف. أدخل بيانات الموظف الكاملة واختر الدور "موظف".' },
            { n:'2', title:'توزيع الصلاحيات', desc:'من صفحة الصلاحيات، حدد لكل موظف الصفحات التي يمكنه الوصول إليها: الرسائل، الملفات، البحث، السجل، التصدير.' },
            { n:'3', title:'إيقاف / تفعيل حساب', desc:'انقر تعديل على أي موظف وغيّر حالته إلى "موقوف" لمنعه من الدخول فوراً دون حذف بياناته.' },
            { n:'4', title:'تعيين شعار مخصص للموظف', desc:'عند تعديل بيانات موظف (دور: موظف)، يظهر قسم "🖼️ شعار مخصص للموظف" أسفل النموذج. أدخل رابط URL أو ارفع صورة. عند دخول الموظف، يرى شعاره في الشريط الجانبي بدلاً من شعار النظام.' }
          ],
          tips: [
            { type:'ok', icon:'🖼️', text:'الشعار المخصص مستقل تماماً عن شعار الشركة. يمكن تخصيص شعار مختلف لكل موظف أو فرع.' },
            { type:'warn', icon:'⚠️', text:'النظام يمنع الموظف من فتح الحساب على جهازين في نفس الوقت. تُسجَّل أي محاولة في سجل التدقيق.' }
          ]
        }]
      },
      {
        id: 'files', icon: '📁', label: 'الملفات والبيانات',
        sections: [{
          title: '📤 رفع ملفات البيانات',
          steps: [
            { n:'1', title:'تجهيز ملف Excel أو CSV', desc:'يجب أن يحتوي على عمود رقم الهوية وأعمدة الرسائل. حمّل النموذج الجاهز من صفحة رفع الملفات.' },
            { n:'2', title:'رفع الملف', desc:'اسحب الملف أو انقر لتحديده. الحد الأقصى 50 ميجابايت.' },
            { n:'3', title:'تحديد الأعمدة', desc:'بعد الرفع تظهر نافذة تحديد الأعمدة. حدد عمود رقم الهوية والاسم، ثم اختر الأعمدة الإضافية.' },
            { n:'4', title:'مراجعة التحذيرات', desc:'النظام يكتشف الصفوف المكررة والخانات الفارغة ويعرض تنبيهاً. راجعها قبل الحفظ.' }
          ],
          tips: [
            { type:'ok', icon:'✅', text:'النظام يدعم ملفات متعددة. يمكن البحث في كل ملف على حدة.' },
            { type:'warn', icon:'⚠️', text:'بعد رفع الملف تُرسَل البيانات لـ Supabase. انتظر حتى تختفي رسالة "جارٍ التحميل" قبل الانتقال.' }
          ]
        }]
      },
      {
        id: 'history_admin', icon: '📋', label: 'سجل الاستعلامات',
        sections: [{
          title: '📋 مراقبة جميع الاستعلامات (ناجحة وفاشلة)',
          steps: [
            { n:'1', title:'الوصول للسجل الكامل', desc:'من القائمة الجانبية ← سجل الاستعلامات. يعرض المدير جميع عمليات البحث لكل الموظفين مع التاريخ والنتيجة (ناجح ✓ أو فاشل ✗).' },
            { n:'2', title:'البحث والتصفية', desc:'استخدم حقل البحث لتصفية السجل باسم الموظف أو رقم الهوية أو نطاق زمني.' },
            { n:'3', title:'تحليل الاستعلامات الفاشلة', desc:'الاستعلامات الفاشلة (✗) تظهر للمدير فقط. تساعد في اكتشاف الأخطاء والأنماط المشبوهة.' },
            { n:'4', title:'تصدير السجل الكامل', desc:'انقر "تصدير Excel" لحفظ جميع الاستعلامات (ناجحة وفاشلة) بصيغة xlsx.' }
          ],
          tips: [
            { type:'ok', icon:'🔍', text:'الموظف يرى في سجله الاستعلامات الناجحة فقط. المدير يرى الكل بما فيها الفاشلة.' },
            { type:'warn', icon:'⚠️', text:'إذا لاحظت استعلامات فاشلة متكررة لنفس الموظف، راجع سجل التدقيق فوراً.' }
          ]
        }]
      },
      {
        id: 'inbox_admin', icon: '📩', label: 'الرسائل الداخلية',
        sections: [{
          title: '📩 إرسال الرسائل الداخلية',
          steps: [
            { n:'1', title:'فتح صندوق الرسائل', desc:'انقر أيقونة 📩 في شريط الأدوات العلوي. الشارة الخضراء تُشير لرسائل جديدة.' },
            { n:'2', title:'إرسال لموظف أو أكثر', desc:'انقر "✏️ رسالة جديدة". تظهر قائمة المستخدمين كـ checkboxes — ضع ✔ بجانب كل من تريد مراسلته (يمكن تحديد أكثر من شخص). أدخل الموضوع والرسالة ← "إرسال".' },
            { n:'3', title:'الإرسال الجماعي', desc:'بتحديد أكثر من موظف، يرسل النظام رسالة مستقلة لكل شخص محدد في آنٍ واحد.' },
            { n:'4', title:'الرد على رسالة', desc:'افتح الرسالة ← "↩️ رد" ← يُحدَّد المستلم تلقائياً في الـ checkbox ← أكمل الرد وأرسل.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'استخدم الإرسال المتعدد لإبلاغ جميع الموظفين بتحديث عاجل دفعةً واحدة.' },
            { type:'warn', icon:'⚠️', text:'الرسائل مخزنة في Supabase وتظهر من أي جهاز بعد تسجيل الدخول.' }
          ]
        }]
      },
      {
        id: 'permissions', icon: '🔐', label: 'الصلاحيات',
        sections: [{
          title: '🔑 إدارة صلاحيات الموظفين',
          steps: [
            { n:'1', title:'فتح صفحة الصلاحيات', desc:'من القائمة الجانبية ← الصلاحيات. تظهر جدول بجميع الموظفين مع مفاتيح تشغيل/إيقاف لكل صلاحية.' },
            { n:'2', title:'الصلاحيات المتاحة', desc:'💬 إرسال الرسائل، 📁 رفع الملفات، 🔍 البحث، 📋 السجل، 📤 التصدير، 🛡️ سجل نشاطي. فعّل أو أوقف كل صفحة منفردة.' },
            { n:'3', title:'حفظ صلاحية موظف واحد', desc:'اضغط زر "💾 حفظ" في نهاية صف الموظف. التغيير يسري فوراً حتى دون إعادة دخول الموظف.' },
            { n:'4', title:'حفظ جميع الصلاحيات دفعة واحدة', desc:'اضغط "💾 حفظ الكل" في رأس الصفحة لتطبيق جميع التعديلات على جميع الموظفين في آن واحد.' },
            { n:'5', title:'مراجعة الصلاحيات', desc:'الصفحات المُوقفة تختفي تلقائياً من قائمة الموظف. المدير يرى دائماً جميع الصفحات بصرف النظر عن الصلاحيات.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'امنح الموظف الصلاحيات اللازمة لعمله فقط — مبدأ الحد الأدنى من الصلاحيات.' },
            { type:'warn', icon:'⚠️', text:'إيقاف "البحث" يمنع الموظف من الاستعلام فوراً. إيقاف "سجل نشاطي" يُخفي السجل الشخصي فقط (لا يوقف التسجيل).' }
          ]
        }]
      },
      {
        id: 'monitor', icon: '🛡️', label: 'المراقبة',
        sections: [{
          title: '📊 متابعة الأداء',
          steps: [
            { n:'1', title:'لوحة التحكم', desc:'إحصائيات فورية: الملفات، السجلات، الاستعلامات، آخر الأنشطة. تتجدد كل 30 ثانية.' },
            { n:'2', title:'التقارير المرئية', desc:'مخططات لنسب النجاح/الفشل، استعلامات الموظفين، النشاط اليومي. يمكن تحميلها PNG.' },
            { n:'3', title:'سجل التدقيق', desc:'يتتبع: تسجيل الدخول، رفع الملفات، البحث، تعديل المستخدمين. يُصدَّر Excel.' },
            { n:'4', title:'تصدير البيانات', desc:'استخراج نتائج البحث وسجل الاستعلامات بصيغ Excel وCSV وPDF.' }
          ],
          tips: [{ type:'ok', icon:'📧', text:'أضف بريدك في إعدادات المدير لتلقي تنبيهات أمنية عند محاولات الدخول المشبوهة.' }]
        }]
      },
      {
        id: 'impersonate', icon: '🔁', label: 'عرض كموظف',
        sections: [{
          title: '🔁 التنكر — عرض النظام بعيني الموظف',
          steps: [
            { n:'1', title:'ما هو التنكر؟', desc:'ميزة حصرية للمدير. ترى بالضبط ما يراه الموظف: نفس الصلاحيات والملفات والقيود.' },
            { n:'2', title:'التفعيل', desc:'من القائمة الجانبية، انقر على اسم الموظف في "عرض كـ". يظهر شريط تحذيري أصفر في الأعلى.' },
            { n:'3', title:'الشعار أثناء التنكر', desc:'إذا كان للموظف شعار مخصص، سيظهر أثناء التنكر في الشريط الجانبي. هذا يؤكد أن التنكر يعكس تجربة الموظف الحقيقية.' },
            { n:'4', title:'العودة للحساب الأصلي', desc:'انقر "⬅ العودة لحساب المدير" في الشريط الأصفر.' }
          ],
          tips: [
            { type:'warn', icon:'⚠️', text:'كل ما تفعله أثناء التنكر يُسجَّل. استخدمه للاختبار فقط.' },
            { type:'ok', icon:'💡', text:'بعد تعيين شعار مخصص لموظف، استخدم التنكر للتحقق من ظهوره.' }
          ]
        }]
      },
      {
        id: 'global_search', icon: '🌐', label: 'البحث العالمي',
        sections: [{
          title: '🌐 البحث في جميع الملفات دفعةً واحدة',
          steps: [
            { n:'1', title:'ما هو البحث العالمي؟', desc:'يبحث في جميع ملفات البيانات المرفوعة في نفس الوقت. مثالي حين لا تعرف أي ملف يحتوي العميل.' },
            { n:'2', title:'التفعيل', desc:'في صفحة البحث الذكي، فعّل مفتاح "بحث عالمي".' },
            { n:'3', title:'قراءة النتائج', desc:'كل نتيجة تُشير لاسم الملف المصدر. انقر "فتح" للانتقال مباشرة للسجل الكامل.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'استخدمه حين يراجعك عميل ولا تتذكر في أي ملف يظهر.' },
            { type:'warn', icon:'⚠️', text:'البحث العالمي أبطأ مع الملفات الكبيرة. الملف الواحد أسرع وأدق إن كنت تعرفه.' }
          ]
        }]
      },
      {
        id: 'export_admin', icon: '📤', label: 'تصدير النتائج',
        sections: [{
          title: '📤 خيارات التصدير',
          steps: [
            { n:'1', title:'تصدير نتائج البحث', desc:'من صفحة التصدير، اختر النطاق الزمني والصيغة (Excel/CSV/PDF).' },
            { n:'2', title:'تصدير سجل الاستعلامات', desc:'السجل المُصدَّر يشمل الناجحة والفاشلة معاً — خلافاً لما يراه الموظف في واجهته.' },
            { n:'3', title:'نسخة احتياطية', desc:'من الإعدادات ← تصدير نسخة احتياطية. يُصدِّر الإعدادات والمستخدمين مع شعاراتهم المخصصة.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'صدّر نسخة احتياطية أسبوعياً.' },
            { type:'warn', icon:'⚠️', text:'ملفات البيانات تبقى في Supabase. النسخة الاحتياطية تشمل الإعدادات والمستخدمين.' }
          ]
        }]
      },
      {
        id: 'security_adv', icon: '🔐', label: 'الأمان المتقدم',
        sections: [
          {
            title: '🔐 المصادقة الثنائية (2FA)',
            steps: [
              { n:'1', title:'التفعيل', desc:'من الإعدادات ← الأمان المتقدم ← 2FA. اختر الموظف واضغط "تفعيل". أعطِ المفتاح للموظف ليدخله في Google/Microsoft Authenticator.' },
              { n:'2', title:'الاستخدام', desc:'بعد كلمة المرور، يُطلب رمز 6 أرقام من التطبيق. الرمز يتجدد كل 30 ثانية.' }
            ],
            tips: [{ type:'warn', icon:'⚠️', text:'احتفظ بمفتاح السر. لا يمكن استعادته إذا ضاع.' }]
          },
          {
            title: '🌐 تقييد IP',
            steps: [
              { n:'1', title:'الإعداد', desc:'من الإعدادات ← الأمان المتقدم ← تقييد IP. أضف العناوين المسموح بها وفعّل المفتاح.' },
              { n:'2', title:'استخدام النجمة', desc:'192.168.1.* يقبل كل أجهزة الشبكة المحلية.' }
            ],
            tips: [{ type:'warn', icon:'⚠️', text:'تأكد من إضافة IP الخاص بك قبل التفعيل.' }]
          }
        ]
      },
      {
        id: 'wa_admin', icon: '💬', label: 'إدارة واتساب',
        sections: [{
          title: '💬 إعدادات وإدارة واتساب',
          steps: [
            { n:'1', title:'ضبط الحد الأقصى للرسائل', desc:'من الإعدادات ← إعدادات واتساب. حدد الحد الأقصى لعدد الرسائل المسموح بها في الساعة لجميع الموظفين. الافتراضي 40 رسالة/ساعة.' },
            { n:'2', title:'مراقبة إرسال الموظفين', desc:'في صفحة واتساب ← تبويب "المستخدمون"، تظهر قائمة جميع الموظفين وعدد الرسائل التي أرسلها كل موظف خلال الساعة الحالية.' },
            { n:'3', title:'حدود الموظف الفردية', desc:'كل موظف يمكنه ضبط حده الشخصي بشرط أن لا يتجاوز سقف المدير. السقف الإجمالي للنظام دائماً هو المرجع.' },
            { n:'4', title:'جدولة الرسائل', desc:'عند إرسال رسائل جماعية، يمكن جدولتها لوقت محدد أو إرسالها فوراً. استخدم التأخير العشوائي لتجنب الحظر.' },
            { n:'5', title:'القوالب والرسائل', desc:'من الإعدادات ← الذكاء الاصطناعي، حدد القالب الافتراضي. يمكن كل موظف إنشاء قوالبه الخاصة من صفحة واتساب ← قوالبي.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'حافظ على تأخير 15-20 ثانية بين الرسائل لتجنب الحظر التلقائي من واتساب.' },
            { type:'warn', icon:'⚠️', text:'الرسائل تُرسَل عبر واتساب ويب — يجب إبقاء المتصفح مفتوحاً أثناء الإرسال الجماعي.' }
          ]
        }]
      },
      {
        id: 'backup_admin', icon: '💾', label: 'النسخ الاحتياطي',
        sections: [{
          title: '💾 حفظ واستعادة البيانات',
          steps: [
            { n:'1', title:'تصدير نسخة احتياطية', desc:'من الإعدادات ← تصدير نسخة احتياطية. يُنشئ ملف JSON يحتوي الإعدادات الكاملة، بيانات المستخدمين، الشعارات المخصصة، والقوالب.' },
            { n:'2', title:'استعادة النسخة الاحتياطية', desc:'من الإعدادات ← استيراد نسخة احتياطية. اختر ملف JSON المُصدَّر مسبقاً. ستُستعاد جميع الإعدادات فوراً.' },
            { n:'3', title:'ما الذي تشمله النسخة الاحتياطية؟', desc:'الإعدادات العامة، بيانات الموظفين وكلمات مرورهم المشفرة، الشعارات المخصصة، قوالب الرسائل، إعدادات واتساب وحدوده.' },
            { n:'4', title:'ما الذي لا تشمله؟', desc:'ملفات البيانات المرفوعة (مخزنة في Supabase). يمكن تصديرها بشكل منفصل من صفحة تصدير النتائج.' }
          ],
          tips: [
            { type:'ok', icon:'✅', text:'صدّر نسخة احتياطية أسبوعياً واحتفظ بها في مكان آمن خارج النظام.' },
            { type:'warn', icon:'⚠️', text:'الاستيراد يستبدل الإعدادات الحالية. تأكد من صحة الملف قبل الاستيراد.' }
          ]
        }]
      },
      {
        id: 'alerts_admin', icon: '🔔', label: 'التنبيهات',
        sections: [{
          title: '🔔 إعداد التنبيهات الأمنية',
          steps: [
            { n:'1', title:'بريد التنبيهات', desc:'من الإعدادات ← بريد تنبيهات الاختراق. أدخل بريدك الإلكتروني لاستلام إشعار فوري عند أي محاولة دخول مشبوهة أو كثرة محاولات فاشلة.' },
            { n:'2', title:'أنواع التنبيهات', desc:'يرسل النظام تنبيهاً عند: 5 محاولات دخول فاشلة متتالية، محاولة دخول بمستخدم مجهول، تسجيل دخول مزدوج لموظف من جهازين.' },
            { n:'3', title:'سجل التدقيق', desc:'سجل التدقيق يوثّق كل الأحداث الأمنية بالتفاصيل: المستخدم، الوقت، نوع الحدث. صدّره Excel لمراجعة دورية.' },
            { n:'4', title:'مراجعة سجل التدقيق', desc:'من القائمة الجانبية ← سجل التدقيق. صفّ الأحداث حسب النوع (تسجيل دخول، أمني، رفع ملف) لمراقبة أنماط محددة.' }
          ],
          tips: [
            { type:'ok', icon:'📧', text:'أضف بريدك الإلكتروني في الإعدادات — التنبيهات الأمنية تصلك فوراً على البريد.' },
            { type:'warn', icon:'⚠️', text:'راجع سجل التدقيق أسبوعياً. الأنماط المتكررة من موظف واحد تستحق المتابعة.' }
          ]
        }]
      }
    ]
  },

  subuser: {
    role: '👤 موظف',
    subtitle: 'دليل استخدام النظام للموظف بخطوات واضحة',
    tabs: [
      {
        id: 'start', icon: '🏁', label: 'البداية',
        sections: [{
          title: '🔐 تسجيل الدخول وأول خطوة',
          steps: [
            { n:'1', title:'تسجيل الدخول', desc:'اختر "الموظف" في شاشة الدخول، أدخل اسم المستخدم وكلمة المرور التي زوّدك بها مدير النظام.' },
            { n:'2', title:'واجهة الموظف', desc:'ستجد في الشريط الجانبي الصفحات التي منحك إياها المدير فقط. أي صفحة غير مرئية تعني عدم امتلاكك صلاحيتها.' },
            { n:'3', title:'الشعار المخصص', desc:'إذا عيّن لك مدير النظام شعاراً خاصاً، ستراه في أعلى الشريط الجانبي بدلاً من شعار الشركة الافتراضي.' },
            { n:'4', title:'تغيير كلمة مرورك', desc:'من أيقونة حسابك في شريط الأدوات ← تغيير كلمة المرور. غيّرها دورياً.' }
          ],
          tips: [
            { type:'warn', icon:'⚠️', text:'النظام يمنع فتح حسابك على جهازين في نفس الوقت.' },
            { type:'ok', icon:'💡', text:'عند عدم النشاط لفترة تُغلق جلستك تلقائياً. احفظ عملك قبل مغادرة الشاشة.' }
          ]
        }]
      },
      {
        id: 'search_emp', icon: '🔍', label: 'البحث الذكي',
        sections: [{
          title: '🔍 البحث برقم الهوية',
          steps: [
            { n:'1', title:'فتح صفحة البحث', desc:'من القائمة الجانبية ← البحث الذكي. اختر الملف الصحيح من القائمة المنسدلة.' },
            { n:'2', title:'إجراء الاستعلام', desc:'أدخل رقم الهوية واضغط Enter أو زر "بحث". تظهر النتيجة فوراً.' },
            { n:'3', title:'قراءة النتيجة', desc:'الاستعلام الناجح (✓) يعرض بيانات العميل. الفاشل يعني أن الرقم غير موجود في الملف المختار.' },
            { n:'4', title:'البحث بالاسم', desc:'يمكن البحث بجزء من الاسم إذا كان الملف يحتوي عمود الاسم.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'كل استعلام تجريه يُسجَّل تلقائياً.' },
            { type:'warn', icon:'⚠️', text:'تأكد من اختيار الملف الصحيح. قد تكون النتيجة "غير موجود" لأنك في ملف خاطئ.' }
          ]
        }]
      },
      {
        id: 'history_emp', icon: '📋', label: 'سجل استعلاماتي',
        sections: [{
          title: '📋 سجل الاستعلامات الناجحة فقط',
          steps: [
            { n:'1', title:'ما يعرضه السجل', desc:'من القائمة الجانبية ← سجل الاستعلامات. يعرض لك الاستعلامات الناجحة (✓) فقط. الاستعلامات الفاشلة لا تظهر هنا.' },
            { n:'2', title:'لماذا الناجحة فقط؟', desc:'السجل مصمم كمرجع للعملاء الذين وجدت بياناتهم. يبقى نظيفاً بدون تشويش من الاستعلامات الفارغة.' },
            { n:'3', title:'البحث والتصفية', desc:'استخدم خانة البحث للعثور على استعلام برقم الهوية أو التاريخ.' },
            { n:'4', title:'عرض تفاصيل استعلام', desc:'انقر "👁 عرض" بجانب أي سجل لرؤية تفاصيل الاستعلام ونص الرد الكامل.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'إذا كنت تبحث عن عميل راجعته سابقاً، ستجده هنا بسرعة.' },
            { type:'warn', icon:'⚠️', text:'مدير النظام يرى سجلاً كاملاً يشمل جميع استعلاماتك الناجحة والفاشلة.' }
          ]
        }]
      },
      {
        id: 'emp_inbox', icon: '📩', label: 'الرسائل الداخلية',
        sections: [{
          title: '📩 استقبال وإرسال الرسائل',
          steps: [
            { n:'1', title:'فتح صندوق الرسائل', desc:'انقر أيقونة 📩 في شريط الأدوات العلوي. الشارة الخضراء تعني وجود رسائل جديدة.' },
            { n:'2', title:'قراءة الرسائل الواردة', desc:'افتح تبويب "📥 الوارد" وانقر على أي رسالة. تُعلَّم كمقروءة تلقائياً.' },
            { n:'3', title:'إرسال لأكثر من شخص', desc:'انقر "✏️ رسالة جديدة". تظهر قائمة بجميع المستخدمين كـ checkboxes — يمكنك وضع ✔ بجانب أكثر من شخص في آنٍ واحد ← أدخل الموضوع والرسالة ← "إرسال".' },
            { n:'4', title:'الرد على رسالة', desc:'عند قراءة رسالة، انقر "↩️ رد". يُحدَّد المرسل تلقائياً في الـ checkboxes.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'يمكن مراسلة المدير وأي موظف آخر. استخدم الإرسال المتعدد للتواصل مع زملاء متعددين دفعةً.' },
            { type:'warn', icon:'⚠️', text:'الرسائل مخزنة في Supabase وتظهر من أي جهاز بعد تسجيل الدخول.' }
          ]
        }]
      },
      {
        id: 'files_emp', icon: '📁', label: 'رفع الملفات',
        sections: [{
          title: '📤 رفع ملفات البيانات',
          steps: [
            { n:'1', title:'الوصول لصفحة الرفع', desc:'من القائمة الجانبية ← رفع الملفات. متاحة فقط إذا منحك المدير الصلاحية.' },
            { n:'2', title:'رفع الملف وانتظار الاكتمال', desc:'اسحب الملف أو انقر لتحديده. انتظر حتى تختفي رسالة التحميل وتظهر رسالة النجاح قبل الانتقال لصفحة أخرى.' },
            { n:'3', title:'تحديد الأعمدة', desc:'حدد عمود رقم الهوية وعمود الاسم من النافذة المنبثقة.' }
          ],
          tips: [
            { type:'warn', icon:'⚠️', text:'لا تغلق الصفحة أثناء رفع الملف. انتظر ظهور رسالة النجاح الخضراء.' },
            { type:'ok', icon:'💡', text:'حمّل نموذج Excel الجاهز من الصفحة لضمان التنسيق الصحيح.' }
          ]
        }]
      },
      {
        id: 'export_emp', icon: '📤', label: 'تصدير النتائج',
        sections: [{
          title: '📤 تصدير نتائج البحث',
          steps: [
            { n:'1', title:'فتح صفحة التصدير', desc:'من القائمة الجانبية ← تصدير النتائج. متاحة فقط إذا منحك المدير الصلاحية.' },
            { n:'2', title:'اختيار النطاق والصيغة', desc:'حدد الفترة الزمنية ثم الصيغة (Excel/CSV/PDF). اضغط "معاينة" للتحقق ثم "تصدير".' }
          ],
          tips: [
            { type:'warn', icon:'⚠️', text:'عملية التصدير تُسجَّل في سجل التدقيق. استخدمها لأغراض العمل فقط.' },
            { type:'ok', icon:'💡', text:'إذا لم تظهر صفحة التصدير، تواصل مع مدير النظام لمنحك الصلاحية.' }
          ]
        }]
      },
      {
        id: 'emp_dashboard', icon: '📊', label: 'إحصائياتي',
        sections: [{
          title: '📊 لوحة إحصائياتي الشخصية',
          steps: [
            { n:'1', title:'الوصول للوحة', desc:'من القائمة الجانبية ← لوحة الإحصائيات. تعرض عدد الاستعلامات الناجحة والملفات المرفوعة.' },
            { n:'2', title:'آخر الأنشطة', desc:'قائمة بآخر الاستعلامات الناجحة مع أرقام الهوية ونتائجها. مفيدة للمراجعة السريعة.' }
          ],
          tips: [{ type:'ok', icon:'💡', text:'استخدم اللوحة لمراجعة أدائك اليومي.' }]
        }]
      },
      {
        id: 'adv_search_emp', icon: '🔍', label: 'بحث متقدم',
        sections: [{
          title: '🔍 البحث بالتعابير النمطية (Regex)',
          steps: [
            { n:'1', title:'التفعيل', desc:'في حقل البحث، ابدأ بـ / (شرطة مائلة) لتفعيل وضع البحث المتقدم.' },
            { n:'2', title:'أمثلة', desc:'/^966/ يبحث عن أرقام تبدأ بـ 966. /صالح|فهد/ يبحث عن صالح أو فهد.' }
          ],
          tips: [{ type:'ok', icon:'💡', text:'البحث العادي بدون / يعمل بكفاءة لمعظم الاستعلامات.' }]
        }]
      },
      {
        id: 'emp_wa_settings', icon: '⚙️', label: 'إعداداتي',
        sections: [{
          title: '⚙️ إعدادات واتساب الشخصية',
          steps: [
            { n:'1', title:'فتح الإعدادات', desc:'في صفحة إرسال الرسائل، اضغط تاب "⚙️ إعداداتي".' },
            { n:'2', title:'حدّك الأقصى', desc:'أدخل الحد الأقصى للرسائل/ساعة. لا يتجاوز سقف المدير.' },
            { n:'3', title:'التأخير والحفظ', desc:'حدد الثواني بين كل رسالتين، ثم اضغط "💾 حفظ إعداداتي".' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'شريط الاستخدام يُظهر نسبة ما أرسلت من حدّك الشخصي.' },
            { type:'warn', icon:'⚠️', text:'لا يمكن تجاوز سقف المدير — تُصحَّح القيمة تلقائياً عند الحفظ.' }
          ]
        }]
      },
      {
        id: 'emp_ai', icon: '🤖', label: 'الذكاء الاصطناعي',
        sections: [{
          title: '🤖 استخدام ردود الذكاء الاصطناعي',
          steps: [
            { n:'1', title:'كيف يعمل الذكاء الاصطناعي؟', desc:'بعد إجراء استعلام ناجح، تظهر زر "🤖 توليد رد ذكي" أسفل نتيجة البحث. ينشئ النظام رداً مخصصاً بناءً على بيانات العميل والقالب المضبوط.' },
            { n:'2', title:'توليد الرد', desc:'انقر "🤖 توليد رد ذكي". انتظر لحظة ريثما يعالج الذكاء الاصطناعي الطلب (5-10 ثوانٍ). يظهر الرد في مربع النص أسفل الزر.' },
            { n:'3', title:'نسخ الرد', desc:'انقر زر "📋 نسخ" لنسخ الرد المولّد إلى الحافظة، ثم الصقه في واتساب أو أي قناة تواصل أخرى.' },
            { n:'4', title:'تخصيص الرد', desc:'يمكنك تعديل الرد المولّد مباشرةً في مربع النص قبل إرساله. الرد ليس نهائياً — راجعه وعدّله حسب الحاجة.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'الرد يُولَّد بناءً على القالب الذي أعده المدير. تواصل معه إذا أردت تحسين نمط الردود.' },
            { type:'warn', icon:'⚠️', text:'إذا ظهرت رسالة "خدمة الذكاء الاصطناعي غير متوفرة"، أبلغ المدير لفحص إعداد مفتاح API.' }
          ]
        }]
      },
      {
        id: 'emp_tips', icon: '💡', label: 'نصائح وأخطاء شائعة',
        sections: [{
          title: '⚠️ أخطاء شائعة وكيف تتجنبها',
          steps: [
            { n:'1', title:'"النتيجة: غير موجود" دائماً', desc:'تحقق من اختيار الملف الصحيح في القائمة المنسدلة. قد يكون العميل موجوداً في ملف آخر. جرّب البحث العالمي إن كان المدير فعّله لك.' },
            { n:'2', title:'"لا يوجد ملفات متاحة"', desc:'تواصل مع المدير لرفع ملفات البيانات أو التحقق من أنه أعطاك صلاحية الوصول.' },
            { n:'3', title:'انتهاء الجلسة تلقائياً', desc:'النظام يُغلق الجلسة بعد فترة خمول. احفظ أي بيانات مهمة قبل مغادرة الشاشة لفترة طويلة.' },
            { n:'4', title:'عدم ظهور رسائل جديدة', desc:'انقر زر تحديث (🔄) في صندوق الرسائل، أو أعد تحميل الصفحة. الرسائل تُزامَن تلقائياً كل دقيقة.' },
            { n:'5', title:'خطأ عند رفع ملف', desc:'تأكد من أن حجم الملف لا يتجاوز 50 ميجابايت وأنه بصيغة xlsx أو csv. لا تُغلق الصفحة أثناء الرفع.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'عند أي مشكلة تقنية، صف الخطأ بالضبط عند إبلاغ المدير — ذلك يسرّع الحل.' },
            { type:'warn', icon:'⚠️', text:'لا تشارك بيانات دخولك مع أحد. أي دخول ببياناتك يُسجَّل باسمك.' }
          ]
        }]
      },
      {
        id: 'emp_my_audit', icon: '🛡️', label: 'سجل نشاطي',
        sections: [{
          title: '🛡️ كيف تستخدم سجل نشاطك الشخصي',
          steps: [
            { n:'1', title:'الوصول للسجل', desc:'من القائمة الجانبية، انقر "🛡️ سجل نشاطي". ستظهر قائمة بجميع أحداث حسابك: دخول، بحث، تصدير، وتغيير كلمة المرور.' },
            { n:'2', title:'تصفية الأحداث', desc:'استخدم القائمة المنسدلة في أعلى السجل لتصفية الأحداث حسب النوع: دخول، بحث، تصدير، وغيرها.' },
            { n:'3', title:'ما يظهر في السجل', desc:'يعرض السجل أحداثك الشخصية فقط: وقت الدخول والخروج، الاستعلامات التي أجريتها، الملفات التي صدّرتها، وتغييرات كلمة المرور.' },
            { n:'4', title:'الخصوصية', desc:'لا يرى أي موظف آخر أحداث سجلك. المدير فقط يملك صلاحية رؤية سجل تدقيق شامل لجميع المستخدمين.' }
          ],
          tips: [
            { type:'ok', icon:'💡', text:'راجع سجلك دورياً للتحقق من أنه لا يوجد نشاط غير معتاد على حسابك.' },
            { type:'warn', icon:'⚠️', text:'إذا لاحظت دخولاً لم تقم به، أبلغ المدير فوراً.' }
          ]
        }]
      }
    ]
  }
};

function openHelpGuide() {
  const helpGuideModal = document.getElementById('helpGuideModal');
  if (!helpGuideModal) return;
  // أثناء التنكّر: المدير يرى دليله الحقيقي وليس دليل الموظف
  // إذا لم يكن هناك مستخدم مسجّل → افتراضياً دليل الموظف
  const realRole = (_adminUser?.role) || appState.user?.role || 'subuser';
  const role = realRole;
  const data = HELP_CONTENT[role] || HELP_CONTENT.subuser;

  // تعيين رأس المودال
  const hmRoleBadge = $('hmRoleBadge');
  const hmSubtitle  = $('hmSubtitle');
  if(hmRoleBadge) hmRoleBadge.textContent = data.role;
  if(hmSubtitle)  hmSubtitle.textContent  = data.subtitle;

  // بناء التبويبات
  const tabsEl = $('hmTabs');
  if(!tabsEl) return;
  tabsEl.innerHTML = data.tabs.map((t, i) =>
    `<button class="hm-tab${i===0?' active':''}" onclick="switchHelpTab('${t.id}','${role}',this)">${t.icon} ${t.label}</button>`
  ).join('');

  // عرض التبويب الأول
  renderHelpTab(data.tabs[0], role);

  // إظهار المودال
  helpGuideModal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeHelpGuide() {
  const helpGuideModal = document.getElementById('helpGuideModal');
  if (!helpGuideModal) return;
  helpGuideModal.classList.remove('show');
  document.body.style.overflow = '';
}

function printHelpGuide() {
  const realRole = (_adminUser?.role) || appState.user?.role || 'subuser';
  const data = HELP_CONTENT[realRole] || HELP_CONTENT.subuser;
  let printHtml = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
    <meta charset="UTF-8">
    <title>دليل الاستخدام — Customer Care System v1.0</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Cairo,sans-serif;direction:rtl;color:#1e293b;background:#fff;padding:24px;}
      h1{font-size:22px;font-weight:800;color:#1e3a8a;margin-bottom:4px;}
      .role-badge{display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;margin-bottom:18px;}
      .tab-section{margin-bottom:30px;break-inside:avoid;}
      .tab-title{font-size:16px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #bfdbfe;padding-bottom:8px;margin-bottom:14px;}
      .sec-title{font-size:13px;font-weight:700;color:#1e3a8a;margin:12px 0 8px;padding:6px 10px;background:#f0f7ff;border-radius:6px;}
      .step{display:flex;gap:10px;margin-bottom:8px;align-items:flex-start;}
      .step-num{min-width:24px;height:24px;background:#3b82f6;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;}
      .step-title{font-size:12px;font-weight:700;color:#1e293b;}
      .step-desc{font-size:11.5px;color:#64748b;line-height:1.6;}
      .tip{margin:6px 0;padding:8px 12px;border-radius:8px;font-size:11.5px;}
      .tip-ok{background:#f0fdf4;border:1px solid #86efac;color:#14532d;}
      .tip-warn{background:#fef2f2;border:1px solid #fca5a5;color:#7f1d1d;}
      .footer{text-align:center;margin-top:30px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;}
      @page{margin:15mm;}
    </style></head><body>
    <h1>📖 دليل الاستخدام</h1>
    <div class="role-badge">${data.role}</div>
    <p style="font-size:12px;color:#64748b;margin-bottom:20px;">${data.subtitle}</p>`;
  data.tabs.forEach(tab => {
    printHtml += `<div class="tab-section"><div class="tab-title">${tab.icon} ${tab.label}</div>`;
    tab.sections.forEach(sec => {
      printHtml += `<div class="sec-title">${sec.title}</div>`;
      sec.steps.forEach(s => {
        printHtml += `<div class="step"><div class="step-num">${s.n}</div><div><div class="step-title">${s.title}</div><div class="step-desc">${s.desc}</div></div></div>`;
      });
      if(sec.tips) sec.tips.forEach(tip => {
        printHtml += `<div class="tip ${tip.type==='warn'?'tip-warn':'tip-ok'}">${tip.icon} ${tip.text}</div>`;
      });
    });
    printHtml += `</div>`;
  });
  printHtml += `<div class="footer">Customer Care System v1.0 &mdash; دليل الاستخدام &mdash; ${new Date().toLocaleDateString('ar-SA')}</div>
    </body></html>`;
  const w = window.open('', '_blank', 'width=850,height=700');
  w.document.write(printHtml);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 600);
}

function switchHelpTab(tabId, role, btn) {
  // Update active tab button
  $('hmTabs').querySelectorAll('.hm-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Find tab data
  const data = HELP_CONTENT[role] || HELP_CONTENT.subuser;
  const tab = data.tabs.find(t => t.id === tabId);
  if (tab) renderHelpTab(tab, role);
}

function renderHelpTab(tab, role) {
  const body = $('hmContent');
  const data = HELP_CONTENT[role] || HELP_CONTENT.subuser;
  const tabIdx = data.tabs.findIndex(t => t.id === tab.id);
  let html = '';

  // ── Progress indicator ──
  html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:18px;flex-wrap:wrap;">
    <span style="font-size:11px;color:var(--s500);font-weight:600;">الصفحة ${tabIdx+1} من ${data.tabs.length}</span>
    <div style="flex:1;height:4px;background:#e2e8f0;border-radius:2px;min-width:60px;">
      <div style="height:100%;background:linear-gradient(90deg,#3b82f6,#1d4ed8);border-radius:2px;width:${Math.round((tabIdx+1)/data.tabs.length*100)}%;transition:width .4s;"></div>
    </div>
    <span style="font-size:11px;color:#3b82f6;font-weight:700;">${tab.icon} ${tab.label}</span>
  </div>`;

  tab.sections.forEach(sec => {
    html += `<div class="hm-section">
      <div class="hm-section-title">
        <span>${sec.title}</span>
        <span style="font-size:10px;color:var(--s400);font-weight:500;margin-right:auto;">${sec.steps.length} خطوة</span>
      </div>`;
    // Steps
    sec.steps.forEach(s => {
      html += `<div class="hm-step">
        <div class="hm-step-num">${s.n}</div>
        <div class="hm-step-content">
          <div class="hm-step-title">${s.title}</div>
          <div class="hm-step-desc">${s.desc}</div>
        </div>
      </div>`;
    });
    // Tips
    if (sec.tips && sec.tips.length) {
      sec.tips.forEach(tip => {
        html += `<div class="hm-tip${tip.type==='warn'?' hm-warn':tip.type==='ok'?' hm-ok':''}">
          <span class="hm-tip-icon">${tip.icon}</span>
          <span class="hm-tip-text">${tip.text}</span>
        </div>`;
      });
    }
    html += '</div>';
  });

  // ── Navigation buttons between tabs ──
  const prevTab = tabIdx > 0 ? data.tabs[tabIdx - 1] : null;
  const nextTab = tabIdx < data.tabs.length - 1 ? data.tabs[tabIdx + 1] : null;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:22px;padding-top:16px;border-top:1px solid #e2e8f0;gap:10px;">`;
  if (prevTab) {
    html += `<button onclick="switchHelpTabById('${prevTab.id}','${role}')"
      style="display:flex;align-items:center;gap:7px;padding:9px 16px;background:var(--b50);border:1.5px solid var(--b200);border-radius:10px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;color:var(--b700);transition:all .2s;"
      onmouseover="this.style.background='var(--b100)'" onmouseout="this.style.background='var(--b50)'">
      &#8594; ${prevTab.icon} ${prevTab.label}
    </button>`;
  } else {
    html += `<span></span>`;
  }
  html += `<span style="font-size:11px;color:var(--s400);">${tabIdx+1} / ${data.tabs.length}</span>`;
  if (nextTab) {
    html += `<button onclick="switchHelpTabById('${nextTab.id}','${role}')"
      style="display:flex;align-items:center;gap:7px;padding:9px 16px;background:linear-gradient(135deg,var(--b600),var(--b700));border:none;border-radius:10px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;color:#fff;transition:all .2s;box-shadow:0 2px 8px rgba(37,99,235,.25);"
      onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
      ${nextTab.icon} ${nextTab.label} &#8592;
    </button>`;
  } else {
    html += `<button onclick="closeHelpGuide()"
      style="display:flex;align-items:center;gap:7px;padding:9px 16px;background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:10px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;color:#fff;transition:all .2s;box-shadow:0 2px 8px rgba(16,185,129,.3);"
      onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
      &#10003; انتهيت من الدليل
    </button>`;
  }
  html += `</div>`;

  body.innerHTML = html;
  body.scrollTop = 0;
}

// helper to switch help tab by id (used in prev/next buttons)
function switchHelpTabById(tabId, role) {
  const data = HELP_CONTENT[role] || HELP_CONTENT.subuser;
  const tabIdx = data.tabs.findIndex(t => t.id === tabId);
  // Update active button in tab bar
  const btns = $('hmTabs').querySelectorAll('.hm-tab');
  btns.forEach((b, i) => { b.classList.toggle('active', i === tabIdx); });
  const tab = data.tabs[tabIdx];
  if (tab) renderHelpTab(tab, role);
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('helpGuideModal')?.classList.contains('show')) { closeHelpGuide(); return; }
    // Close any open standard modal
    const openModal = document.querySelector('.modal-ov.show');
    if (openModal) {
      const id = openModal.id;
      if (id === 'confirmModal') { closeConfirmModal(); return; }
      if (id && id !== 'forceChangePassModal') openModal.classList.remove('show');
    }
  }
});

let _autoRefreshTimer=null;
const AUTO_REFRESH_MS = 30000; // مدة التحديث التلقائي للوحة التحكم (30 ثانية)
function startAutoRefresh(){
  stopAutoRefresh();
  _autoRefreshTimer=setInterval(()=>{
    if(appState.user && document.querySelector('#page-dashboard.active, #page-emp-dashboard.active')){
      updateStats(); updateDashActivity(); sv('auditCount',appState.audit.length);
    }
  }, AUTO_REFRESH_MS);
}
function stopAutoRefresh(){ clearInterval(_autoRefreshTimer); }
function updateStats(){
  const totalRecords=appState.files.reduce((s,f)=>s+f.data.length,0);
  sv('statFiles',appState.files.length);
  sv('statRecords',totalRecords);
  sv('statQueries',appState.history.length);
  sv('statUsers',registeredUsers.length);
  sv('expStatFilesVal',appState.files.length);
  sv('expStatRecordsVal',totalRecords);
  // تحديث الـ Widgets
  if(typeof renderWidgetsDashboard === 'function') renderWidgetsDashboard();
}
function updateFilesTable(){
  const wrap=$('filesTableWrap');
  if(!wrap) return;
  if(!appState.files.length){
    wrap.innerHTML='<div style="text-align:center;padding:32px;color:var(--s400);">📂 لا توجد ملفات</div>';
    renderPagination('filesPagination',0,1,()=>{});
    return;
  }
  const total=appState.files.length, ps=_pg.PAGE_SIZE, totalPages=Math.ceil(total/ps);
  if(_pg.files>totalPages) _pg.files=totalPages;
  const slice=appState.files.slice((_pg.files-1)*ps,_pg.files*ps);
  let h=`<div class="tbl-wrap"><table>
    <thead><tr>
      <th>اسم الملف</th><th>السجلات</th><th>الأعمدة</th>
      <th>تاريخ الرفع</th><th>الإجراءات</th>
    </tr></thead><tbody>`;
  const isAdmin = appState.user?.role === 'admin';
  slice.forEach(f=>{
    const uploaderBadge = isAdmin && f.uploadedBy
      ? `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:6px;padding:2px 8px;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.22);border-radius:20px;font-size:10.5px;font-weight:700;color:#2563eb;vertical-align:middle;">👤 ${escHtml(String(f.uploadedBy))}</span>`
      : '';
    h+=`<tr>
      <td><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><strong>📊 ${esc(f.name)}</strong>${uploaderBadge}</div></td>
      <td><span class="chip chip-b">${f.data.length} سجل</span></td>
      <td class="text-muted text-sm">${f.headers.length} عمود</td>
      <td class="text-muted text-sm">${escHtml(String(f.uploadedAt||''))}</td>
      <td><div class="flex gap-2">
        <button class="btn btn-secondary btn-sm" onclick="previewFileById(${f.id})">👁 معاينة</button>
        <button class="btn btn-outline btn-sm" onclick="exportFileById(${f.id})">📥 تصدير</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFileById(${f.id})">🗑 حذف</button>
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  wrap.innerHTML=h;
  renderPagination('filesPagination',total,_pg.files,p=>{_pg.files=p;updateFilesTable();});
}
function updateDashFiles(){
  const el=$('dashFiles');if(!el)return;
  if(!appState.files.length){el.innerHTML='<div style="text-align:center;padding:26px;color:var(--s400);">📂 لم يتم رفع أي ملفات بعد</div>';return;}
  const isAdmin = appState.user?.role === 'admin';
  el.innerHTML = appState.files.map(f=>{
    const uploaderHtml = isAdmin && f.uploadedBy
      ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 7px;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.2);border-radius:20px;font-size:10px;font-weight:700;color:#2563eb;margin-right:6px;">👤 ${escHtml(String(f.uploadedBy))}</span>`
      : '';
    const dateStr = String(f.uploadedAt||'').replace('T',' ').replace(/\.\d+Z$/,'').replace('Z','');
    return `<div class="activity-item"><div class="activity-dot"></div><div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;display:flex;align-items:center;flex-wrap:wrap;gap:4px;">${escHtml(f.name)}${uploaderHtml}</div><div class="text-sm text-muted">${f.data.length} سجل · ${escHtml(dateStr)}</div></div></div>`;
  }).join('');
}
function updateDashActivity(){const el=$('dashActivity');if(!el)return;el.innerHTML=!appState.history.length?'<div style="text-align:center;padding:26px;color:var(--s400);">🔍 لا توجد استعلامات بعد</div>':appState.history.slice(0,6).map(h=>`<div class="activity-item"><div class="activity-dot" style="background:${h.success?'var(--ok)':'var(--err)'}"></div><div><div style="font-size:12px;">بحث عن: <strong>${escHtml(String(h.id??''))}</strong> — ${escHtml(String(h.file??''))}</div><div class="text-sm text-muted">${escHtml(String(h.time??''))} · ${escHtml(String(h.user??''))}</div></div></div>`).join('');}
function updateEmpDashboard(){const totalRecords=appState.files.reduce((s,f)=>s+f.data.length,0);const myH=appState.history.filter(h=>h.user===(appState.user?.user||appState.user?.name)||h.userName===appState.user?.name);const succ=myH.filter(h=>h.success).length;sv('empStatFiles',appState.files.length);sv('empStatRecords',totalRecords);sv('empStatQueries',myH.length);sv('empStatSuccess',succ);sv('empStatFail',myH.length-succ);sv('empStatLast',myH[0]?.time??'—');const df=$('empDashFiles');if(df)df.innerHTML=!appState.files.length?'<div style="text-align:center;padding:26px;color:var(--s400);">📂 لم يتم رفع أي ملفات بعد</div>':appState.files.map(f=>`<div class="activity-item"><div class="activity-dot"></div><div class="u-flex1"><div style="font-size:12.5px;font-weight:700;">${escHtml(f.name)}</div><div class="text-sm text-muted">${f.data.length} سجل · ${escHtml(String(f.uploadedAt||''))}</div></div><button class="btn btn-danger btn-sm" onclick="deleteFileById(${f.id})" style="margin-right:8px;flex-shrink:0;">🗑</button></div>`).join('');const da=$('empDashActivity');if(da)da.innerHTML=!myH.length?'<div style="text-align:center;padding:20px;color:var(--s400);">لا توجد استعلامات بعد</div>':myH.slice(0,5).map(h=>`<div class="activity-item"><div class="activity-dot" style="background:${h.success?'var(--ok)':'var(--err)'}"></div><div><div style="font-size:12px;">بحث عن: <strong>${escHtml(String(h.id??''))}</strong></div><div class="text-sm text-muted">${escHtml(String(h.time??''))}</div></div></div>`).join('');}
function deleteFileById(id){const f=appState.files.find(f=>f.id===id);if(!f)return;_pendingDeleteId=id;$('deleteFileName').textContent=f.name;$('deleteFileModal').classList.add('show');}
function confirmDeleteFile(){
  const id=_pendingDeleteId;if(id===null)return;
  _pendingDeleteId=null;closeModal('deleteFileModal');
  const idx=appState.files.findIndex(f=>f.id===id);if(idx===-1)return;
  const name=appState.files[idx].name;
  appState.files.splice(idx,1);
  IDB.save(appState.files).catch(()=>{});
  if(isSupabaseReady && isSupabaseReady()) sbDeleteFile(id);
  updateAll();addAudit('delete',`حذف ملف: ${name}`,'');
  toast('🗑 تم حذف "'+name+'"','warn');
}
function previewFileById(id){const f=appState.files.find(f=>f.id===id);if(!f)return;let h='<div style="overflow-x:auto;max-height:380px;"><table style="min-width:100%"><thead><tr>'+f.headers.map(hd=>`<th style="background:var(--b50);padding:7px 12px;font-size:11px;border-bottom:1px solid var(--border);">${escHtml(String(hd))}<\/th>`).join('')+'</tr></thead><tbody>'+f.data.slice(0,20).map(row=>'<tr>'+f.headers.map((_,i)=>`<td style="padding:6px 12px;border-bottom:1px solid rgba(226,232,240,.4);font-size:11.5px;">${escHtml(String(row[i]??''))}<\/td>`).join('')+'</tr>').join('')+'</tbody></table></div>';const m=document.createElement('div');m.className='modal-ov show';m.innerHTML=`<div class="modal" style="max-width:800px;width:96%;"><div class="modal-hd"><div class="modal-title">📊 معاينة: ${escHtml(f.name)}</div><button class="modal-close" onclick="this.closest('.modal-ov').remove()">✕</button></div><p class="text-sm text-muted" style="margin-bottom:10px;">أول 20 سجل من ${f.data.length}</p>${h}</div>`;m.addEventListener('click',e=>{if(e.target===m)m.remove();});document.body.appendChild(m);}
function exportFileById(id){const f=appState.files.find(f=>f.id===id);if(!f)return;const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([f.headers,...f.data.map(r=>f.headers.map((_,i)=>r[i]??''))]),'بيانات');safeExportXLSX(f.name.replace(/\.[^.]+$/,'')+'_export.xlsx',wb);addAudit('export',`تصدير ملف: ${f.name}`,'');}

/* TEMPLATES */
function downloadTemplate(){const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([['رقم الهوية','الرسالة 1','الاسم','رسالة 2','رسالة 3'],['1000000001','عميل مميز — رصيدك 5,000 ريال','محمد عبدالله','يرجى مراجعة الفرع','خدمة العملاء 24/7'],['1000000002','تم قبول طلبك رقم #1042','سارة أحمد','المستندات: بطاقة الهوية','']]);ws['!cols']=[{wch:15},{wch:48},{wch:18},{wch:42},{wch:35}];XLSX.utils.book_append_sheet(wb,ws,'بيانات');safeExportXLSX('نموذج.xlsx',wb);}
function downloadTemplateCsv(){safeExportText('نموذج.csv','رقم الهوية,الرسالة 1,الاسم,رسالة 2,رسالة 3\n1000000001,عميل مميز,محمد عبدالله,,\n1000000002,تم قبول طلبك,سارة أحمد,,','text/csv');}

/* SEARCH */
function updateSearchFileSelect(){
  const sel=$('searchFileSelect');if(!sel)return;
  sel.innerHTML='<option value="">— اختر ملف —</option>';
  if(appState.user && appState.user.role === 'admin') {
    sel.innerHTML += '<option value="all">🌐 بحث في جميع الملفات (للمدير)</option>';
  }
  appState.files.forEach((f,i)=>sel.innerHTML+=`<option value="${i}">${esc(f.name)} (${f.data.length} سجل)</option>`);
}
function buildDataStr(pd){const priority=['الرسالة 1','رسالة 1','الرسالة','رسالة','رسالة 2','رسالة إضافية','رسالة 3','رسالة تكميلية'];const ordered=[...priority.filter(k=>pd[k]),...Object.keys(pd).filter(k=>!priority.includes(k))];return ordered.filter(k=>pd[k]).map(k=>`${k}: ${pd[k]}`).join('\n');}
function buildTagsHtml(pd){const k5=['الرسالة 1','رسالة 1','الرسالة','رسالة'],k2=['رسالة 2','رسالة إضافية','إضافية'],k3=['رسالة 3','رسالة تكميلية'];const m1=k5.map(k=>pd[k]).find(v=>v),m2=k2.map(k=>pd[k]).find(v=>v),m3=k3.map(k=>pd[k]).find(v=>v);const others=Object.entries(pd).filter(([k])=>[...k5,...k2,...k3].indexOf(k)===-1);let h='';if(m1)h+=`<div class="msg-block"><span class="msg-lbl">💬 الرسالة 1</span><div class="msg-text">${hlText(m1,_searchQuery||'')}  </div></div>`;if(m2)h+=`<div class="msg-block extra"><span class="msg-lbl">📎 رسالة 2</span><div class="msg-text">${hlText(m2,_searchQuery||'')}  </div></div>`;if(m3)h+=`<div class="msg-block extra2"><span class="msg-lbl">📌 رسالة 3</span><div class="msg-text">${escHtml(m3)}</div></div>`;if(others.length)h+='<div class="data-chips">'+others.map(([k,v])=>v?`<div class="dchip"><strong>${escHtml(k)}:</strong> ${escHtml(String(v))}</div>`:'').join('')+'</div>';return h||'<div class="text-sm text-muted" style="padding:10px;">لا توجد بيانات إضافية</div>';}
/*       + pagination  */
let _searchResults=[], _searchFileIdx=-1, _searchQuery='';
async function handleSearch(page){
  const isNewSearch = page===undefined;
  if(isNewSearch){
    const query=$('searchInput').value.trim();
    _savedSearch.query=query;_savedSearch.nameQ=document.getElementById('searchInputName')?.value||'';_savedSearch.phoneQ=document.getElementById('searchInputPhone')?.value||'';_savedSearch.fileIdx=$('searchFileSelect')?.value||'';
    const nameQ=(document.getElementById('searchInputName')?.value||'').trim().toLowerCase();
    const phoneQ=(document.getElementById('searchInputPhone')?.value||'').trim();
    const fileIdx=parseInt($('searchFileSelect').value);
    if(!query&&!nameQ&&!phoneQ){toast('⚠️ أدخل قيمة بحث','warn');return;}
    if(isNaN(fileIdx)||$('searchFileSelect').value===''){toast('⚠️ اختر ملفاً','warn');return;}
    // إذا كانت بيانات الملف فارغة — أعد التحميل من Supabase
    if(appState.files[fileIdx] && !appState.files[fileIdx].data?.length && isSupabaseReady && isSupabaseReady()){
      toast('⏳ جارٍ تحميل بيانات الملف...','warn');
      await sbLoadFiles();
    }
    const f=appState.files[fileIdx];
    let rows=[];
    // بحث بالهوية — O(1) باستخدام الفهرس
    if(query){
      if(f.idIndex){
        const idx=f.idIndex.get(query.trim());
        if(idx!==undefined) rows=[f.data[idx]];
      } else {
        rows=f.data.filter(r=>String(r[f.idCol]).trim()===query);
      }
    }
    // بحث جزئي بالاسم
    // بحث بالاسم — فهرس مع fallback
  if(!rows.length&&nameQ&&f.nameCol>=0){
    const normName=normalizeAr(nameQ);
    if(f.nameIndex){
      const matched=[];
      f.nameIndex.forEach((idxArr,k)=>{ if(k.includes(normName)) matched.push(...idxArr); });
      rows=matched.map(i=>f.data[i]);
    } else {
      rows=f.data.filter(r=>normalizeAr(r[f.nameCol]).includes(normName));
    }
  }
    // بحث بالجوال — يبحث في كل الأعمدة مع تطبيع الأرقام
    if(!rows.length&&phoneQ){
      const pNorm=phoneQ.replace(/[\s+\-]/g,'');
      // ابحث في عمود الجوال المكتشف أولاً، ثم في كل الأعمدة
      if(f.phoneColIdx!==undefined&&f.phoneColIdx>=0){
        rows=f.data.filter(r=>String(r[f.phoneColIdx]||'').replace(/[\s+\-]/g,'').includes(pNorm));
      }
      if(!rows.length){
        rows=f.data.filter(r=>f.extraCols.some(i=>String(r[i]||'').replace(/[\s+\-]/g,'').includes(pNorm)));
      }
    }
    // بحث عام
    const normQ=normalizeAr(query||nameQ||phoneQ);
  if(!rows.length) rows=f.data.filter(r=>f.extraCols.some(i=>normalizeAr(r[i]).includes(normQ)));
    if(!rows.length){
      $('resResult').style.display='none';const _cb2=$('searchCountBanner');if(_cb2)_cb2.style.display='none';
      const pg=$('searchResultsPagination'); if(pg) pg.innerHTML='';
      // اقتراح أقرب نتيجة
      let suggestion='';
      if(query&&f.idIndex){
        const partial=[...f.idIndex.keys()].find(k=>k.startsWith(query.substring(0,Math.max(4,query.length-2))));
        if(partial) suggestion=` — هل تقصد: ${partial}؟`;
      } else if(nameQ&&f.nameIndex){
        const normQ=normalizeAr(nameQ);
        const closest=[...f.nameIndex.keys()].find(k=>k.includes(normQ.substring(0,Math.max(2,normQ.length-1))));
        if(closest) suggestion=` — هل تقصد: ${closest}؟`;
      }
      toast(`❌ لم يتم العثور على نتائج${suggestion}`,'err');
      addHistory(query||nameQ||phoneQ,fileIdx,false,'—');
      addAudit('search',`بحث فاشل: ${query||nameQ}`,f.name);
      return;
    }
    _searchResults=rows; _searchFileIdx=fileIdx; _searchQuery=query||nameQ||phoneQ;
    const cb=$('searchCountBanner');if(cb){cb.style.display='flex';sv('searchCountText',`🔍 وُجد ${rows.length} سجل`);sv('searchCountFile',`في: ${f.name}`);}
    _pg.search=1;
    if(rows.length>1) toast(`🔍 تم العثور على ${rows.length} نتيجة`,'info');
  }
  // pagination
  const ps=_pg.PAGE_SIZE, total=_searchResults.length;
  const curPage=page||_pg.search;
  _pg.search=curPage;
  const start=(curPage-1)*ps, row=_searchResults[start];
  const f=appState.files[_searchFileIdx];
  const name=f.nameCol>=0?(row[f.nameCol]??'العميل'):'العميل';
  const personData={};f.extraCols.forEach(i=>{if(f.headers[i])personData[f.headers[i]]=row[i]??'';});
  const subtitle = total>1 ? ` <span style="font-size:11px;color:var(--s400);font-weight:400;">(${start+1} من ${total})</span>` : '';
  sv('resName', name); $('resName').insertAdjacentHTML('beforeend', subtitle);
  sv('resId',`رقم الهوية: ${row[f.idCol]??_searchQuery}`);
  sv('resText','⏳ جارٍ توليد الرد...');$('resTags').innerHTML='';
  $('resResult').style.display='block';$('resResult').scrollIntoView({behavior:'smooth'});
  $('resTags').innerHTML=buildTagsHtml(personData);
  // pagination controls
  renderPagination('searchResultsPagination', total, curPage, p=>handleSearch(p));
  const btn=$('searchBtn');btn.disabled=true;sv('searchBtnTxt','جاري...');
  const apiKey=($('apiKey')&&$('apiKey').value.trim())||appState.settings.apiKey;
  const resp=await callClaude(apiKey,f.prompt,name,row[f.idCol]??_searchQuery,buildDataStr(personData));
  $('resText').innerHTML=hlText(resp,_searchQuery||'');
  if(isNewSearch) addHistory(_searchQuery,_searchFileIdx,true,resp);
  addAudit('search',`بحث ناجح: ${_searchQuery}`,`${name} — ${f.name}`);
  if(appState.user?.role!=='admin') addNotif('🔍','استعلام جديد',`${appState.user?.name}: ${_searchQuery}`);
  btn.disabled=false;
  const rem=apiRateLimitRemaining();
  sv('searchBtnTxt', rem<=3 ? `🔍 بحث (${rem} متبقي)` : '🔍 بحث');
}

/* ── CC System: All Missing CSS + WA Scroll JS (injected once) ── */
(function(){
  if(document.getElementById('cc-ui-style')) return;
  const s = document.createElement('style');
  s.id = 'cc-ui-style';
  s.textContent = `

    /* ════ SB-HELP BUTTON ════ */
    .sb-help-btn {
      display:flex;align-items:center;gap:9px;width:100%;
      padding:10px 14px;margin-bottom:10px;
      background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(29,78,216,.18));
      border:1.5px solid rgba(59,130,246,.3);border-radius:12px;
      cursor:pointer;font-family:Cairo,sans-serif;font-size:13px;
      font-weight:700;color:var(--b600,#2563eb);transition:all .2s;
    }
    .sb-help-btn:hover {
      background:linear-gradient(135deg,rgba(59,130,246,.22),rgba(29,78,216,.3));
      border-color:rgba(59,130,246,.55);transform:translateY(-1px);
      box-shadow:0 4px 14px rgba(59,130,246,.2);
    }
    .sb-help-icon {
      width:28px;height:28px;background:rgba(59,130,246,.15);
      border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .sb-help-badge {
      margin-inline-start:auto;font-size:9.5px;font-weight:800;
      background:linear-gradient(135deg,#3b82f6,#1d4ed8);
      color:#fff;padding:2px 8px;border-radius:20px;
    }

    /* ════ HELP GUIDE MODAL ════ */
    #helpGuideModal { display:none;position:fixed;inset:0;z-index:9990;
      background:rgba(15,23,42,.55);backdrop-filter:blur(3px);
      align-items:center;justify-content:center;padding:16px; }
    #helpGuideModal.show { display:flex; }

    .hm-tab {
      padding:7px 14px;border:none;border-radius:8px 8px 0 0;
      font-family:Cairo,sans-serif;font-size:12.5px;font-weight:700;
      cursor:pointer;background:transparent;color:var(--s500,#64748b);
      transition:all .18s;border-bottom:2px solid transparent;
    }
    .hm-tab:hover { background:var(--b50,#eff6ff);color:var(--b600,#2563eb); }
    .hm-tab.active { color:var(--b600,#2563eb);border-bottom-color:var(--b600,#2563eb);background:var(--b50,#eff6ff); }
    .hm-section {
      background:var(--b50,#f8faff);border:1px solid var(--border,#e2e8f0);
      border-radius:12px;padding:14px 16px;margin-bottom:14px;
    }
    .hm-section-title {
      display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;
      color:var(--s800,#1e293b);margin-bottom:12px;padding-bottom:8px;
      border-bottom:1px solid var(--border,#e2e8f0);
    }
    .hm-step { display:flex;align-items:flex-start;gap:10px;margin-bottom:10px; }
    .hm-step-num {
      width:26px;height:26px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
      color:#fff;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;margin-top:1px;
    }
    .hm-step-content { flex:1; }
    .hm-step-title { font-size:12.5px;font-weight:700;color:var(--s800,#1e293b);margin-bottom:2px; }
    .hm-step-desc  { font-size:11.5px;color:var(--s500,#64748b);line-height:1.6; }
    .hm-tip {
      display:flex;align-items:flex-start;gap:8px;padding:9px 12px;
      border-radius:9px;margin-top:8px;font-size:12px;
      background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.18);
    }
    .hm-ok   { background:rgba(16,185,129,.06);border-color:rgba(16,185,129,.2); }
    .hm-warn { background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.2); }
    .hm-tip-icon { font-size:15px;flex-shrink:0;margin-top:1px; }
    .hm-tip-text { color:var(--s700,#334155);line-height:1.6; }
    #hmBody::-webkit-scrollbar { width:6px; }
    #hmBody::-webkit-scrollbar-thumb { background:#cbd5e1;border-radius:4px; }
    #hmBody::-webkit-scrollbar-thumb:hover { background:#94a3b8; }

    /* ════ INBOX MODAL ════ */
    .inbox-ov { display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);
      backdrop-filter:blur(3px);z-index:9980;align-items:center;justify-content:center;padding:16px; }
    .inbox-ov.show { display:flex; }
    .inbox-mod { background:var(--card,#fff);border-radius:18px;width:min(600px,96vw);
      max-height:90vh;display:flex;flex-direction:column;
      box-shadow:0 24px 64px rgba(0,0,0,.22);overflow:hidden; }
    .inbox-hd { display:flex;align-items:center;gap:10px;padding:14px 18px 12px;
      border-bottom:1px solid var(--border,#e2e8f0);flex-shrink:0;background:var(--card,#fff); }
    .inbox-tabs-bar { display:flex;gap:6px;padding:10px 14px 0;
      border-bottom:1px solid var(--border,#e2e8f0);flex-shrink:0;
      background:var(--card,#fff);flex-wrap:wrap; }
    .inbox-tab-btn { padding:7px 14px;border:none;border-radius:8px 8px 0 0;
      font-family:Cairo,sans-serif;font-size:12.5px;font-weight:700;cursor:pointer;
      background:transparent;color:var(--s500,#64748b);transition:all .18s;
      border-bottom:2px solid transparent; }
    .inbox-tab-btn:hover { background:var(--b50,#eff6ff);color:var(--b600,#2563eb); }
    .inbox-tab-btn.active { color:var(--b600,#2563eb);border-bottom-color:var(--b600,#2563eb);background:var(--b50,#eff6ff); }
    .inbox-scrl { flex:1;overflow-y:auto;padding:10px 14px;min-height:60px; }
    .inbox-scrl::-webkit-scrollbar { width:6px; }
    .inbox-scrl::-webkit-scrollbar-thumb { background:#cbd5e1;border-radius:4px; }
    .inbox-compose-bar { flex-shrink:0;border-top:1px solid var(--border,#e2e8f0);background:var(--card,#fff); }
    .inbox-compose-inner { display:flex;flex-direction:column;gap:10px;padding:14px 16px;
      overflow-y:auto;max-height:400px; }
    .inbox-compose-inner::-webkit-scrollbar { width:6px; }
    .inbox-compose-inner::-webkit-scrollbar-thumb { background:#cbd5e1;border-radius:4px; }
    @media(max-width:640px){ .inbox-compose-inner{max-height:none;overflow-y:visible;} .inbox-mod{max-height:96vh;border-radius:14px;} }
    .imsg { display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
      border-radius:10px;cursor:pointer;border:1px solid var(--border,#e2e8f0);
      margin-bottom:7px;transition:background .15s;background:var(--card,#fff); }
    .imsg:hover { background:var(--b50,#eff6ff); }
    .imsg.unread { background:rgba(59,130,246,.06);border-color:rgba(59,130,246,.22); }
    .imsg.sent-m { background:rgba(16,185,129,.04);border-color:rgba(16,185,129,.18); }

    /* ════ AUDIT LOG ════ */
    .audit-item { display:flex;align-items:center;gap:12px;padding:10px 14px;
      border-radius:10px;border:1px solid var(--border,#e2e8f0);
      margin-bottom:7px;background:var(--card,#fff);transition:background .15s; }
    .audit-item:hover { background:var(--b50,#eff6ff); }
    .audit-security-row { border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.04); }
    .audit-icon { width:36px;height:36px;border-radius:10px;display:flex;
      align-items:center;justify-content:center;font-size:17px;flex-shrink:0; }
    .audit-info { flex:1;min-width:0; }
    .audit-action { font-size:13px;font-weight:700;color:var(--s800,#1e293b);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .audit-meta   { font-size:11px;color:var(--s400,#94a3b8);margin-top:2px;line-height:1.5; }
    .audit-badge  { font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0; }
    .ab-login    { background:rgba(16,185,129,.12);color:#059669; }
    .ab-logout   { background:rgba(100,116,139,.1);color:#475569; }
    .ab-upload   { background:rgba(59,130,246,.1);color:#2563eb; }
    .ab-delete   { background:rgba(239,68,68,.1);color:#dc2626; }
    .ab-search   { background:rgba(245,158,11,.1);color:#d97706; }
    .ab-export   { background:rgba(124,58,237,.1);color:#7c3aed; }
    .ab-user     { background:rgba(16,185,129,.1);color:#059669; }
    .ab-pass     { background:rgba(239,68,68,.1);color:#dc2626; }
    .ab-warn     { background:rgba(239,68,68,.18);color:#dc2626; }
    .ab-security { background:rgba(239,68,68,.18);color:#dc2626; }
    .ab-inbox    { background:rgba(59,130,246,.1);color:#2563eb; }

    /* ════ WA TABLE SCROLL BAR ════ */
    .wa-scroll-bar { display:flex;align-items:center;gap:8px;padding:6px 4px 4px;direction:ltr; }
    .wa-scroll-btn { flex-shrink:0;width:30px;height:26px;
      background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.3);
      border-radius:7px;color:#25D366;font-size:15px;font-weight:700;
      cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s; }
    .wa-scroll-btn:hover { background:rgba(37,211,102,.25);border-color:rgba(37,211,102,.6);transform:scale(1.08); }
    .wa-scroll-track { flex:1;height:8px;background:rgba(255,255,255,.08);
      border-radius:4px;position:relative;cursor:pointer;overflow:hidden; }
    .wa-scroll-thumb { position:absolute;top:0;left:0;height:100%;
      background:rgba(37,211,102,.5);border-radius:4px;min-width:30px;cursor:grab; }
    .wa-scroll-thumb:hover { background:rgba(37,211,102,.75); }
    .wa-scroll-thumb:active { cursor:grabbing;background:#25D366; }
    .table-outer { overflow:hidden;border-radius:0 0 10px 10px; }
    .table-wrap  { overflow-x:auto;overflow-y:visible;scrollbar-width:none; }
    .table-wrap::-webkit-scrollbar { display:none; }

    /* ════ WA ROW HOVER CONTRAST ════ */
    #wa-tableBody tr { transition:background .15s; }
    #wa-tableBody tr:hover td { background:rgba(37,211,102,.13) !important; }
    #wa-tableBody tr:hover .cell-input {
      background:rgba(37,211,102,.10) !important;
      color:#e2ffe8 !important;
      border-color:rgba(37,211,102,.4) !important;
    }
    #wa-tableBody tr:hover .row-num { background:rgba(37,211,102,.25) !important;color:#25D366 !important; }
    #wa-tableBody tr.row-selected td { background:rgba(37,211,102,.18) !important; }
    #wa-tableBody tr.row-selected:hover td { background:rgba(37,211,102,.26) !important; }
  `;
  document.head.appendChild(s);
})();

/* ── WA Table Horizontal Scroll Logic ── */
function waScrollTable(dir){
  const w=document.getElementById('waTableWrap'); if(!w) return;
  w.scrollLeft += dir==='left' ? -220 : 220;
  _waThumb();
}
function _waThumb(){
  const w=document.getElementById('waTableWrap');
  const track=document.getElementById('waScrollTrack');
  const thumb=document.getElementById('waScrollThumb');
  const bar=document.getElementById('waScrollBar');
  if(!w||!track||!thumb) return;
  const sw=w.scrollWidth, cw=w.clientWidth;
  if(sw<=cw+4){ if(bar) bar.style.visibility='hidden'; return; }
  if(bar) bar.style.visibility='visible';
  const tw=Math.max(30,Math.floor(track.clientWidth*(cw/sw)));
  const tl=Math.floor((w.scrollLeft/(sw-cw))*(track.clientWidth-tw));
  thumb.style.width=tw+'px'; thumb.style.left=tl+'px';
}
(function(){
  let drag=false,sx=0,ss=0;
  document.addEventListener('mousedown',e=>{
    if(!document.getElementById('waScrollThumb')?.contains(e.target)) return;
    drag=true; sx=e.clientX;
    ss=document.getElementById('waTableWrap')?.scrollLeft||0; e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!drag) return;
    const w=document.getElementById('waTableWrap');
    const track=document.getElementById('waScrollTrack');
    const thumb=document.getElementById('waScrollThumb');
    if(!w||!track||!thumb) return;
    w.scrollLeft=ss+(e.clientX-sx)*((w.scrollWidth-w.clientWidth)/(track.clientWidth-thumb.offsetWidth));
    _waThumb();
  });
  document.addEventListener('mouseup',()=>{drag=false;});
  document.addEventListener('DOMContentLoaded',()=>{
    const w=document.getElementById('waTableWrap');
    if(w){ w.addEventListener('scroll',_waThumb); new ResizeObserver(_waThumb).observe(w); }
  });
})();

/* 
        Internal Messaging v1
 */
const LS_INBOX = 'cc_inbox';
let _inboxTab = 'inbox';

function _getInbox(){
  if(isSupabaseReady && isSupabaseReady() && window._sbMessages) return window._sbMessages;
  return lsLoad(LS_INBOX,[]);
}
function _saveInbox(arr){
  lsSave(LS_INBOX,arr);
  if(isSupabaseReady && isSupabaseReady()) window._sbMessages = arr;
}

/*     */
function openInbox(){
  const me=appState.user; if(!me) return;
  $('inboxUserLbl').textContent = me.name + (me.role==='admin'?' — مدير النظام':' — موظف');
  // تعبئة قائمة المستلمين (checkboxes للإرسال المتعدد)
  const toCheckboxes=$('inboxToCheckboxes');
  const toSel=$('inboxToSel');
  const targets=registeredUsers.filter(u=>u.id!==me.id&&u.status!=='inactive');
  if(toCheckboxes){
    toCheckboxes.innerHTML=targets.length?targets.map(u=>
      `<label style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--b50);cursor:pointer;font-size:12px;font-family:Cairo,sans-serif;color:var(--s700);">` +
      `<input type="checkbox" value="${Number(u.id)}" style="accent-color:var(--b500);width:14px;height:14px;"> ` +
      `<span>${u.role==='admin'?'👑':'👤'} ${escHtml(u.name)}</span></label>`).join(''):
      '<span style="font-size:12px;color:var(--s400);">لا يوجد مستخدمون آخرون</span>';
  }
  if(toSel){
    toSel.innerHTML='<option value="">—</option>'+targets.map(u=>`<option value="${Number(u.id)}">${escHtml(u.name)}</option>`).join('');
  }
  setInboxTab('inbox',$('iTabInbox'));
  $('inboxModal').classList.add('show');
  document.body.style.overflow='hidden';
}
function closeInbox(){
  $('inboxModal').classList.remove('show');
  document.body.style.overflow='';
}

/*      */
function setInboxTab(tab,btn){
  _inboxTab=tab;
  document.querySelectorAll('.inbox-tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const compose=$('inboxComposeBar');
  if(compose) compose.style.display=tab==='compose'?'block':'none';
  renderInboxList();
}

/*     */
function renderInboxList(){
  const me=appState.user; if(!me) return;
  const scrl=$('inboxScrl'); if(!scrl) return;
  const msgs=_getInbox();
  if(_inboxTab==='compose'){
    scrl.innerHTML='<div style="padding:20px 0;text-align:center;color:var(--s400);font-size:13px;">أكمل إرسال رسالتك أدناه 👇</div>';
    return;
  }
  const _meId = Number(me.id);
  let list = _inboxTab==='inbox'
    ? msgs.filter(m=>Number(m.toId)===_meId).sort((a,b)=>b.id-a.id)
    : msgs.filter(m=>Number(m.fromId)===_meId).sort((a,b)=>b.id-a.id);
  // تعيين كمقروء
  if(_inboxTab==='inbox'){
    let changed=false;
    list.forEach(m=>{if(!m.read){m.read=true;changed=true;}});
    if(changed){_saveInbox(msgs);updateInboxBadge();}
  }
  if(!list.length){
    scrl.innerHTML=`<div style="text-align:center;padding:44px 20px;color:var(--s400);">
      <div style="font-size:38px;margin-bottom:10px;">${_inboxTab==='inbox'?'📭':'📤'}</div>
      <div>${_inboxTab==='inbox'?'لا توجد رسائل واردة بعد':'لم ترسل أي رسائل بعد'}</div></div>`;
    return;
  }
  scrl.innerHTML=list.map(m=>`
    <div class="imsg ${_inboxTab==='inbox'&&!m.read?'unread':_inboxTab==='sent'?'sent-m':''}" onclick="viewInboxMsg(${m.id})">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-weight:700;font-size:13px;color:var(--s800);">${escHtml(m.subject)}</span>
        <span style="font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:var(--b50);color:var(--b600);">${_inboxTab==='inbox'?escHtml(m.fromName):escHtml(m.toName)}</span>
      </div>
      <div class="imsg-prev">${escHtml(m.body)}</div>
      <div class="imsg-to" title="${m.time}">⏰ ${m.timeAgo||m.time}</div>
    </div>`).join('');
}

/*      */
function viewInboxMsg(id){
  const msgs=_getInbox(), m=msgs.find(x=>x.id===id); if(!m) return;
  const me=appState.user;
  const isIncoming=Number(m.toId)===Number(me.id);
  if(!m.read&&isIncoming){m.read=true;_saveInbox(msgs);updateInboxBadge();}
  const scrl=$('inboxScrl'); if(!scrl) return;
  scrl.innerHTML=`
    <div>
      <button onclick="renderInboxList()" style="background:var(--b50);border:1px solid var(--b200);border-radius:7px;padding:5px 14px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;color:var(--b600);margin-bottom:14px;">← رجوع للقائمة</button>
      <div style="background:var(--b50);border:1px solid var(--border);border-radius:12px;padding:15px 18px;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:800;color:var(--s800);margin-bottom:10px;">${escHtml(m.subject)}</div>
        <div style="font-size:12px;color:var(--s500);line-height:2.1;">
          <div>📤 من: <b>${escHtml(m.fromName)}</b></div>
          <div>📥 إلى: <b>${escHtml(m.toName)}</b></div>
          <div>⏰ الوقت: ${m.time}</div>
        </div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;font-size:13px;line-height:1.9;color:var(--s700);white-space:pre-wrap;">${escHtml(m.body)}</div>
      ${isIncoming?`<button onclick="_replyTo(${m.id})" style="margin-top:12px;background:var(--b500);color:#fff;border:none;border-radius:8px;padding:8px 20px;font-family:Cairo,sans-serif;font-size:12.5px;font-weight:700;cursor:pointer;transition:opacity .18s" onmouseover="this.style.opacity='.82'" onmouseout="this.style.opacity='1'">↩️ رد</button>`:''}
    </div>`;
}

/*    */
function _replyTo(id){
  const m=_getInbox().find(x=>x.id===id); if(!m) return;
  setInboxTab('compose',$('iTabCompose'));
  const subjInp=$('inboxSubj');
  // تحديد المرسل في checkboxes
  document.querySelectorAll('#inboxToCheckboxes input[type="checkbox"]').forEach(cb=>cb.checked=false);
  const cb=document.querySelector(`#inboxToCheckboxes input[value="${Number(m.fromId)}"]`);
  if(cb) cb.checked=true;
  if(subjInp) subjInp.value='رد: '+m.subject;
  $('inboxBody')?.focus();
}

/*     */
function doSendInboxMsg(){
  const subjInp=$('inboxSubj'), bodyInp=$('inboxBody');
  if(!subjInp||!bodyInp) return;
  const subj=subjInp.value.trim(), body=bodyInp.value.trim();
  // جمع المستلمين المحددين من الـ checkboxes
  const checkedBoxes=document.querySelectorAll('#inboxToCheckboxes input[type="checkbox"]:checked');
  const toIds=[...checkedBoxes].map(cb=>Number(cb.value)).filter(id=>id>0);
  if(!toIds.length){toast('⚠️ اختر مستلماً واحداً على الأقل','warn');return;}
  if(!subj){toast('⚠️ أدخل الموضوع','warn');return;}
  if(!body){toast('⚠️ اكتب نص الرسالة','warn');return;}
  const me=appState.user;
  const msgs=_getInbox();
  let sentNames=[];
  toIds.forEach((toId,idx)=>{
    const toUser=registeredUsers.find(u=>u.id===toId);
    if(!toUser) return;
    sentNames.push(toUser.name);
    const newMsg={id:Date.now()+idx,fromId:me.id,fromName:me.name,fromRole:me.role,
      toId,toName:toUser.name,subject:subj,body,
      time:new Date().toLocaleString('ar-SA'),read:false};
    if(isSupabaseReady && isSupabaseReady()){
      sbSendMessage(newMsg).then(()=>{ if(idx===toIds.length-1) sbLoadMessages(); });
    } else {
      msgs.push(newMsg);
    }
  });
  if(!(isSupabaseReady && isSupabaseReady())) _saveInbox(msgs);
  subjInp.value=''; bodyInp.value='';
  document.querySelectorAll('#inboxToCheckboxes input[type="checkbox"]').forEach(cb=>cb.checked=false);
  updateInboxBadge();
  setInboxTab('sent',$('iTabSent'));
  toast(`✅ تم الإرسال إلى ${sentNames.join('، ')}`,'ok');
  addAudit('inbox','إرسال رسالة داخلية: '+subj,me.name+' → '+sentNames.join('، '));
}

/*      */
function updateInboxBadge(){
  const me=appState.user; if(!me) return;
  const _myId=Number(me.id);
  const unread=_getInbox().filter(m=>Number(m.toId)===_myId&&!m.read).length;
  const badge=$('inboxBadge');
  if(badge){badge.textContent=unread>9?'9+':String(unread);badge.style.display=unread>0?'block':'none';}
  // شارة داخل النافذة
  const inner=$('inboxUnread');
  if(inner){inner.textContent=unread>9?'9+':String(unread);inner.style.display=unread>0?'inline':'none';}
}

// تحديث الشارة كل دقيقة
setInterval(()=>{if(appState.user)updateInboxBadge();},60000);

/*  API RATE LIMITER  10 requests/min per user  */
const _apiRL = { calls:[], MAX:10, WINDOW:60000 };
function apiRateLimitCheck(){
  const now = Date.now();
  _apiRL.calls = _apiRL.calls.filter(t => now - t < _apiRL.WINDOW);
  if(_apiRL.calls.length >= _apiRL.MAX) return false;
  _apiRL.calls.push(now);
  return true;
}
function apiRateLimitRemaining(){
  const now = Date.now();
  _apiRL.calls = _apiRL.calls.filter(t => now - t < _apiRL.WINDOW);
  return _apiRL.MAX - _apiRL.calls.length;
}

async function callClaude(apiKey,template,name,id,dataStr){
  if(!apiRateLimitCheck()){
    const wait = Math.ceil((_apiRL.WINDOW - (Date.now() - _apiRL.calls[0])) / 1000);
    return `⏱️ تجاوزت الحد المسموح (${_apiRL.MAX} طلبات/دقيقة). انتظر ${wait} ثانية.`;
  }
  // ✅ المفتاح محفوظ على السيرفر داخل Edge Function — لا يُكشف للمتصفح
  try{
    const edgeUrl = (window.SUPABASE_URL||'').replace(/\/$/, '') + '/functions/v1/claude-proxy';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds max
    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.SUPABASE_KEY || '',
        'Authorization': 'Bearer ' + (window.SUPABASE_KEY || '')
      },
      body: JSON.stringify({ template, name, id, dataStr }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if(!res.ok){
      const errData = await res.json().catch(()=>({}));
      return '❌ خطأ من الخادم الذكي: ' + (errData?.error || res.statusText);
    }
    const data = await res.json();
    if(data?.text) return data.text;
    return '⚠️ لم يُستلم رد.';
  }catch(e){
    if(e.name === 'AbortError') return '⏱️ انتهى وقت الاتصال بالذكاء الاصطناعي (حاول مجدداً)';
    return '❌ خطأ: ' + e.message;
  }
}
async function demoReply(name,data){await new Promise(r=>setTimeout(r,700));return Object.values(data).some(v=>v)?`أهلاً وسهلاً ${name}،\nتم العثور على بياناتك بنجاح.`:`أهلاً ${name}، لم يتم العثور على بيانات إضافية.`;}

// ── تحميل الملفات للبوابة العامة (استعلام العملاء) بدون تسجيل دخول ──
let _clientFilesLoaded = false;
let _clientFilesLoading = false;
async function sbLoadFilesPublic(){
  if(_clientFilesLoaded || _clientFilesLoading) return;
  if(appState.user) { // إذا كان المستخدم مسجلاً، الملفات محملة بالفعل
    rebuildClientIndex();
    return;
  }
  const sb = getSB(); if(!sb) return;
  _clientFilesLoading = true;

  // أظهر مؤشر تحميل في حقل الإدخال
  const inp = $('clientIdInput');
  if(inp) { inp.placeholder = '⏳ جارٍ تحميل البيانات...'; inp.disabled = true; }

  try {
    const {data: files, error: fErr} = await sb.from('cc_files').select('*').order('id');
    if(fErr) throw fErr;
    if(!files || !files.length) return;

    const loaded = [];
    for(const f of files){
      // جلب جميع سجلات الملف صفحة صفحة
      let allRecs = [];
      let page = 0;
      while(true){
        const {data: recs, error: rErr} = await sb.from('cc_records')
          .select('rowidx, rowdata')
          .eq('fileid', f.id)
          .order('rowidx')
          .range(page*1000, (page+1)*1000 - 1);
        if(rErr) throw rErr;
        if(!recs || !recs.length) break;
        allRecs = allRecs.concat(recs);
        if(recs.length < 1000) break;
        page++;
      }
      const rows = allRecs.map(r => r.rowdata);
      const idCol = _col(f,'idCol');
      const nameCol = _col(f,'nameCol');

      // بناء الفهارس للبحث السريع
      const idIndex = new Map();
      const nameIndex = new Map();
      rows.forEach((row, i) => {
        const k = String(row[idCol] || '').trim();
        if(k) idIndex.set(k, i);
        if(nameCol >= 0){
          const nk = typeof normalizeAr==='function' ? normalizeAr(row[nameCol]||'') : String(row[nameCol]||'').toLowerCase();
          if(nk){ if(!nameIndex.has(nk)) nameIndex.set(nk,[]); nameIndex.get(nk).push(i); }
        }
      });

      loaded.push({
        id: f.id, name: f.name,
        idCol, nameCol: (nameCol !== undefined && nameCol !== null) ? nameCol : -1,
        extraCols: _col(f,'extraCols'),
        headers: f.headers || [],
        prompt: f.prompt || '',
        uploadedBy: _col(f,'uploadedBy'),
        data: rows, idIndex, nameIndex
      });
    }

    appState.files = loaded;
    rebuildClientIndex();
    _clientFilesLoaded = true;
  } catch(e){
    console.error('sbLoadFilesPublic:', e);
  } finally {
    _clientFilesLoading = false;
    if(inp){ inp.placeholder = '0000000000'; inp.disabled = false; inp.focus(); }
  }
}

/* CLIENT PORTAL */
/*          */
let _clientIndex=new Map(); // key: id → {rowIdx, fileIdx}
function rebuildClientIndex(){
  _clientIndex=new Map();
  appState.files.forEach((f,fi)=>{
    if(f.idIndex){
      f.idIndex.forEach((rowIdx,id)=>{ if(!_clientIndex.has(id)) _clientIndex.set(id,{rowIdx,fileIdx:fi}); });
    } else {
      f.data.forEach((row,rowIdx)=>{ const id=String(row[f.idCol]||'').trim(); if(id&&!_clientIndex.has(id)) _clientIndex.set(id,{rowIdx,fileIdx:fi}); });
    }
  });
}
async function clientSearch(){
  const query=$('clientIdInput').value.trim();if(!query){shakeEl('clientIdInput');return;}

  // إذا كانت الملفات لا تزال تُحمَّل، انتظر قليلاً وأعد المحاولة
  if(_clientFilesLoading){
    showClientErr('⏳ جارٍ تحميل البيانات، أعد المحاولة بعد ثوانٍ...');return;
  }

  // إذا لم تُحمَّل الملفات بعد — سواء كان المستخدم مسجلاً أو لا
  if(!appState.files.length){
    if(appState.user && isSupabaseReady && isSupabaseReady()){
      // مستخدم مسجل + Supabase جاهز → حمّل الملفات الآن
      const inp = $('clientIdInput');
      if(inp){ inp.placeholder='⏳ جارٍ تحميل البيانات...'; inp.disabled=true; }
      await sbLoadFiles();
      if(inp){ inp.placeholder='0000000000'; inp.disabled=false; }
    } else if(!appState.user && isSupabaseReady && isSupabaseReady()){
      // زائر + Supabase جاهز
      await sbLoadFilesPublic();
    }
    if(!appState.files.length){
      showClientErr('⚠️ لا توجد ملفات مرفوعة أو النظام غير متاح حالياً.');return;
    }
  }

  if(!_clientIndex.size) rebuildClientIndex();

  let foundRow = null, foundFile = null, foundIdx = -1;
  const hit = _clientIndex.get(query);
  if (hit) {
    foundIdx = hit.fileIdx;
    foundFile = appState.files[foundIdx];
    foundRow = foundFile.data[hit.rowIdx];
  }

  const btn = $('clientSearchBtn');
  btn.disabled = true;
  $('clientSearchBtn').innerHTML = '<div class="spin" style="border-top-color:#fff;margin:0 auto;"></div>';


  // 🚀 السقوط الآمن (Fallback) المباشر عبر قاعدة البيانات (لضمان العثور على أي سجل حتى لو لم يكتمل التحميل)
  if (!foundRow && isSupabaseReady && isSupabaseReady()) {
    try {
      const sb = getSB();
      // استعلام مباشر وسريع جداً في جميع السجلات!
      // بما أن row_data عبارة عن مصفوفة (Array)، يمكننا البحث فيها باستخدام JSONB contains أو عبر الجلب العام للملفات
      // للحفاظ على السرعة وبما أننا نبحث برقم الهوية:

      const { data: directRecs, error: dErr } = await sb.rpc('search_client_id', { query_id: query }).catch(()=>({}));
      // بما أنه لا توجد دالة RPC، سنضطر لجلب آخر الملفات المضافة ونبحث فيها فقط لتسريع العملية
      if(!window._isForcedLoaded) {
        window._isForcedLoaded = true;

        // جلب آخر 3 ملفات تم رفعها (لأن المشكلة تحدث مع السجلات الحديثة فقط)
        const { data: latestFiles } = await sb.from('cc_files').select('id, name, idcol, namecol').order('id', {ascending: false}).limit(3);
        if(latestFiles && latestFiles.length > 0) {
          for (let lf of latestFiles) {
             const fId = lf.id;
             // جلب جميع سجلات هذا الملف (السريع)
             const { data: lfRecs } = await sb.from('cc_records').select('rowdata').eq('fileid', fId);
             if(lfRecs) {
               for(let r of lfRecs) {
                 const idCol = _col(lf,'idCol');
                 const cellVal = String(r.rowdata[idCol] || '').trim();
                 if(cellVal === query) {
                   // وجدناه!
                   foundRow = r.rowdata;
                   // نعيد بناء الملف الوهمي لكي يعمل الرد
                   foundFile = appState.files.find(x => x.id === fId);
                   if(!foundFile) {
                     // جلب بيانات الملف من السيرفر إذا لم يكن في الذاكرة
                     const { data: fullF } = await sb.from('cc_files').select('*').eq('id', fId).single();
                     foundFile = {
                       name: fullF.name,
                       idCol: _col(fullF,'idCol'),
                       nameCol: _col(fullF,'nameCol'),
                       extraCols: _col(fullF,'extraCols'),
                       headers: fullF.headers || [],
                       prompt: fullF.prompt || ''
                     };
                   }
                   break;
                 }
               }
             }
             if(foundRow) break;
          }
        }
      }
    } catch(e) { console.error('Direct fallback error', e); }
  }

  window._isForcedLoaded = false;


  if (!foundRow) {
    btn.disabled = false;
    $('clientSearchBtn').textContent = '🔍  استعلم الآن';
    shakeEl('clientIdInput');
    showClientErr('نعتذر: رقم الهوية غير موجود');
    addHistory(query, -1, false, '—');
    window._isForcedLoaded = false; // تصفير المحاولة
    return;
  }

  window._isForcedLoaded = false; // تصفير عند النجاح

  try {
    const name = foundFile.nameCol >= 0 ? (foundRow[foundFile.nameCol] ?? 'العميل') : 'العميل';
    const personData = {};
    const eCols = Array.isArray(foundFile.extraCols) ? foundFile.extraCols : (typeof foundFile.extraCols==='string'?JSON.parse(foundFile.extraCols):[]);
    const hdrs = Array.isArray(foundFile.headers) ? foundFile.headers : (typeof foundFile.headers==='string'?JSON.parse(foundFile.headers):[]);
    eCols.forEach(i => { if (hdrs[i]) personData[hdrs[i]] = foundRow[i] ?? ''; });

    sv('cResName', name); sv('cResId', `رقم الهوية: ${query}`); sv('cResText', '⏳ جارٍ توليد الرد...'); 
    $('cResTags').innerHTML = buildTagsHtml(personData); $('clientResultBox').style.display = 'block';

    let resp = '';
    const aiEnabled = appState.settings.enableAi !== false; // مفعل افتراضياً
    if (aiEnabled && appState.settings.apiKey) {
      resp = await callClaude(appState.settings.apiKey, foundFile.prompt||'', name, query, buildDataStr(personData));
    } else {
      resp = `أهلاً وسهلاً ${name}،`; // تم إزالة تكرار البيانات هنا لأنها تظهر بشكل جميل بالأسفل في المربعات (cResTags)
    }

    sv('cResText', resp);
    addHistory(query, foundIdx, true, resp);
  } catch (e) {
    console.error('Client Search Error:', e);
    sv('cResText', '❌ حدث خطأ داخلي أثناء معالجة البيانات: ' + e.message);
  } finally {
    btn.disabled = false; 
    $('clientSearchBtn').textContent = '🔍  استعلم الآن';
  }
}
function showClientErr(msg){$('clientResultBox').style.display='block';sv('cResName','نتيجة البحث');sv('cResId','—');$('cResText').innerHTML=`<span style="font-size:16px;color:#f59e0b;font-weight:700;display:block;text-align:center;padding:12px 0;">${msg}</span>`;$('cResTags').innerHTML='';}
function resetClientSearch(){$('clientIdInput').value='';$('clientResultBox').style.display='none';$('clientIdInput').focus();}
function shakeEl(id){const el=$(id);el.style.animation='none';el.offsetHeight;el.style.animation='waShake .4s ease';el.style.borderColor='var(--err)';setTimeout(()=>{el.style.borderColor='';el.style.animation='';},600);}

/* HISTORY */
function addHistory(id,fileIdx,success,response){
  const item={id,file:fileIdx>=0?(appState.files[fileIdx]?.name??'—'):'—',success,response,
    time:new Date().toLocaleString('ar-SA'),user:appState.user?.user??appState.user?.name??'—',userName:appState.user?.name??'—',_ts:Date.now()};
  appState.history.unshift(item);
  if(appState.history.length>1000)appState.history=appState.history.slice(0,1000);
  lsSave(LS.history,appState.history);
  sv('historyCount',appState.history.length);
  updateDashActivity();updateStats();
  if(typeof updateEmpDashboard==='function') updateEmpDashboard();
  if(isSupabaseReady && isSupabaseReady()) sbAddHistory(item);
}
function renderHistory(){
const wrap=$('historyWrap');if(!wrap)return;
const fromVal=document.getElementById('histDateFrom')?.value;
const toVal=document.getElementById('histDateTo')?.value;
const sq=(document.getElementById('histSearch')?.value||'').toLowerCase().trim();
const isEmployee = appState.user && appState.user.role === 'subuser';
const currentUserName = appState.user?.user || '';
let list=appState.history.map((x,realIdx)=>({...x,_realIdx:realIdx})).filter(x=>{
  // الموظف يرى استعلاماته الناجحة فقط — والمدير يرى كل شيء
  if(isEmployee){
    if(!x.success) return false;
    // الموظف يرى استعلاماته فقط (تصفية حسب اسم المستخدم)
    if(x.user && currentUserName && x.user !== currentUserName) return false;
  }
  if(fromVal||toVal){
    const m=x.time?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m){const d=new Date(+m[3],+m[2]-1,+m[1]);if(!isNaN(d)){if(fromVal&&d<new Date(fromVal))return false;if(toVal&&d>new Date(toVal))return false;}}
  }
  if(sq&&!(String(x.id||'').includes(sq)||String(x.user||'').toLowerCase().includes(sq)||String(x.file||'').toLowerCase().includes(sq))) return false;
  return true;
});
if(_histSort.col){
  list.sort((a,b)=>{
    let av=a[_histSort.col]??'', bv=b[_histSort.col]??'';
    return _histSort.dir==='asc'?(av>bv?1:-1):(av<bv?1:-1);
  });
}
if(!list.length){wrap.innerHTML='<div style="text-align:center;padding:32px;color:var(--s400);">لا توجد نتائج</div>';renderPagination('historyPagination',0,1,()=>{});return;}
const total=list.length, ps=_pg.PAGE_SIZE, totalPages=Math.ceil(total/ps);
if(_pg.history>totalPages) _pg.history=totalPages;
const start=(_pg.history-1)*ps, slice=list.slice(start,start+ps);
  wrap.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>#</th><th class="sort-th" onclick="sortHistory('id')">رقم الهوية <span class="sort-arrow"></span></th><th class="sort-th" onclick="sortHistory('file')">الملف <span class="sort-arrow"></span></th><th>الحالة</th><th class="sort-th" onclick="sortHistory('user')">المستخدم <span class="sort-arrow"></span></th><th class="sort-th" onclick="sortHistory('time')">الوقت <span class="sort-arrow"></span></th><th>الإجراءات</th></tr></thead><tbody>`+slice.map((h,i)=>`<tr><td class="text-muted text-sm">${start+i+1}</td><td><strong style="direction:ltr;display:inline-block;">${escHtml(String(h.id??''))}</strong></td><td class="text-muted text-sm">${escHtml(String(h.file??''))}</td><td>${h.success?'<span class="chip chip-g">✓ ناجح</span>':'<span class="chip chip-r">✗ فاشل</span>'}</td><td class="text-muted text-sm">${escHtml(String((h.userName||h.user)??''))}</td><td class="text-muted text-sm">${escHtml(String(h.time??''))}</td><td><div class="flex gap-2"><button class="btn btn-secondary btn-sm" onclick="showResp(${h._realIdx})">👁 عرض</button><button class="btn btn-danger btn-sm" onclick="deleteHistItem(${h._realIdx})">🗑</button></div></td></tr>`).join('')+'</tbody></table></div>';
  renderPagination('historyPagination',total,_pg.history,p=>{_pg.history=p;renderHistory();});
}
function renderPagination(cid,total,current,onChange,ps){const el=$(cid);if(!el)return;const _ps=ps||_pg.PAGE_SIZE,pages=Math.ceil(total/_ps);if(pages<=1){el.innerHTML='';return;}if(pages<=1){el.innerHTML='';return;}el._pgOnChange=onChange;const btn=(p,lbl,dis)=>`<button class="pg-btn${p===current?' active':''}" ${dis?'disabled':''} onclick="document.getElementById('${cid}')._pgOnChange(${p})">${lbl}</button>`;let h=`<span class="pg-info">صفحة ${current} من ${pages}</span>`;h+=btn(1,'«',current===1);h+=btn(current-1,'‹',current===1);const start=Math.max(1,current-2),end=Math.min(pages,current+2);for(let p=start;p<=end;p++)h+=btn(p,p,false);h+=btn(current+1,'›',current===pages);h+=btn(pages,'»',current===pages);h+=`<span class="pg-info">${total} سجل</span>`;el.innerHTML=h;}
function showResp(idx){const h=appState.history[idx];if(!h)return;const m=document.createElement('div');m.className='modal-ov show';m.innerHTML=`<div class="modal"><div class="modal-hd"><div class="modal-title">💬 رد: ${escHtml(String(h.id??''))}</div><button class="modal-close" onclick="this.closest('.modal-ov').remove()">✕</button></div><div class="ai-text"></div><button class="btn btn-primary btn-full" style="margin-top:14px;" onclick="this.closest('.modal-ov').remove()">إغلاق</button></div>`;m.querySelector('.ai-text').textContent=h.response??'';m.addEventListener('click',e=>{if(e.target===m)m.remove();});document.body.appendChild(m);}
function deleteHistItem(idx){
  const item = appState.history[idx];
  if(item?._sbId && isSupabaseReady && isSupabaseReady()) sbDeleteHistoryItem(item._sbId);
  appState.history.splice(idx,1);
  lsSave(LS.history,appState.history);
  sv('historyCount',appState.history.length);
  const tp=Math.ceil(appState.history.length/_pg.PAGE_SIZE)||1;
  if(_pg.history>tp)_pg.history=tp;
  renderHistory();updateStats();toast('🗑 تم الحذف','warn');
}
function clearHistory(){
  const n=appState.history.length;
  if(!n){toast('⚠️ السجل فارغ بالفعل','warn');return;}
  showConfirm(`⚠️ سيتم حذف <b>${n}</b> استعلام نهائياً؟`,()=>{
  appState.history=[];sv('historyCount','0');lsSave(LS.history,[]);_pg.history=1;renderHistory();updateStats();
  if(isSupabaseReady && isSupabaseReady()) sbClearHistory();
  toast(`🗑 تم حذف ${n} استعلام`,'warn');
  addNotif('🗑',`مسح السجل`,`تم حذف ${n} استعلام`);
  });
}
async function exportHistoryPDF(){
  if(!appState.history.length){toast('⚠️ لا يوجد سجل','warn');return;}
  if(typeof html2canvas==='undefined'||typeof window.jspdf==='undefined'){
    toast('⚠️ مكتبة PDF لم تُحمَّل','warn');return;
  }
  showPage('history');
  await new Promise(r=>setTimeout(r,350)); // انتظر رسم الصفحة
  const pageEl = $('page-history');
  if(!pageEl) return;
  toast('📸 جاري التقاط سجل الاستعلامات...','ok');
  const fileNameDate = new Date().toLocaleDateString('en-GB').replace(/\//g,'-');
  try{
    /*     */
    const hidden=[];
    ['.pdf-export-btn','.fs-btn','.chart-dl-btn','.mob-menu-btn'].forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        hidden.push({el,v:el.style.visibility});
        el.style.visibility='hidden';
      });
    });
    const canvas = await html2canvas(pageEl,{
      scale:2, useCORS:true, allowTaint:true,
      backgroundColor:'#f0f5ff', scrollX:0, scrollY:-window.scrollY,
      windowWidth:Math.max(pageEl.scrollWidth,1200),
      windowHeight:pageEl.scrollHeight, logging:false, imageTimeout:15000,
      onclone(clonedDoc){
        const lnk=clonedDoc.createElement('link');
        lnk.rel='stylesheet';
        lnk.href='https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
        clonedDoc.head.appendChild(lnk);
        const st=clonedDoc.createElement('style');
        st.textContent='*{font-family:"Cairo","Segoe UI",Tahoma,Arial,sans-serif!important;-webkit-font-smoothing:antialiased;}';
        clonedDoc.head.appendChild(st);
      }
    });
    hidden.forEach(({el,v})=>el.style.visibility=v);

    const {jsPDF}=window.jspdf;
    const PX_TO_MM=25.4/96/2;
    const imgWmm=canvas.width*PX_TO_MM;
    const imgHmm=canvas.height*PX_TO_MM;
    const orientation=imgWmm/imgHmm>1.3?'landscape':'portrait';
    const pgW=orientation==='landscape'?297:210;
    const pgH=orientation==='landscape'?210:297;
    const imgFitW=pgW;
    const imgFitH=imgFitW/(canvas.width/canvas.height);
    const pagesCount=Math.ceil(imgFitH/pgH);
    const doc=new jsPDF({orientation,unit:'mm',format:'a4',compress:true});
    for(let p=0;p<pagesCount;p++){
      if(p>0)doc.addPage();
      const srcY=Math.round((p*pgH/imgFitH)*canvas.height);
      const srcH=Math.min(Math.round((pgH/imgFitH)*canvas.height),canvas.height-srcY);
      if(srcH<=0)break;
      const sc=document.createElement('canvas');
      sc.width=canvas.width;sc.height=srcH;
      sc.getContext('2d').drawImage(canvas,0,srcY,canvas.width,srcH,0,0,canvas.width,srcH);
      const slice=sc.toDataURL('image/jpeg',0.92);
      const sliceHmm=(srcH/canvas.height)*imgFitH;
      doc.addImage(slice,'JPEG',0,0,pgW,Math.min(sliceHmm,pgH));
    }
    doc.save(`history-report-${fileNameDate}.pdf`);
    addAudit('export','تصدير سجل الاستعلامات PDF','');
    toast('✅ تم تصدير PDF','ok');
  }catch(err){toast('❌ خطأ: '+err.message,'err');}
}
function exportHistory(){if(!appState.history.length){toast('⚠️ لا يوجد سجل','warn');return;}const rows=[['#','رقم الهوية','الملف','الحالة','المستخدم','الوقت','الرد']];appState.history.forEach((h,i)=>rows.push([i+1,h.id,h.file,h.success?'ناجح':'فاشل',h.user,h.time,h.response]));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'سجل');safeExportXLSX('history.xlsx',wb);}

/* EXPORT */
function updateExportFileSelect(){const sel=$('exportFileSelect');if(!sel)return;sel.innerHTML='<option value="all">كل الملفات</option>';appState.files.forEach((f,i)=>sel.innerHTML+=`<option value="${i}">${esc(f.name)}</option>`);}
function updateExportStats(){const total=appState.history.length,succ=appState.history.filter(h=>h.success).length,tr=appState.files.reduce((s,f)=>s+f.data.length,0);sv('expTotal',total);sv('expSuccess',succ);sv('expFail',total-succ);sv('expLast',appState.history[0]?.time??'—');sv('expStatFilesVal',appState.files.length);sv('expStatRecordsVal',tr);}
function doExport(){const fileIdx=$('exportFileSelect').value,type=$('exportType').value,incData=$('expData').checked,incHist=$('expHistory').checked,incResp=$('expResponses').checked;if(!incData&&!incHist){toast('⚠️ اختر نوع البيانات','warn');return;}if(type==='json'){const obj={};if(incData)obj.files=appState.files.map(f=>({name:f.name,records:f.data.map(row=>Object.fromEntries(f.headers.map((h,i)=>[h,row[i]??''])))}));if(incHist)obj.history=appState.history;safeExportText('export.json',JSON.stringify(obj,null,2),'application/json');addAudit('export','تصدير JSON','');return;}const wb=XLSX.utils.book_new();if(incData){const files=fileIdx==='all'?appState.files:[appState.files[parseInt(fileIdx)]].filter(Boolean);files.forEach(f=>{const ws=XLSX.utils.aoa_to_sheet([f.headers,...f.data.map(r=>f.headers.map((_,i)=>r[i]??''))]);XLSX.utils.book_append_sheet(wb,ws,f.name.substring(0,31));});}if(incHist){const rows=[['رقم الهوية','الملف','الحالة','المستخدم','الوقت',...(incResp?['الرد']:[])]];appState.history.forEach(h=>rows.push([h.id,h.file,h.success?'ناجح':'فاشل',h.user,h.time,...(incResp?[h.response]:[])]));XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'سجل');}if(type==='csv'&&wb.SheetNames.length>0)safeExportText('export.csv',XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]),'text/csv');else safeExportXLSX('export.xlsx',wb);addAudit('export','تصدير بيانات',type);}
function exportSingle(){const nameEl=$('resName');const name=(nameEl?.firstChild?.textContent||nameEl?.textContent||'').trim();const id=$('resId').textContent,resp=$('resText').textContent;const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['رقم الهوية','الاسم','الرد'],[id.replace('رقم الهوية: ',''),name,resp]]),'نتيجة');safeExportXLSX('result.xlsx',wb);}
function exportStatsReport(type){const tr=appState.files.reduce((s,f)=>s+f.data.length,0);const succ=appState.history.filter(h=>h.success).length;const rows=[['📊 تقرير إحصائيات Customer Care System v1.0',''],['تاريخ',new Date().toLocaleString('ar-SA')],['',''],['البند','القيمة'],['الملفات',appState.files.length],['السجلات',tr],['الاستعلامات',appState.history.length],['ناجحة',succ],['فاشلة',appState.history.length-succ]];if(type==='csv')safeExportText('stats.csv',rows.map(r=>r.join(',')).join('\n'),'text/csv');else{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'إحصائيات');safeExportXLSX('stats.xlsx',wb);}addAudit('export','تصدير تقرير إحصائيات','');}

/* USERS */
function renderUsersTable(filter){
  if(filter) currentUserFilter=filter;
  const sq=(document.getElementById('usersSearchInput')?.value||'').toLowerCase().trim();
  const users=registeredUsers.filter(u=>{
    if(currentUserFilter!=='all'&&u.role!==currentUserFilter) return false;
    if(!sq) return true;
    return u.name?.toLowerCase().includes(sq)||u.user?.toLowerCase().includes(sq)||u.email?.toLowerCase().includes(sq)||u.org?.toLowerCase().includes(sq);
  });
  const wrap=$('usersTableWrap');if(!wrap)return;
  if(!users.length){wrap.innerHTML='<div style="text-align:center;padding:32px;color:var(--s400);">لا يوجد مستخدمون</div>';return;}
  const rChip={admin:'<span class="chip chip-r">👑 مدير</span>',subuser:'<span class="chip chip-y">👤 موظف</span>'};
  const sChip={active:'<span class="chip chip-g">✅ نشط</span>',inactive:'<span class="chip chip-r">⛔ موقوف</span>'};
  // حساب الجلسات النشطة لكل مستخدم (من الكاش أو localStorage)
  const _now = Date.now();
  const _allSessions = Object.keys(_cachedSessionCounts||{}).length
    ? _cachedSessionCounts
    : (_getActiveSessions ? _getActiveSessions() : {});
  const _sessionCounts = {};
  Object.values(_allSessions).forEach(s=>{
    if(s && s.userId && (_now - Number(s.ts)) < SESSION_EXPIRY){
      const _key = Number(s.userId);
      _sessionCounts[_key] = (_sessionCounts[_key]||0) + 1;
    }
  });

  let h=`<div class="tbl-wrap"><table><thead><tr><th>المستخدم</th><th>المؤسسة</th><th>رقم الهوية</th><th>الجوال</th><th>الدور</th><th>الحالة</th><th>الجلسات</th><th>الإجراءات</th></tr></thead><tbody>`;
  users.forEach(u=>{
    const ac=u.role==='admin'?'#dc2626':'#d97706', ab=u.role==='admin'?'rgba(239,68,68,.1)':'rgba(245,158,11,.1)';
    const isMain=u.id===1;
    const sesCount = _sessionCounts[Number(u.id)] || 0;
    const sesCell = sesCount > 0
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);border-radius:20px;font-size:11px;font-weight:700;color:#059669;">🟢 ${sesCount} نشطة</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--b50);border:1px solid var(--border);border-radius:20px;font-size:11px;color:var(--s400);">⚫ لا توجد</span>`;
    h+=`<tr>
      <td><div class="flex items-center gap-2">
        <div class="td-av" style="background:${ab};color:${ac};">${u.role==='admin'?'👑':'👤'}</div>
        <div>
          <div style="font-weight:700;">${escHtml(u.name)}</div>
          <div class="text-sm text-muted u-ltr" style="direction:ltr;unicode-bidi:plaintext;">${u.email ? _maskEmail(u.email) : '—'}</div>
          <div class="text-sm" style="color:var(--b600);">@${escHtml(u.user)}</div>
        </div>
      </div></td>
      <td class="text-sm">${esc(u.org)||'—'}</td>
      <td><span style="direction:ltr;display:inline-block;font-family:monospace;font-size:11.5px;background:var(--b50);padding:1px 7px;border-radius:5px;">${esc(u.natId)||'—'}</span></td>
      <td style="direction:ltr;font-size:12.5px;">${esc(u.phone)||'—'}</td>
      <td>${rChip[u.role]||'—'}</td>
      <td>${sChip[u.status]||'—'}</td>
      <td style="text-align:center;">${sesCell}</td>
      <td><div class="flex gap-2" style="flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="openEditUser(${u.id})">✏️ تعديل</button>
        ${!isMain?`
          ${u.role==='subuser'?`
            <button class="btn btn-sm" style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;" onclick="impersonateUser(${u.id})">🔁 دخول</button>
            <button class="btn btn-sm" style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#92400e;" onclick="resetUserSession(${u.id})" title="إعادة تعيين الجلسة عند تعذر دخول الموظف">🔓 تعيين الجلسة</button>
          `:''}
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">🗑 حذف</button>
        `:''}
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>';wrap.innerHTML=h;
  sv('countAdmins',registeredUsers.filter(u=>u.role==='admin').length);sv('countSubusers',registeredUsers.filter(u=>u.role==='subuser').length);sv('countTotal',registeredUsers.length);
}
function filterUsers(f,btn){currentUserFilter=f;document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderUsersTable(f);}
function openAddUserModal(){$('newUserRole').value='admin';['newUserOrg','newUserName','newUserNatId','newUserPhone','newUserEmail','newUserUsername','newUserPass'].forEach(id=>{const e=$(id);if(e)e.value='';});$('mRoleAdmin').classList.add('active');$('mRoleSubuser').classList.remove('active');// إعادة تعيين قسم الشعار وإخفاؤه (المدير افتراضي)
const ls=$('newUserLogoSection');if(ls)ls.style.display='none';
if(typeof clearNewUserLogo==='function')clearNewUserLogo();$('addUserModal').classList.add('show');}
function setModalRole(role,btn){$('newUserRole').value=role;document.querySelectorAll('.role-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  // إظهار/إخفاء قسم الشعار حسب الدور
  const logoSec=$('newUserLogoSection');
  if(logoSec) logoSec.style.display=(role==='subuser')?'block':'none';
}
/* معاينة الشعار في نموذج إضافة موظف جديد */
function previewNewUserLogo(type,val){
  const emoji=$('newUserLogoPreviewEmoji'),img=$('newUserLogoPreviewImg');
  if(!emoji||!img)return;
  if(type==='url'){
    if(!val){img.style.display='none';emoji.style.display='';return;}
    img.src=val;img.style.display='block';emoji.style.display='none';
    img.onerror=()=>{img.style.display='none';emoji.style.display='';};
  }else if(type==='file'&&val.files&&val.files[0]){
    const reader=new FileReader();
    reader.onload=e=>{
      appState._pendingNewUserLogo=e.target.result;
      if(img){img.src=e.target.result;img.style.display='block';}
      if(emoji)emoji.style.display='none';
      const u=$('newUserLogoUrl');if(u)u.value='';
    };
    reader.readAsDataURL(val.files[0]);
  }
}
function clearNewUserLogo(){
  appState._pendingNewUserLogo=null;
  const emoji=$('newUserLogoPreviewEmoji'),img=$('newUserLogoPreviewImg'),u=$('newUserLogoUrl');
  if(emoji)emoji.style.display='';if(img){img.style.display='none';img.src='';}if(u)u.value='';
}
function validateEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}
async function saveUser(){
  const getVal = id => document.getElementById(id) ? document.getElementById(id).value.trim() : '';
  const org=getVal('newUserOrg'),
        name=getVal('newUserName'),
        natId=getVal('newUserNatId'),
        phone=getVal('newUserPhone'),
        email=getVal('newUserEmail'),
        username=getVal('newUserUsername'),
        pass=getVal('newUserPass'),
        role=document.getElementById('newUserRole') ? document.getElementById('newUserRole').value : 'user';

  if(!org||!name||!natId||!phone||!email||!username||!pass){ if(typeof toast==='function') toast('⚠️ أكمل جميع الحقول','warn'); return;}
  if(typeof validateEmail==='function' && !validateEmail(email)){ if(typeof toast==='function') toast('⚠️ صيغة البريد الإلكتروني غير صحيحة','warn'); return;}
  if(typeof validatePassword==='function'){ const pe=validatePassword(pass); if(pe){ if(typeof toast==='function') toast('⚠️ '+pe,'warn'); return;} }
  if(!/^[a-zA-Z0-9._@-]{3,30}$/.test(username)){ if(typeof toast==='function') toast('⚠️ اسم المستخدم: 3-30 حرف، أرقام ونقاط وشرطات فقط','warn'); return;}
  if(typeof registeredUsers !== 'undefined' && registeredUsers.find(u=>u.user===username)){ if(typeof toast==='function') toast('❌ اسم المستخدم مستخدم مسبقاً','err'); return;}

  try {
    // شعار مخصص للموظف (اختياري) — من رابط URL أو ملف مرفوع
    const customLogo = (role === 'subuser')
      ? (($('newUserLogoUrl')?.value.trim()) || appState._pendingNewUserLogo || '')
      : '';
    appState._pendingNewUserLogo = null; // مسح الحالة المؤقتة

    const nu={
      id: 0,
      role, org, name, natId, phone, email,
      user: username, pass: '',
      status: 'active',
      customLogo,
      createdAt: new Date().toLocaleDateString('ar-SA'),
      lastLogin: 'لم يسجل بعد'
    };

    if(typeof isSupabaseReady === 'function' && isSupabaseReady() && typeof getSB === 'function'){
      const sb = getSB();
      // الخطوة 1: احفظ بدون كلمة مرور لنحصل على الـ id الحقيقي من Supabase
      const { data: inserted, error: insertErr } = await sb
        .from('cc_users')
        .insert({
          role: nu.role, username: nu.user, pass: '',
          name: nu.name, org: nu.org||'', nat_id: nu.natId||'',
          phone: nu.phone||'', email: nu.email||'', status: 'active',
          permissions: nu.permissions||{}, custom_logo: nu.customLogo||''
        })
        .select('id')
        .single();
      if(insertErr) throw insertErr;
      nu.id = inserted.id;

      // الخطوة 2: نشفر كلمة المرور بالـ id الحقيقي
      let hpass = pass;
      try{ hpass = await hashPass(pass, nu.id); }catch(_he){ console.warn('hashPass failed:', _he); }
      nu.pass = hpass;

      // الخطوة 3: نحدّث pass في نفس السجل فوراً
      const { error: updateErr } = await sb
        .from('cc_users')
        .update({ pass: hpass })
        .eq('id', nu.id);
      if(updateErr) throw updateErr;

    } else {
      nu.id = typeof userIdCounter !== 'undefined' ? userIdCounter++ : Date.now();
      let hpass = pass;
      try{ hpass = (typeof hashPass === 'function') ? await hashPass(pass, nu.id) : pass; }catch(_he){}
      nu.pass = hpass;
    }

    // إذا كان Supabase جاهزاً: لا نُضيف محلياً — الـ Realtime سيُحدِّث القائمة تلقائياً
    // إذا كان offline: نضيف محلياً فقط
    if(!(typeof isSupabaseReady==='function' && isSupabaseReady())){
      if(typeof registeredUsers !== 'undefined') registeredUsers.push(nu);
      if(typeof saveUsersToLS === 'function') saveUsersToLS();
      if(typeof renderUsersTable === 'function') renderUsersTable();
      if(typeof renderSbSwitchList === 'function') renderSbSwitchList();
    } else {
      // Supabase: انتظر sbLoadUsers من Realtime، لكن أضف فوراً للـ UI دون انتظار
      // لمنع التكرار: نتحقق من الـ id قبل الإضافة
      if(nu.id > 0 && typeof registeredUsers !== 'undefined' && !registeredUsers.find(x=>x.id===nu.id)){
        registeredUsers.push(nu);
        if(typeof saveUsersToLS === 'function') saveUsersToLS();
        if(typeof renderUsersTable === 'function') renderUsersTable();
        if(typeof renderSbSwitchList === 'function') renderSbSwitchList();
      }
    }
    if(typeof closeModal === 'function') closeModal('addUserModal');
    if(typeof updateStats === 'function') updateStats();
    if(typeof addAudit === 'function') addAudit('user', `إضافة مستخدم جديد: ${name}`, `الدور: ${role}`);
    if(typeof toast === 'function') toast(`✅ تم تسجيل "${name}"`, 'ok');
    
  } catch (error) {
    console.error("Save User Error:", error);
    if(typeof toast === 'function') toast('❌ حدث خطأ أثناء الحفظ: ' + error.message, 'err');
  } finally {
    if(typeof closeModal === 'function') closeModal('addUserModal');
  }
}
function openEditUser(id){const u=registeredUsers.find(u=>u.id===id);if(!u)return;$('editUserIdModal').value=id;$('editOrg').value=u.org||'';$('editName').value=u.name||'';$('editNatId').value=u.natId||'';$('editPhone').value=u.phone||'';$('editEmail').value=u.email||'';$('editUsername').value=u.user||'';$('editRole').value=u.role;$('editStatus').value=u.status||'active';
  // شعار مخصص للموظف — يظهر فقط لحسابات الموظفين
  const logoSec=$('editUserLogoSection');
  if(logoSec) logoSec.style.display=(u.role==='subuser')?'block':'none';
  const logoUrlInp=$('editUserLogoUrl');if(logoUrlInp)logoUrlInp.value=u.customLogo||'';
  const img=$('editUserLogoPreviewImg'),em=$('editUserLogoPreviewEmoji');
  if(img&&em){if(u.customLogo){img.src=u.customLogo;img.style.display='block';em.style.display='none';}else{img.style.display='none';em.style.display='';}}
  appState._pendingEditUserLogo=null;
  $('editUserModal').classList.add('show');}
function saveEditUser(){if(!requireAuth('saveEditUser'))return;const id=parseInt($('editUserIdModal').value);const u=registeredUsers.find(u=>u.id===id);if(!u)return;
  const newUsername=$('editUsername').value.trim();
  if(!newUsername){toast('⚠️ اسم المستخدم مطلوب','warn');return;}
  if(!/^[a-zA-Z0-9._@-]{3,30}$/.test(newUsername)){toast('⚠️ اسم المستخدم: 3-30 حرف، أرقام ونقاط وشرطات فقط','warn');return;}
  if(registeredUsers.find(x=>x.user===newUsername&&x.id!==id)){toast('❌ اسم المستخدم مستخدم من حساب آخر','err');return;}
  // منع تعديل الحساب الرئيسي الأول
  if(id===1 && appState.user?.id!==1){toast('⛔ لا يمكن تعديل الحساب الرئيسي','err');return;}
  // منع المدير من تخفيض صلاحيات نفسه
  const isSelf = appState.user && appState.user.id===id;
  const newRole = $('editRole').value;
  if(isSelf && newRole!=='admin'){toast('⚠️ لا يمكنك تغيير دورك الخاص','warn');$('editRole').value='admin';return;}
  u.org=$('editOrg').value.trim();u.name=$('editName').value.trim();u.natId=$('editNatId').value.trim();u.phone=$('editPhone').value.trim();u.email=$('editEmail').value.trim();u.user=newUsername;u.role=newRole;u.status=$('editStatus').value;
  // حفظ الشعار المخصص للموظف
  if(newRole==='subuser'){
    const _logoUrl=$('editUserLogoUrl');
    const _logoVal=(_logoUrl?_logoUrl.value.trim():'')||appState._pendingEditUserLogo||'';
    u.customLogo=_logoVal;
  } else { u.customLogo=''; }
  appState._pendingEditUserLogo=null;
  const lu=USERS.find(x=>x.id===id);if(lu){lu.name=u.name;lu.role=u.role;lu.user=newUsername;}
  // إذا كان المدير يعدّل حسابه الخاص — حدّث appState مباشرة
  if(isSelf){appState.user.name=u.name;appState.user.user=newUsername;sv('sbName',u.name);}
  saveUsersToLS();
  if(typeof isSupabaseReady==='function' && isSupabaseReady() && typeof sbSaveUser==='function') sbSaveUser(u);
  closeModal('editUserModal');renderUsersTable();addAudit('user',`تعديل بيانات: ${u.name}`,'');toast(`✅ تم تحديث "${u.name}"`,'ok');}
function openResetPass(id){const u=registeredUsers.find(u=>u.id===id);if(!u)return;$('resetUserId').value=id;sv('resetUserName',u.name);$('newResetPass').value='';$('confirmResetPass').value='';$('resetPassModal').classList.add('show');}
function openResetPassFromEdit(){const id=parseInt($('editUserIdModal').value);if(!id)return;closeModal('editUserModal');openResetPass(id);}
/*         */
function _invalidateAllUserSessions(userId){
  // ═══ الحل الجذري النهائي ═══
  // نرفع "password version" → أي جلسة قديمة تصبح غير صالحة تلقائياً
  // الـ heartbeat والـ _checkDuplicateSession يستخدمان هذه النسخة للتحقق
  const _newPv = Date.now().toString();
  try{ localStorage.setItem('cc_pw_ver_' + userId, _newPv); }catch(e){}

  // إعادة تفعيل الحساب (رفع أي إيقاف أو تعليق)
  try{
    const u = registeredUsers.find(x=>x.id===userId);
    if(u){ u.status='active'; saveUsersToLS(); }
  }catch(e){}

  // إعادة تعيين جميع قيود الدخول
  try{
    const u = registeredUsers.find(x=>x.id===userId);
    if(u){
      setEmpAttempts(userId,{count:0,suspended:false});
      localStorage.removeItem('cc_empAttempts_'+userId);
      localStorage.removeItem('cc_gl_attempts_'+(u.user||''));
    }
  }catch(e){}

  // حذف الجلسة المباشرة وبيانات تذكرني
  try{ localStorage.removeItem(_empKey(userId)); }catch(e){}
  try{
    const rem = JSON.parse(localStorage.getItem('cc_remember')||'null');
    if(rem && rem.userId===userId) localStorage.removeItem('cc_remember');
  }catch(e){}

  // حذف سجلات الجلسات النشطة
  try{
    const sessions = _getActiveSessions();
    Object.keys(sessions).forEach(sid=>{ if(sessions[sid].userId===userId) delete sessions[sid]; });
    _setActiveSessions(sessions);
  }catch(e){}

  // إخطار التبويبات المفتوحة
  try{ if(_sessionChannel) _sessionChannel.postMessage({type:'password_changed', userId, pv:_newPv}); }catch(e){}
}

function doResetPass(){
  if(!requireAuth('resetPass'))return;
  const id=parseInt($('resetUserId').value);
  const np=$('newResetPass').value, cf=$('confirmResetPass').value;
  if(!np){toast('⚠️ أدخل كلمة المرور الجديدة','warn');return;}
  const pve=validatePassword(np);
  if(pve){toast('⚠️ '+pve,'warn');return;}
  if(np!==cf){toast('❌ كلمتا المرور غير متطابقتين','err');return;}
  const u=registeredUsers.find(u=>u.id===id);
  if(!u){toast('❌ المستخدم غير موجود','err');return;}
  hashPass(np, id).then(async h=>{
    try{
      const _sb=typeof getSB==='function'?getSB():null;
      if(_sb && typeof isSupabaseReady==='function' && isSupabaseReady()){
        const {error:_pe}=await _sb.from('cc_users').update({pass:h}).eq('id',id);
        if(_pe){ toast('❌ فشل حفظ كلمة المرور: '+_pe.message,'err'); return; }
      }
    }catch(e){ toast('❌ فشل الاتصال: '+e.message,'err'); return; }
    u.pass = h;
    saveUsersToLS();
    _invalidateAllUserSessions(id);
    closeModal('resetPassModal');
    addAudit('pass',`تغيير كلمة مرور الموظف: ${u.name}`,'تم إنهاء جميع الجلسات تلقائياً');
    toast(`🔑 تم تغيير كلمة مرور "${u.name}" — سيضطر الموظف لإعادة الدخول بكلمة المرور الجديدة`,'ok');
  });
}

function deleteUser(id){if(!requireAuth('deleteUser'))return;const u=registeredUsers.find(u=>u.id===id);if(!u)return;showConfirm(`حذف المستخدم "<b>${u.name}</b>"؟`,()=>{
  registeredUsers=registeredUsers.filter(u=>u.id!==id);
  const li=USERS.findIndex(x=>x.id===id);if(li>=0)USERS.splice(li,1);
  saveUsersToLS();
  if(isSupabaseReady && isSupabaseReady()) { sbDeleteUser(id); }
  renderUsersTable();updateStats();addAudit('delete',`حذف مستخدم: ${u.name}`,u.role);toast(`🗑 تم حذف "${u.name}"`,'warn');});}

/*       (      )  */
function resetUserSession(id){
  if(!requireAuth('resetUserSession'))return;
  const u=registeredUsers.find(u=>u.id===id);
  if(!u){toast('❌ المستخدم غير موجود','err');return;}
  showConfirm(`إعادة تعيين جلسة <b>${u.name}</b>؟<br><small style="color:var(--s400)">سيتم مسح بيانات الجلسة المحفوظة مما يسمح للموظف بتسجيل الدخول من جديد.</small>`,()=>{
    // BLOCK FLAG أولاً لمنع الـ heartbeat من إعادة الكتابة
    try{ localStorage.setItem('cc_session_blocked_'+id, Date.now().toString()); }catch(e){}
    try{ localStorage.removeItem(_empKey(id)); }catch(e){}
    try{ localStorage.removeItem('cc_pass_changed_'+id); }catch(e){}
    try{ localStorage.removeItem('cc_gl_attempts_'+u.user); }catch(e){}
    try{ setEmpAttempts(id,{count:0,suspended:false}); }catch(e){}
    try{
      const rem=JSON.parse(localStorage.getItem('cc_remember')||'null');
      if(rem&&rem.userId===id){ localStorage.removeItem('cc_remember'); }
    }catch(e){}
    try{
      const sessions=_getActiveSessions();
      Object.keys(sessions).forEach(sid=>{ if(sessions[sid].userId===id) delete sessions[sid]; });
      _setActiveSessions(sessions);
    }catch(e){}
    if(u.status==='inactive'){
      u.status='active';
      saveUsersToLS();
      renderUsersTable();
    }
    addAudit('user',`إعادة تعيين جلسة: ${u.name}`,'تم بواسطة المدير');
    toast(`✅ تم إعادة تعيين جلسة "${u.name}" — يمكنه الدخول الآن`,'ok');
  },'🔄');
}
function openChangeMyPass(){$('currentPass').value='';$('newMyPass').value='';$('confirmMyPass').value='';$('changeMyPassModal').classList.add('show');}
async function doChangeMyPass(){
  const cp=$('currentPass').value, np=$('newMyPass').value, cf=$('confirmMyPass').value;
  if(!cp){toast('⚠️ أدخل كلمة المرور الحالية','warn');return;}
  if(!np||np!==cf){toast('❌ كلمتا المرور غير متطابقتين','err');return;}
  const pvc=validatePassword(np);if(pvc){toast('⚠️ '+pvc,'warn');return;}
  const uid = appState.user?.id||'';
  const sb = typeof getSB==='function'?getSB():null;

  // جلب الهاش الحالي مباشرة من Supabase للتحقق الصحيح
  let storedHash = null;
  try{
    if(sb && isSupabaseReady()){
      const {data:dbU} = await sb.from('cc_users').select('pass').eq('id',uid).maybeSingle();
      if(dbU) storedHash = dbU.pass;
    }
  }catch(_e){}
  // fallback: استخدم ما في الذاكرة إن لم يُجلب من Supabase
  if(!storedHash) storedHash = registeredUsers.find(u=>u.id===uid)?.pass || appState.user.pass;

  let hcp = await hashPass(cp, uid);
  if(hcp!==storedHash) hcp = await hashPass(cp,1);
  if(hcp!==storedHash) hcp = await hashPass(cp,'');
  if(hcp!==storedHash) hcp = await hashPass(cp,appState.user?.user||'');
  if(storedHash !== hcp){
    toast('❌ كلمة المرور الحالية غير صحيحة','err');
    addAudit('warn','محاولة تغيير كلمة مرور فاشلة','');
    return;
  }
  const hnp = await hashPass(np, uid);
  try{
    if(sb && isSupabaseReady()){
      const {error:_pe}=await sb.from('cc_users').update({pass:hnp}).eq('id',uid);
      if(_pe){ toast('❌ فشل حفظ كلمة المرور: '+_pe.message,'err'); return; }
    }
  }catch(e){ toast('❌ فشل الاتصال: '+e.message,'err'); return; }
  appState.user.pass = hnp;
  const u=registeredUsers.find(u=>u.id===uid); if(u) u.pass=hnp;
  const lu=USERS.find(x=>x.id===uid); if(lu) lu.pass=hnp;
  saveUsersToLS();
  closeModal('changeMyPassModal');
  addAudit('pass','تغيير كلمة المرور الشخصية','');
  toast('✅ تم تغيير كلمة مرورك','ok');
}

/* PERMISSIONS */
function renderPermissionsPage(){
  const wrap=$('permsTableWrap');if(!wrap)return;
  const employees=registeredUsers.filter(u=>u.role==='subuser');
  if(!employees.length){wrap.innerHTML='<div style="text-align:center;padding:30px;color:var(--s500);">لا يوجد موظفون مسجلون</div>';return;}
  const PERM_LIST=[
    {key:'whatsapp',label:'💬 إرسال الرسائل'},
    {key:'files',   label:'📁 رفع الملفات'},
    {key:'search',  label:'🔍 البحث'},
    {key:'history', label:'📋 السجل'},
    {key:'export',  label:'📤 التصدير'},
    {key:'my-audit',label:'🛡️ سجل نشاطي'}
  ];
  let html=`<div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px;">
    <thead><tr style="background:var(--b50);">
      <th style="padding:10px 14px;text-align:right;">الموظف</th>
      ${PERM_LIST.map(p=>`<th style="padding:10px 14px;text-align:center;">${p.label}</th>`).join('')}
      <th style="padding:10px 14px;text-align:center;">حفظ</th>
    </tr></thead><tbody>`;
  employees.forEach(u=>{
    const perms=u.permissions||{};
    html+=`<tr id="permRow_${u.id}">
      <td style="padding:10px 14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:rgba(245,158,11,.15);display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>
          <div>
            <div style="font-weight:700;font-size:13px;">${escHtml(u.name)}</div>
            <div style="font-size:11px;color:var(--s500);">@${escHtml(u.user)}</div>
          </div>
        </div>
      </td>
      ${PERM_LIST.map(p=>`
        <td style="padding:10px 14px;text-align:center;">
          <label class="perm-toggle">
            <input type="checkbox" data-uid="${u.id}" data-perm="${p.key}"
              ${perms[p.key]!==false?'checked':''}
              onchange="onPermChange(${u.id},'${p.key}',this.checked)"/>
            <span class="perm-slider"></span>
          </label>
        </td>`).join('')}
      <td style="padding:10px 14px;text-align:center;">
        <button class="perm-save-btn" id="permSaveBtn_${u.id}"
          onclick="this.disabled=true;this.textContent='⏳';saveEmployeePerms(${u.id}).finally(()=>{this.disabled=false;this.textContent='💾 حفظ';})">
          💾 حفظ
        </button>
      </td>
    </tr>`;
  });
  html+='</tbody></table></div>';
  wrap.innerHTML=html;
}
function onPermChange(uid,key,val){const u=registeredUsers.find(r=>r.id===uid);if(!u)return;if(!u.permissions)u.permissions={};u.permissions[key]=val;}
async function saveEmployeePerms(uid){
  const u=registeredUsers.find(r=>r.id===uid);
  if(!u) return;
  // حفظ في localStorage
  saveUsersToLS();
  // حفظ في Supabase (المصدر الرئيسي)
  if(isSupabaseReady && isSupabaseReady()){
    try{
      await sbSaveUser(u);
    }catch(e){
      toast('⚠️ فشل حفظ الصلاحيات في السحابة: '+e.message,'warn');
      return;
    }
  }
  // تطبيق فوري إذا كانت الجلسة الحالية للموظف المعدَّل
  if(appState.user && appState.user.id===uid) applyEmployeeNavPerms();
  addAudit('user',`تعديل صلاحيات: ${u.name}`,'المدير');
  toast(`✅ تم حفظ صلاحيات "${u.name}" بنجاح`,'ok');
}

// ── حفظ صلاحيات جميع الموظفين دفعة واحدة ──
async function saveAllPerms(){
  const employees = registeredUsers.filter(u=>u.role==='subuser');
  if(!employees.length){ toast('⚠️ لا يوجد موظفون','warn'); return; }
  const btn = document.querySelector('.btn-success[onclick="saveAllPerms()"]');
  if(btn){ btn.disabled=true; btn.textContent='⏳ جارٍ الحفظ...'; }
  try{
    saveUsersToLS();
    if(isSupabaseReady && isSupabaseReady()){
      for(const u of employees){
        await sbSaveUser(u);
      }
    }
    // تطبيق فوري لو كان الموظف الحالي مسجلاً
    if(appState.user && appState.user.role==='subuser') applyEmployeeNavPerms();
    addAudit('user','حفظ صلاحيات جميع الموظفين','المدير');
    toast(`✅ تم حفظ صلاحيات ${employees.length} موظف بنجاح`,'ok');
  }catch(e){
    toast('⚠️ فشل الحفظ: '+e.message,'warn');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='💾 حفظ الكل'; }
  }
}
/* IMPERSONATE */
function renderSbSwitchList(){
  const box=$('sbSwitchEmp'),list=$('sbSwitchList');
  if(!box||!list) return;
  // القائمة الجانبية لأسماء الموظفين تظهر للمدير فقط
  if(!appState.user || appState.user.role !== 'admin'){
    box.style.display='none'; return;
  }
  const emps=registeredUsers.filter(u=>u.role==='subuser'&&u.status!=='inactive');
  if(!emps.length){box.style.display='none';return;}
  box.style.display='block';
  list.innerHTML=emps.map(u=>`<div class="sb-switch-item" onclick="impersonateUser(${u.id})"><div class="sb-switch-av">👤</div><span class="sb-switch-name">${escHtml(u.name)}</span><span class="sb-switch-badge">@${escHtml(u.user)}</span></div>`).join('');
}
async function impersonateUser(uid){
  if(!appState.user||appState.user.role!=='admin'){toast('⛔ هذه الميزة خاصة بمدير النظام فقط','err');return;}
  const target=registeredUsers.find(u=>u.id===uid&&u.role==='subuser');
  if(!target)return;
  _adminUser=appState.user;
  // احذف جلسة المدير من السجل أثناء الانتحال
  if(_sessionId){ const _s=_getActiveSessions(); delete _s[_sessionId]; _setActiveSessions(_s); }
  clearInterval(_heartbeatTimer);
  appState.user={id:target.id,name:target.name,user:target.user,role:'subuser',avatar:'👤',color:'#d97706'};
  // سجّل جلسة الموظف المُنتَحَل
  await _registerSession(target.id);
  const bar=$('impersonateBar'),nm=$('impersonateName');
  if(bar){bar.style.display='flex';}
  if(nm)nm.textContent=target.name+' (@'+target.user+')';
  $('sbSwitchEmp').style.display='none';
  // إعادة تعيين واتساب لمنع تسرب بيانات الموظف السابق
  _waCurrentOwner = null; waRows = []; waSelected = new Set(); wa_idCtr = 100; _waInited = false;
  setupForRole('subuser');
  applyEmployeeNavPerms(); // تطبيق صلاحيات الموظف المُنتَحَل
  // إعادة تحميل الملفات مُصفَّاةً لهذا الموظف فقط
  appState.files=[];
  if(typeof isSupabaseReady==='function'&&isSupabaseReady()) sbLoadFiles();
  addAudit('login',`انتحال هوية موظف: ${target.name}`,appState.user?.name??'');
  toast('🔁 أنت الآن تعمل كـ '+target.name,'ok');
}
async function exitImpersonate(){
  if(!_adminUser)return;
  // احذف جلسة الموظف المُنتَحَل
  if(_sessionId){ const _s=_getActiveSessions(); delete _s[_sessionId]; _setActiveSessions(_s); }
  clearInterval(_heartbeatTimer);
  appState.user=_adminUser;
  _adminUser=null;
  // أعِد تسجيل جلسة المدير
  await _registerSession(appState.user.id);
  const bar=$('impersonateBar');
  if(bar)bar.style.display='none';
  // إعادة تعيين مالك واتساب لإجبار إعادة التحميل عند التبديل
  _waCurrentOwner = null; waRows = []; waSelected = new Set(); wa_idCtr = 100; _waInited = false;
  setupForRole('admin');
  // إعادة تحميل كل الملفات لحساب المدير
  appState.files=[];
  if(typeof isSupabaseReady==='function'&&isSupabaseReady()) sbLoadFiles();
  showPage('users');
  addAudit('logout','إنهاء انتحال الهوية','');
  toast('✅ عدت لحساب المدير','ok');
}

/* SETTINGS */
function validatePassword(pass){
  if(!pass||pass.length<8)return'كلمة المرور يجب أن لا تقل عن 8 أحرف';
  if(!/[A-Za-z]/.test(pass))return'يجب أن تحتوي على حروف إنجليزية';
  if(!/[0-9]/.test(pass))return'يجب أن تحتوي على أرقام';
  if(!/[^A-Za-z0-9]/.test(pass))return'يجب أن تحتوي على رمز خاص مثل @ # $ !';
  return null;
}
function getEmpAttempts(id){return lsLoad('cc_empAttempts_'+id,{count:0,suspended:false});}
function setEmpAttempts(id,data){lsSave('cc_empAttempts_'+id,data);}
function checkEmpLock(id){
  const d=getEmpAttempts(id);
  if(d.suspended){toast('🔒 هذا الحساب مُعلَّق بسبب كثرة المحاولات الفاشلة. تواصل مع مدير النظام','err');return true;}
  return false;
}
function resetAllLocks(){
  registeredUsers.forEach(u=>{
    setEmpAttempts(u.id,{count:0,suspended:false});
    // BLOCK FLAG لمنع الـ heartbeat من إعادة الكتابة
    try{ localStorage.setItem('cc_session_blocked_'+u.id, Date.now().toString()); }catch(e){}
    try{ localStorage.removeItem(_empKey(u.id)); }catch(e){}
    try{ localStorage.removeItem('cc_pass_changed_'+u.id); }catch(e){}
    try{ localStorage.removeItem('cc_gl_attempts_'+u.user); }catch(e){}
    if(u.status==='inactive'&&u.role!=='admin'){u.status='active';}
  });
  try{ _setActiveSessions({}); }catch(e){}
  saveUsersToLS();
  USERS=registeredUsers.map(u=>({id:u.id,name:u.name,user:u.user,pass:u.pass,role:u.role,avatar:u.role==='admin'?'👑':'👤',color:u.role==='admin'?'#dc2626':'#d97706'}));
  renderUsersTable();
  toast('✅ تم إعادة تعيين جميع قيود الدخول وبيانات الجلسات — جميع الموظفين يمكنهم الدخول الآن.','ok');
}

async function showActiveSessions(){
  if(appState.user?.role!=='admin'){toast('⛔ للمدير فقط','err');return;}
  // ✅ اقرأ الجلسات من Supabase (cross-device)
  const sessions = await _getActiveSessionsFromSB();
  const now=Date.now();
  const active=Object.entries(sessions).filter(([sid,s])=>(now-s.ts)<SESSION_EXPIRY);
  const rows=active.map(([sid,s])=>{
    const u=registeredUsers.find(x=>x.id===s.userId);
    const name=u?u.name:'مجهول';
    const role=u?u.role:'—';
    const age=Math.round((now-s.ts)/1000);
    const isMe=sid===_sessionId;
    return `<tr style="border-bottom:1px solid rgba(226,232,240,.3)">
      <td style="padding:8px 12px;font-weight:600">${escHtml(name)}</td>
      <td style="padding:8px 12px;color:var(--s500);font-size:12px">${role==='admin'?'مدير':'موظف'}</td>
      <td style="padding:8px 12px;font-size:11px;color:var(--s400);direction:ltr">${escHtml(s.ua||'—')}</td>
      <td style="padding:8px 12px;font-size:12px">${age}ث مضت</td>
      <td style="padding:8px 12px;text-align:center">
        ${isMe
          ? '<span style="font-size:11px;color:#22c55e;font-weight:600">● جلستك الحالية</span>'
          : `<button onclick="forceKickSession('${sid}','${escHtml(name)}')" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#dc2626;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:Cairo,sans-serif">⏏ إنهاء الجلسة</button>`
        }
      </td>
    </tr>`;
  }).join('');
  const html=active.length===0
    ? '<div style="text-align:center;padding:30px;color:var(--s400)">لا توجد جلسات نشطة حالياً</div>'
    : `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--b50)">
          <th style="padding:8px 12px;text-align:right">المستخدم</th>
          <th style="padding:8px 12px;text-align:right">الدور</th>
          <th style="padding:8px 12px;text-align:right">الجهاز</th>
          <th style="padding:8px 12px;text-align:right">آخر نشاط</th>
          <th style="padding:8px 12px;text-align:center">إجراء</th>
        </tr></thead><tbody>${rows}</tbody>
      </table>`;
  const m=document.createElement('div');
  m.className='modal-ov show';
  m.innerHTML=`<div class="modal" style="max-width:700px;width:96%">
    <div class="modal-hd">
      <div class="modal-title">🖥️ الجلسات النشطة (${active.length})</div>
      <button class="modal-close" onclick="this.closest('.modal-ov').remove()">✕</button>
    </div>
    <p style="font-size:12px;color:var(--s400);margin-bottom:12px">تتجدد كل 10 ثوانٍ — الجلسة تنتهي تلقائياً بعد 30 ثانية من انقطاع الاتصال</p>
    ${html}
    <div style="margin-top:16px;text-align:left">
      <button onclick="this.closest('.modal-ov').remove()" class="btn btn-secondary">إغلاق</button>
    </div>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  document.body.appendChild(m);
}

function forceKickSession(sid, userName){
  showConfirm(`إنهاء جلسة <b>${userName}</b> وإخراجه من النظام؟`,()=>{
    const sessions=_getActiveSessions();
    delete sessions[sid];
    _setActiveSessions(sessions);
    // إخبار التبويبات الأخرى عبر BroadcastChannel
    try{ if(_sessionChannel) _sessionChannel.postMessage({type:'kicked',sessionId:sid}); }catch(e){}
    addAudit('security',`🚨 إنهاء جلسة قسري: ${userName}`,`المدير أنهى الجلسة يدوياً`);
    toast(`✅ تم إنهاء جلسة ${userName}`,'ok');
    // أغلق المودال
    document.querySelector('.modal-ov')?.remove();
  },'⏏');
}
function recordEmpFailedAttempt(id,name){
  const d=getEmpAttempts(id);
  d.count=(d.count||0)+1;
  const ts=new Date().toLocaleString('ar-SA');
  if(d.count>=5){
    d.suspended=true;d.count=0;
    const u=registeredUsers.find(x=>x.id===id);
    if(u){u.status='inactive';saveUsersToLS();USERS=registeredUsers.map(x=>({id:x.id,name:x.name,user:x.user,pass:x.pass,role:x.role,avatar:x.role==='admin'?'👑':'👤',color:x.role==='admin'?'#dc2626':'#d97706'}));}
    setEmpAttempts(id,d);
    sendBreachAlertEmail(name,5,ts);
    addAudit('security','🚨 اختراق - تعليق حساب: '+name, 'النظام | '+ts);
    toast('🔒 تم تعليق الحساب بسبب المحاولات المتكررة. تم تنبيه مدير النظام','err');
    return true;
  }
  const rem=5-d.count;
  setEmpAttempts(id,d);
  if(d.count>=3){
    addAudit('security','⚠️ محاولة دخول مشبوهة: '+name+' ('+d.count+'/5)', 'النظام | '+ts);
    const ae=lsLoad('cc_admin_alert_email','');
    if(ae) showBreachAlert(name,d.count,ae,ts);
  }
  toast('❌ بيانات الدخول غير صحيحة. تبقى '+rem+' من أصل 5 محاولات','err');
  return false;
}
function toggleUserStatus(id){
  const u=registeredUsers.find(x=>x.id===id);
  if(!u){toast('❌ المستخدم غير موجود','err');return;}
  const wasActive=u.status==='active';
  u.status=wasActive?'inactive':'active';
  if(!wasActive)setEmpAttempts(id,{count:0,suspended:false});
  saveUsersToLS();
  USERS=registeredUsers.map(x=>({id:x.id,name:x.name,user:x.user,pass:x.pass,role:x.role,avatar:x.role==='admin'?'👑':'👤',color:x.role==='admin'?'#dc2626':'#d97706'}));
  renderUsersTable();
  addAudit('users',wasActive?'تعليق حساب: '+u.name:'تنشيط حساب: '+u.name,appState.user?.name||'Admin');
  toast(wasActive?'⏸ تم تعليق حساب '+u.name:'✅ تم تنشيط حساب '+u.name,'ok');
}
/*  API KEY OBFUSCATION  */
function _getDeviceSeed(){const fp=[navigator.userAgent,screen.width,screen.height,navigator.language,new Date().getTimezoneOffset()].join('|');return fp.split('').reduce((a,c,i)=>a+c.charCodeAt(0)*(i+1),0);}
async function obfuscateKey(str){
  if(!str) return '';
  try{
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(CC_SALT.padEnd(32,'_').slice(0,32)),
      {name:'AES-GCM'}, false, ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt(
      {name:'AES-GCM', iv},
      key,
      new TextEncoder().encode(str)
    );
    const combined = new Uint8Array(iv.byteLength + enc.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(enc), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  }catch(e){ return btoa(str||''); }
}
async function deobfuscateKey(enc){
  if(!enc) return '';
  try{
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(CC_SALT.padEnd(32,'_').slice(0,32)),
      {name:'AES-GCM'}, false, ['decrypt']
    );
    const combined = Uint8Array.from(atob(enc), c=>c.charCodeAt(0));
    const iv  = combined.slice(0,12);
    const data = combined.slice(12);
    const dec = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, data);
    return new TextDecoder().decode(dec);
  }catch(e){ return ''; }
}

// ══════════════════════════════════════════════════════════════
// 🔐 LOCAL STORAGE ENCRYPTION — AES-GCM
// المفتاح يُشتَق من بيانات الجهاز — لا يُخزَّن في localStorage
// ══════════════════════════════════════════════════════════════
let _lsKeyCache = null;
async function _getLsKey(){
  if(_lsKeyCache) return _lsKeyCache;
  const fp = (navigator.userAgent||'') + (screen.width||0) + (screen.height||0) + (navigator.language||'');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('CC_LS_KEY::'+fp));
  _lsKeyCache = await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
  return _lsKeyCache;
}
async function lsEncrypt(val){
  try{
    const key = await _getLsKey();
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify(val)));
    const buf = new Uint8Array(iv.byteLength + enc.byteLength);
    buf.set(iv, 0); buf.set(new Uint8Array(enc), iv.byteLength);
    return 'ENC:' + btoa(String.fromCharCode(...buf));
  }catch(e){ return JSON.stringify(val); }
}
async function lsDecrypt(str){
  if(!str || !str.startsWith('ENC:')) return JSON.parse(str||'null');
  try{
    const key  = await _getLsKey();
    const buf  = Uint8Array.from(atob(str.slice(4)), c=>c.charCodeAt(0));
    const iv   = buf.slice(0,12), data = buf.slice(12);
    const dec  = await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, data);
    return JSON.parse(new TextDecoder().decode(dec));
  }catch(e){ return null; }
}
async function saveSettings(){if(!requireAuth('saveSettings'))return;
  const rawKey=$('settingsApiKey').value.trim();
  appState.settings.apiKey=rawKey;
  appState.settings.apiKeyEnc=await obfuscateKey(rawKey);
  appState.settings.enableAi = $('enableAiToggle') ? $('enableAiToggle').checked : true;
  appState.settings.template=$('defaultTemplate').value;
  appState.settings.orgName=$('settingsOrgName').value.trim();
  const urlField=$('settingsOrgLogoUrl').value.trim();if(urlField)appState.settings.orgLogo=urlField;
  const toSave={...appState.settings, apiKey:''}; // لا نحفظ المفتاح نصاً
  lsSave(LS.settings,toSave);
  if(isSupabaseReady && isSupabaseReady()) sbSaveSettings('system', toSave);
  applySidebarBrand();addAudit('user','تعديل إعدادات النظام','');
  // مؤشر بصري على زر الحفظ
  // تم إزالة تفعيل جميع الأزرار لتجنب الارتباك البصري
  toast('✅ تم حفظ الإعدادات','ok');
}
async function loadSettingsFields(){
  try{
    var eu=document.getElementById('sbUrlInput'),ek=document.getElementById('sbKeyInput');
    var su=window.SUPABASE_URL||'',sk=window.SUPABASE_KEY||'';
    if(eu) eu.value=(su!=='YOUR_SUPABASE_URL')?su:'';
    if(ek) ek.value=(sk!=='YOUR_SUPABASE_ANON_KEY')?sk:'';
    if(typeof window.updateSBStatus==='function') window.updateSBStatus();
  }catch(e){}
  const s=appState.settings;const k=$('settingsApiKey'),t=$('defaultTemplate'),n=$('settingsOrgName'),u=$('settingsOrgLogoUrl');const realKey=s.apiKey||(s.apiKeyEnc?await deobfuscateKey(s.apiKeyEnc):'');if(k)k.value=realKey;appState.settings.apiKey=realKey;if(t)t.value=s.template||'';
if($('enableAiToggle')){ $('enableAiToggle').checked = s.enableAi !== false; }if(n){n.value=s.orgName||'';previewOrgName(n.value);}if(u&&s.orgLogo&&!s.orgLogo.startsWith('data:'))u.value=s.orgLogo;if(s.orgLogo){const img=$('logoPreviewImg'),em=$('logoPreviewEmoji');if(img&&em){img.src=s.orgLogo;img.style.display='block';em.style.display='none';}} loadAdminProfileFields(); loadWaSettingsFields();}
function applySidebarBrand(){
  const name=appState.settings.orgName||'', sysLogo=appState.settings.orgLogo||'';
  // إذا كان الموظف لديه شعار مخصص → استخدمه بدلاً من شعار النظام
  let logo=sysLogo;
  if(appState.user && appState.user.role==='subuser'){
    const empUser=registeredUsers.find(u=>u.id===appState.user.id);
    if(empUser && empUser.customLogo) logo=empUser.customLogo;
  }
  sv('sbLogoText',name||'Customer Care');sv('sbLogoSub',name?'':'Customer Care');
  const iconEl=$('sbLogoIcon');if(iconEl)iconEl.innerHTML=logo?`<img src="${logo}" alt="شعار" onerror="this.parentElement.innerHTML='<img src=\'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+CiAgPCEtLSBCYWNrZ3JvdW5kIGNpcmNsZSAtLT4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojM2I4MmY2Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzFkNGVkOCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9InVybCgjYmcpIi8+CiAgPCEtLSBIZWFkIHNpbGhvdWV0dGUgLS0+CiAgPGNpcmNsZSBjeD0iMzIiIGN5PSIyMiIgcj0iOSIgZmlsbD0iI2ZmZiIvPgogIDwhLS0gSGVhZHNldCBhcmMgLS0+CiAgPHBhdGggZD0iTTE4IDI2IFExOCAxMyAzMiAxMyBRNDYgMTMgNDYgMjYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8IS0tIExlZnQgZWFyIGN1cCAtLT4KICA8cmVjdCB4PSIxNCIgeT0iMjQiIHdpZHRoPSI3IiBoZWlnaHQ9IjEwIiByeD0iMy41IiBmaWxsPSIjZmZmIi8+CiAgPCEtLSBSaWdodCBlYXIgY3VwIC0tPgogIDxyZWN0IHg9IjQzIiB5PSIyNCIgd2lkdGg9IjciIGhlaWdodD0iMTAiIHJ4PSIzLjUiIGZpbGw9IiNmZmYiLz4KICA8IS0tIE1pYyBhcm0gLS0+CiAgPHBhdGggZD0iTTQzIDMyIFE0NyAzNiA0NCA0MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPCEtLSBNaWMgZG90IC0tPgogIDxjaXJjbGUgY3g9IjQ0IiBjeT0iNDMiIHI9IjIuNSIgZmlsbD0iI2ZmZiIvPgogIDwhLS0gQ2hhdCBidWJibGUgaGludCAtLT4KICA8cGF0aCBkPSJNMjAgNDYgUTIwIDQxIDI2IDQxIEwzOCA0MSBRNDQgNDEgNDQgNDYgUTQ0IDUxIDM4IDUxIEwyNiA1MSBRMjAgNTEgMjAgNDZaIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMjUpIi8+CiAgPGNpcmNsZSBjeD0iMjciIGN5PSI0NiIgcj0iMS41IiBmaWxsPSIjZmZmIi8+CiAgPGNpcmNsZSBjeD0iMzIiIGN5PSI0NiIgcj0iMS41IiBmaWxsPSIjZmZmIi8+CiAgPGNpcmNsZSBjeD0iMzciIGN5PSI0NiIgcj0iMS41IiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=\' style=\'width:100%;height:100%;object-fit:cover;\'>'" loading="lazy">`:'<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+CiAgPCEtLSBCYWNrZ3JvdW5kIGNpcmNsZSAtLT4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojM2I4MmY2Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzFkNGVkOCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9InVybCgjYmcpIi8+CiAgPCEtLSBIZWFkIHNpbGhvdWV0dGUgLS0+CiAgPGNpcmNsZSBjeD0iMzIiIGN5PSIyMiIgcj0iOSIgZmlsbD0iI2ZmZiIvPgogIDwhLS0gSGVhZHNldCBhcmMgLS0+CiAgPHBhdGggZD0iTTE4IDI2IFExOCAxMyAzMiAxMyBRNDYgMTMgNDYgMjYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8IS0tIExlZnQgZWFyIGN1cCAtLT4KICA8cmVjdCB4PSIxNCIgeT0iMjQiIHdpZHRoPSI3IiBoZWlnaHQ9IjEwIiByeD0iMy41IiBmaWxsPSIjZmZmIi8+CiAgPCEtLSBSaWdodCBlYXIgY3VwIC0tPgogIDxyZWN0IHg9IjQzIiB5PSIyNCIgd2lkdGg9IjciIGhlaWdodD0iMTAiIHJ4PSIzLjUiIGZpbGw9IiNmZmYiLz4KICA8IS0tIE1pYyBhcm0gLS0+CiAgPHBhdGggZD0iTTQzIDMyIFE0NyAzNiA0NCA0MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPCEtLSBNaWMgZG90IC0tPgogIDxjaXJjbGUgY3g9IjQ0IiBjeT0iNDMiIHI9IjIuNSIgZmlsbD0iI2ZmZiIvPgogIDwhLS0gQ2hhdCBidWJibGUgaGludCAtLT4KICA8cGF0aCBkPSJNMjAgNDYgUTIwIDQxIDI2IDQxIEwzOCA0MSBRNDQgNDEgNDQgNDYgUTQ0IDUxIDM4IDUxIEwyNiA1MSBRMjAgNTEgMjAgNDZaIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMjUpIi8+CiAgPGNpcmNsZSBjeD0iMjciIGN5PSI0NiIgcj0iMS41IiBmaWxsPSIjZmZmIi8+CiAgPGNpcmNsZSBjeD0iMzIiIGN5PSI0NiIgcj0iMS41IiBmaWxsPSIjZmZmIi8+CiAgPGNpcmNsZSBjeD0iMzciIGN5PSI0NiIgcj0iMS41IiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">';
}
function previewOrgName(val){const el=$('logoPreviewName');if(el)el.textContent=val||'اسم شركتك';}
function previewOrgLogo(type,val){const emoji=$('logoPreviewEmoji'),img=$('logoPreviewImg');if(!emoji||!img)return;if(type==='url'){if(!val){img.style.display='none';emoji.style.display='';return;}img.src=val;img.style.display='block';emoji.style.display='none';img.onerror=()=>{img.style.display='none';emoji.style.display='';};appState.settings.orgLogo=val;}else if(type==='file'&&val.files&&val.files[0]){const reader=new FileReader();reader.onload=e=>{appState.settings.orgLogo=e.target.result;lsSave(LS.settings,appState.settings);if(img){img.src=e.target.result;img.style.display='block';}if(emoji)emoji.style.display='none';const u=$('settingsOrgLogoUrl');if(u)u.value='';applySidebarBrand();};reader.readAsDataURL(val.files[0]);}}
function clearOrgLogo(){appState.settings.orgLogo='';lsSave(LS.settings,appState.settings);const emoji=$('logoPreviewEmoji'),img=$('logoPreviewImg'),u=$('settingsOrgLogoUrl');if(emoji)emoji.style.display='';if(img){img.style.display='none';img.src='';}if(u)u.value='';applySidebarBrand();}

/*  WA TEMPLATES  */
// ── مفتاح القوالب خاص بكل مستخدم لمنع تسريب البيانات بين الموظفين ──
function _tplKey(){ return 'cc_templates_' + (appState.user?.user || appState.user?.id || 'shared'); }
function _loadUserTemplates(){ return lsLoad(_tplKey(), []); }
function _saveUserTemplates(arr){
  lsSave(_tplKey(), arr);
  if(typeof isSupabaseReady==='function' && isSupabaseReady()){
    const sb = getSB(); if(!sb) return;
    const owner = appState.user?.user || 'shared';
    sb.from('cc_settings')
      .upsert({key:'cc_templates_'+owner, value:arr, updated_at:new Date().toISOString()},{onConflict:'key'})
      .then(({error})=>{
        if(error){
          console.warn('saveTemplate SB:', error);
          // fallback: حفظ في localStorage فقط (يحدث عند موظف بدون صلاحية Supabase)
          lsSave(_tplKey(), arr);
        }
      });
  }
}

let waTemplates = [];   // يُملأ بعد تسجيل الدخول في initUserTemplates()
async function initUserTemplates(){
  if(typeof isSupabaseReady==='function' && isSupabaseReady()){
    try {
      const sb = getSB();
      const owner = appState.user?.user || 'shared';
      const {data, error} = await sb.from('cc_settings')
        .select('value').eq('key','cc_templates_'+owner).single();
      if(!error && Array.isArray(data?.value)){
        waTemplates = data.value;
        appState.templates = waTemplates;
        lsSave(_tplKey(), waTemplates);
        if(typeof renderTemplates==='function') renderTemplates();
        if(typeof renderTplPanel==='function') renderTplPanel();
        return;
      }
    } catch(e){ console.warn('initUserTemplates SB:', e); }
  }
  waTemplates = _loadUserTemplates();
  appState.templates = waTemplates;
}
function saveTemplate(){
  const name=$('tplName').value.trim(),msg1=$('tplMsg1').value.trim();
  if(!name||!msg1){waToast('error','❌ اسم القالب والرسالة الأساسية مطلوبان');return;}
  waTemplates.push({id:Date.now(),name,msg1,msg2:$('tplMsg2').value.trim(),msg3:$('tplMsg3').value.trim()});
  appState.templates=waTemplates;_saveUserTemplates(waTemplates);
  ['tplName','tplMsg1','tplMsg2','tplMsg3'].forEach(id=>{const e=$(id);if(e)e.value='';});
  renderTemplates();renderTplPanel();waToast('success','✅ تم حفظ القالب');
}
function renderTemplates(){
  const grid=$('tplGrid'),empty=$('tplEmpty'),count=$('tplCount');
  if(!grid)return;sv('tplCount',waTemplates.length);
  if(!waTemplates.length){grid.innerHTML='';if(empty){empty.style.display='flex';}return;}
  if(empty)empty.style.display='none';
  grid.innerHTML=waTemplates.map(t=>`
    <div class="tpl-card">
      <div class="tpl-card-header">
        <span class="tpl-card-name">📝 ${escHtml(t.name)}</span>
        <div class="tpl-card-actions">
          <button class="tpl-del-btn" onclick="deleteTpl(${t.id})" title="حذف القالب">🗑</button>
        </div>
      </div>
      <div class="tpl-card-body">
        ${t.msg1?`<div class="tpl-card-msg"><span class="tpl-msg-badge tpl-msg-1">1</span><span class="tpl-card-msg-text">${escHtml(t.msg1)}</span></div>`:''}
        ${t.msg2?`<div class="tpl-card-msg"><span class="tpl-msg-badge tpl-msg-2">2</span><span class="tpl-card-msg-text">${escHtml(t.msg2)}</span></div>`:''}
        ${t.msg3?`<div class="tpl-card-msg"><span class="tpl-msg-badge tpl-msg-3">3</span><span class="tpl-card-msg-text">${escHtml(t.msg3)}</span></div>`:''}
      </div>
      <div class="tpl-card-footer">
        <button class="tpl-apply-btn" onclick="applyTemplate(${t.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          تطبيق على المحددة
        </button>
      </div>
    </div>`).join('');
}
function deleteTpl(id){waTemplates=waTemplates.filter(t=>t.id!==id);appState.templates=waTemplates;_saveUserTemplates(waTemplates);renderTemplates();renderTplPanel();waToast('info','🗑️ تم الحذف');}
function toggleTplPanel(){
  const panel=document.getElementById('wa-tplPanel');
  if(!panel)return;
  const show=panel.classList.toggle('show');
  const btn=document.getElementById('wa-tplToggleBtn');
  if(btn)btn.style.background=show?'linear-gradient(135deg,rgba(155,89,182,.35),rgba(124,58,237,.35))':'';
  if(show)renderTplPanel();
}
function renderTplPanel(){
  const grid=document.getElementById('wa-tplPanelGrid');
  const empty=document.getElementById('wa-tplPanelEmpty');
  if(!grid)return;
  if(!waTemplates.length){grid.innerHTML='';if(empty)empty.style.display='block';return;}
  if(empty)empty.style.display='none';
  grid.innerHTML=waTemplates.map(t=>`
    <div class="wa-tpl-item" style="cursor:default;padding-bottom:38px;">
      <div class="wa-tpl-item-name">📝 ${escHtml(t.name)}</div>
      <div class="wa-tpl-item-prev">
        ${t.msg1?`<div style="color:#a3b8a8;margin-bottom:2px;"><span style="background:rgba(37,211,102,.2);color:#25D366;border-radius:50%;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;margin-left:3px;">1</span>${escHtml(t.msg1.slice(0,50))}${t.msg1.length>50?'…':''}</div>`:''}
        ${t.msg2?`<div style="color:#7cb88a;opacity:.85;margin-bottom:2px;"><span style="background:rgba(52,152,219,.2);color:#3498db;border-radius:50%;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;margin-left:3px;">2</span>${escHtml(t.msg2.slice(0,40))}${t.msg2.length>40?'…':''}</div>`:''}
        ${t.msg3?`<div style="color:#7cb88a;opacity:.7;"><span style="background:rgba(155,89,182,.2);color:#c084fc;border-radius:50%;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;margin-left:3px;">3</span>${escHtml(t.msg3.slice(0,40))}${t.msg3.length>40?'…':''}</div>`:''}
      </div>
      <button onclick="applyTemplate(${t.id});toggleTplPanel();" style="position:absolute;bottom:6px;left:6px;right:6px;background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.35);border-radius:7px;padding:5px;font-size:12px;color:#25D366;cursor:pointer;font-family:Cairo,sans-serif;font-weight:700;transition:background .2s;display:flex;align-items:center;justify-content:center;gap:5px;" onmouseover="this.style.background='rgba(37,211,102,.28)'" onmouseout="this.style.background='rgba(37,211,102,.15)'">✅ تطبيق</button>
    </div>`).join('');
}
function applyTemplate(id){
  const t=waTemplates.find(x=>x.id===id);if(!t)return;
  const sel=waSelected.size>0?waRows.filter(r=>waSelected.has(r.id)):waRows;
  let n=0; sel.forEach(r=>{r.msg1=t.msg1||r.msg1;r.msg2=t.msg2||r.msg2;r.msg3=t.msg3||r.msg3;n++;});
  saveWaRows();renderTable();switchTab('messages');waToast('success',`✅ تم تطبيق القالب على ${n} سجل`);
}

/*  WA PREVIEW  */
function openPreview(rowId){
  const r=waRows.find(x=>x.id===rowId);if(!r)return;
  sv('pvName',r.name||r.phone||'العميل');
  const body=$('pvBody');if(!body)return;
  body.innerHTML=`<div class="wa-preview-time">${new Date().toLocaleTimeString('ar-SA')}</div>`;
  const buildBubble=msg=>{if(!msg)return'';return`<div class="preview-bubble">${escHtml(msg)}</div>`;};
  body.innerHTML+=buildBubble(r.msg1)+buildBubble(r.msg2)+buildBubble(r.msg3);
  const ov=$('wa-previewOverlay');if(ov)ov.classList.add('show');
}
function closePreview(e){if(!e||e.target.id==='wa-previewOverlay'||e.target.tagName==='BUTTON'){const ov=$('wa-previewOverlay');if(ov)ov.classList.remove('show');}}

/*  WA CORE  */
const LS_WA_CFG = 'cc_wa_cfg';
function loadWaCfg(){
  const d = lsLoad(LS_WA_CFG, {maxPerHour:40, minDelay:15});
  return {maxPerHour: Math.max(1, Math.min(200, d.maxPerHour||40)),
          minDelay:   Math.max(5, Math.min(120, d.minDelay||15))};
}
function saveWaSettings(){
  const lim = parseInt($('settingsWaLimit')?.value)||40;
  const del = parseInt($('settingsWaDelay')?.value)||15;
  const _waCfgData = {maxPerHour: Math.max(1,Math.min(200,lim)), minDelay: Math.max(5,Math.min(120,del))};
  lsSave(LS_WA_CFG, _waCfgData);
  if(typeof isSupabaseReady==='function' && isSupabaseReady()){
    sbSaveSettings('waconfig', _waCfgData);
  }
  // تحديث القيمة الحية فوراً
  window._waCfg = loadWaCfg();
  toast('✅ تم حفظ إعدادات واتساب','ok');
  addAudit('settings','تعديل إعدادات واتساب',`الحد: ${lim} رسالة/ساعة`);
}
function loadWaSettingsFields(){
  const cfg = loadWaCfg();
  const lf=$('settingsWaLimit'), df=$('settingsWaDelay');
  if(lf) lf.value = cfg.maxPerHour;
  if(df) df.value = cfg.minDelay;
}
window._waCfg = loadWaCfg();
// دالة مساعدة — القيمة الحية دائماً
function getMaxPerHour(){ return (window._waCfg||loadWaCfg()).maxPerHour; }
function getMinDelay(){    return (window._waCfg||loadWaCfg()).minDelay; }
const MAX_PER_HOUR=40; // احتياطي — يُستبدل بـ getMaxPerHour() في كل مكان
function getBulkDelay(){const d=getMinDelay();return Math.floor(Math.random()*5000)+(d*1000);}
let scheduledBulkTimer=null,scheduledBulkTimestamp=null,scheduledBulkCountdown=null;
function getRateData(){let d=lsLoad(LS.rate,{hourlyCount:0,hourlyWindowStart:null,dailyCount:0,dailyDate:''});const now=Date.now(),td=new Date().toISOString().slice(0,10);if(d.dailyDate!==td){d={hourlyCount:0,hourlyWindowStart:null,dailyCount:0,dailyDate:td};lsSave(LS.rate,d);}if(d.hourlyWindowStart&&now-d.hourlyWindowStart>=3600000){d.hourlyCount=0;d.hourlyWindowStart=null;lsSave(LS.rate,d);}return{...d};}
function incSend(){const d=getRateData();if(!d.hourlyWindowStart)d.hourlyWindowStart=Date.now();d.hourlyCount++;d.dailyCount++;lsSave(LS.rate,d);return d;}
function isLimited(){return getRateData().hourlyCount>=getMaxPerHour();}
function remaining(){return Math.max(0,getMaxPerHour()-getRateData().hourlyCount);}
function minsLeft(){const d=getRateData();if(!d.hourlyWindowStart)return 0;return Math.max(0,Math.ceil((3600000-(Date.now()-d.hourlyWindowStart))/60000));}
// waRows يُحمَّل بعد تسجيل الدخول بمفتاح خاص بكل مستخدم (في initWaPage)
let waRows=[];
function saveWaRows(){
  const ownerKey = appState.user?.user || 'admin';
  lsSave('cc_wa_' + ownerKey, waRows);
  if(isSupabaseReady && isSupabaseReady()){
    const sb = getSB(); if(!sb) return;
    // استخدام UPSERT بدلاً من DELETE+INSERT لتجنب مشاكل RLS مع DELETE
    sb.from('cc_warows')
      .upsert(
        { ownerusername: ownerKey, rowdata: waRows, updated_at: new Date().toISOString() },
        { onConflict: 'ownerusername' }
      )
      .then(({error})=>{
        if(error){
          console.error('saveWaRows upsert:', error);
          lsSave('cc_wa_' + ownerKey, waRows);
        }
      });
  }
}

let waSelected=new Set(), wa_idCtr=100, waBulkQueue=[], _waInited=false, _rtDebounce=null, _waNameSort=null; // null | 'asc' | 'desc'
let _waCurrentOwner = null; // مالك الصفوف الحالي لمنع التلوث بين المستخدمين
function sortWaByName(){_waNameSort=_waNameSort==='asc'?'desc':_waNameSort==='desc'?null:'asc';renderTable();}
// ✅ waUsers يُحمَّل ديناميكياً من registeredUsers بدلاً من القيم الثابتة لمنع تسريب البيانات
let waUsers = [];
function _syncWaUsers(){
  waUsers = (typeof registeredUsers !== 'undefined' ? registeredUsers : []).map(u=>({
    username: u.user, role: u.role, fullName: u.name, phone: u.phone||'', email: u.email||''
  }));
}

function waToast(type,msg){const d=document.createElement('div');d.className=`wa-toast ${type}`;d.textContent=msg;const c=$('wa-toastContainer');if(c)c.appendChild(d);setTimeout(()=>d.remove(),3500);}
function initWaPage(){
  _syncWaUsers();
  const ownerKey = appState.user?.user || 'admin';

  // إذا تغير المستخدم أو لم تُحمَّل البيانات بعد → أعد التحميل
  if(_waCurrentOwner !== ownerKey){
    _waCurrentOwner = ownerKey;
    _waInited = false;
    // حمّل من localStorage أولاً (سرعة)
    waRows = lsLoad('cc_wa_' + ownerKey, []);
    waRows = waRows.map(r=>({...r, id:Number(r.id)}));
    wa_idCtr = waRows.length ? Math.max(...waRows.map(r=>r.id))+1 : 100;
    waSelected = new Set();

    // ثم حمّل من Supabase (أحدث)
    if(isSupabaseReady && isSupabaseReady()){
      const sb = getSB();
      if(sb){
        sb.from('cc_warows')
          .select('rowdata')
          .eq('ownerusername', ownerKey)
          .single()
          .then(({data: waData, error}) => {
            if(!error && waData?.rowdata){
              // تحقق أن المستخدم لم يتغير أثناء الانتظار
              if(_waCurrentOwner !== ownerKey) return;
              waRows = waData.rowdata.map(r=>({...r, id:Number(r.id)}));
              wa_idCtr = waRows.length ? Math.max(...waRows.map(r=>r.id))+1 : 100;
              lsSave('cc_wa_' + ownerKey, waRows);
              renderStats(); renderTable();
            }
          });
      }
    }
  }

  if(!_waInited){ _waInited=true; }
  // أعد تحميل القوالب الخاصة بهذا المستخدم في كل مرة يفتح صفحة واتساب
  if(typeof initUserTemplates === 'function') initUserTemplates();
  const isAdmin=appState.user?.role==='admin';
  const tabCtrl=$('wa-tabControl');if(tabCtrl)tabCtrl.style.display=isAdmin?'':'none';
  const tabMySettings=$('wa-tabMySettings');if(tabMySettings)tabMySettings.style.display=isAdmin?'none':'';
  renderStats();renderTable();renderTemplates();if(isAdmin)renderCP();
}
function buildWaLink(r){let msg=r.msg1||'';if(r.msg2)msg+='\n'+r.msg2;if(r.msg3)msg+='\n'+r.msg3;return'https://api.whatsapp.com/send/?phone='+encodeURIComponent((r.phone||'').trim())+'&text='+encodeURIComponent(msg)+'&type=phone_number&app_absent=0';}

function renderStats(){
  const mph=getMaxPerHour();
  const rd=getRateData(),pct=Math.min(100,(rd.hourlyCount/mph)*100);
  const barColor=pct<60?'#25D366':pct<85?'#f39c12':'#e74c3c';
  const dangerClass=pct>=100?'danger':'';
  // تحديث الحد في footer الجدول
  const fl=$('wa-footerLimit'); if(fl) fl.textContent=mph;
  const sb=$('wa-statsBar');if(!sb)return;
  sb.innerHTML=`<div class="stat-card"><div class="stat-icon si-green">📋</div><div><span class="stat-val">${waRows.length}</span><span class="stat-label">إجمالي السجلات</span></div></div><div class="stat-card"><div class="stat-icon si-blue">✅</div><div><span class="stat-val">${waRows.filter(r=>r.phone&&r.phone.trim()).length}</span><span class="stat-label">جاهز للإرسال</span></div></div><div class="stat-card"><div class="stat-icon si-yellow">📤</div><div><span class="stat-val">${waRows.filter(r=>r.sent).length}</span><span class="stat-label">تم الإرسال</span></div></div><div class="stat-card ${dangerClass}"><div class="stat-icon si-red">⏱️</div><div style="width:100%"><span class="stat-val">${rd.hourlyCount}<span class="stat-max">/${getMaxPerHour()}</span></span><span class="stat-label">هذه الساعة</span><div class="rate-bar"><div class="rate-bar-fill" style="width:${pct}%;background:${barColor}"></div></div></div></div><div class="stat-card"><div class="stat-icon si-purple">📅</div><div><span class="stat-val">${rd.dailyCount}</span><span class="stat-label">اليوم</span></div></div>`;
  const bb=$('wa-blockedBanner');if(bb){if(pct>=100){bb.style.display='flex';bb.innerHTML=`🚫 تم الوصول للحد الأقصى. انتظر <b style="color:#fff;margin:0 4px">${minsLeft()}</b> دقيقة.`;}else bb.style.display='none';}
  const wb=$('wa-bulkBadge');if(wb)wb.textContent=waSelected.size;
}
let _waPg=1; const _WA_PS=20; // ترقيم صفحات جدول واتساب
function getFiltered(){const q=($('wa-searchInput')?.value||'').toLowerCase();if(!q)return waRows;return waRows.filter(r=>(r.phone||'').includes(q)||(r.name||'').toLowerCase().includes(q)||(r.msg1||'').toLowerCase().includes(q));}
function renderTable(pg){
  if(pg) _waPg=pg;
  const thead=$('wa-tableHead'),tbody=$('wa-tableBody');if(!thead||!tbody)return;
  const _nameArrow=_waNameSort==='asc'?'▲':_waNameSort==='desc'?'▼':'⇅';
  thead.innerHTML=`<tr><th class="th-center">☑</th><th class="th-center">#</th><th>📱 رقم الجوال</th><th>📝 ملاحظات</th><th class="wa-sort-th" onclick="sortWaByName()" title="فرز حسب الاسم">👤 الاسم <span class="wa-sort-arrow${_waNameSort?' wa-sort-active':''}">${_nameArrow}</span></th><th>💬 الرسالة الأساسية</th><th>➕ رسالة 2</th><th>➕ رسالة 3</th><th>🔁 التكرار</th><th>إرسال</th><th>الحالة</th><th>إجراءات</th></tr>`;
  const allFiltered=getFiltered(),lim=isLimited();
  // ترقيم الصفحات
  const _waTotal=allFiltered.length;
  const _waTotalPgs=Math.max(1,Math.ceil(_waTotal/_WA_PS));
  if(_waPg>_waTotalPgs)_waPg=_waTotalPgs;
  const _waStart=(_waPg-1)*_WA_PS;
  const filtered=allFiltered.slice(_waStart,_waStart+_WA_PS);
  // فرز حسب الاسم إذا كان مفعّلاً
  if(_waNameSort){
    filtered.sort((a,b)=>{
      const av=(a.name||'').trim().toLowerCase(), bv=(b.name||'').trim().toLowerCase();
      if(!av && !bv) return 0;
      if(!av) return 1;   // الفارغ يذهب للأسفل دائماً
      if(!bv) return -1;
      return _waNameSort==='asc'? av.localeCompare(bv,'ar'):bv.localeCompare(av,'ar');
    });
  }
  const phoneCount={};waRows.forEach(r=>{if(r.phone&&r.phone.trim())phoneCount[r.phone.trim()]=(phoneCount[r.phone.trim()]||0)+1;});
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="12"><div class="empty-state"><div class="empty-icon">📭</div><p>لا توجد سجلات.</p></div></td></tr>`;}
  else tbody.innerHTML=filtered.map((r,vi)=>{
    const isDup=r.phone&&r.phone.trim()&&phoneCount[r.phone.trim()]>1;
    const hasPh=r.phone&&r.phone.trim();
    const isValidPh=hasPh&&/^[0-9]{9,15}$/.test(r.phone.trim().replace(/[+\s-]/g,''));
    const status=!hasPh?'empty':isDup?'dup':!isValidPh?'invalid':r.sent?'sent':'ready';
    const statusTxt={empty:'—',dup:'⚠️ مكرر',invalid:'❌ غير صالح',ready:'✅ جاهز',sent:'📤 أُرسلت'}[status];
    const statusClass={empty:'status-empty',dup:'status-dup',invalid:'status-invalid',ready:'status-ready',sent:'status-sent'}[status];
    let sendHtml='<span style="color:#4a6b54">—</span>';
    if(hasPh && isValidPh){if(lim)sendHtml=`<span class="send-btn send-blocked">🚫</span>`;else if(r.sent)sendHtml=`<a class="send-btn send-sent" href="${buildWaLink(r)}" target="_blank" onclick="markRowSent(${r.id})">${isDup?'🔁 مكرر — ✔ أُرسلت':'✔ أُرسلت'}</a>`;else if(isDup)sendHtml=`<a class="send-btn send-ready" href="${buildWaLink(r)}" target="_blank" onclick="markRowSent(${r.id})" style="background:rgba(243,156,18,.13);border-color:rgba(243,156,18,.35);color:#f39c12;">🔁 مكرر ▶</a>`;else sendHtml=`<a class="send-btn send-ready" href="${buildWaLink(r)}" target="_blank" onclick="markRowSent(${r.id})">▶ إرسال</a>`;}
    else if(hasPh && !isValidPh)sendHtml=`<span class="send-btn" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);color:#f87171;cursor:not-allowed;pointer-events:none;">⚠ غير صالح</span>`;
    const dupHtml=!hasPh?'—':isDup?'<span class="dup-badge">✗ مكرر</span>':'—';
    const isSel=waSelected.has(Number(r.id));
    return`<tr class="${isSel?'row-selected':''}" data-id="${r.id}"><td style="text-align:center"><input type="checkbox" class="row-check" ${isSel?'checked':''} onchange="toggleWaSel(${r.id},this.checked)"/></td><td style="text-align:center"><div class="row-num">${vi+1}</div></td><td><input class="cell-input phone-input${isDup?' phone-dup':isValidPh?' phone-valid':''}" value="${esc(r.phone)}" placeholder="966xxxxxxxxx" oninput="updateRow(${r.id},'phone',this.value)"/></td><td><input class="cell-input" style="direction:rtl" value="${esc(r.notes)}" placeholder="ملاحظة..." oninput="updateRow(${r.id},'notes',this.value)"/></td><td><input class="cell-input" style="direction:rtl" value="${esc(r.name)}" placeholder="اختياري" oninput="updateRow(${r.id},'name',this.value)"/></td>${['msg1','msg2','msg3'].map(f=>`<td><div class="msg-cell"><input class="cell-input" style="direction:rtl;padding-inline-start:26px" value="${esc(r[f])}" placeholder="—" oninput="updateRow(${r.id},'${f}',this.value)"/><button class="clear-msg-btn" onclick="clearMsg(${r.id},'${f}')">✕</button></div></td>`).join('')}<td>${dupHtml}</td><td>${sendHtml}</td><td><span class="status-badge ${statusClass}">${statusTxt}</span></td><td><div class="actions-cell"><button class="act-btn act-preview" onclick="openPreview(${r.id})" title="معاينة">👁</button>${r.sent?`<button class="act-btn act-resend" onclick="resendRow(${r.id})" title="إعادة إرسال">🔁</button>`:`<button class="act-btn act-disabled" disabled>⧉</button>`}<button class="act-btn act-del" onclick="deleteRow(${r.id})">🗑</button></div></td></tr>`;
  }).join('');
  const allCh=allFiltered.length>0&&allFiltered.every(r=>waSelected.has(r.id));const selAll=$('wa-selectAll');if(selAll){selAll.checked=allCh;selAll.indeterminate=!allCh&&allFiltered.some(r=>waSelected.has(r.id));}
  sv('wa-selCount',`${waSelected.size} محدد`);
  renderPagination('wa-tablePagination',_waTotal,_waPg,p=>renderTable(p),_WA_PS);
  renderStats();
  requestAnimationFrame(_waThumb);
}
function updateRow(id,key,val){
  const r=waRows.find(r=>r.id===id);
  if(!r) return;
  if(key==='phone') val=String(val||'').replace(/[^0-9+\-\s]/g,'');
  r[key]=val;
  if(key==='phone'){
    // تحديث جراحي: فقط الخلايا المتأثرة في هذا الصف — بدون إعادة رسم الجدول كله
    _patchPhoneCells(id);
    clearTimeout(_rtDebounce);
    _rtDebounce=setTimeout(()=>{ saveWaRows(); renderStats(); },400);
  } else {
    clearTimeout(_rtDebounce);
    _rtDebounce=setTimeout(()=>{ saveWaRows(); },400);
    renderStats();
  }
}

function _patchPhoneCells(id){
  // إعادة حساب التكرار لكل الأرقام
  const phoneCount={};
  waRows.forEach(r=>{ if(r.phone&&r.phone.trim()) phoneCount[r.phone.trim()]=(phoneCount[r.phone.trim()]||0)+1; });
  const lim=isLimited();
  // تحديث كل صف تأثّر بتغيير التكرار (قد يتغير أكثر من صف)
  waRows.forEach(r=>{
    const tr=document.querySelector(`[data-id="${r.id}"]`);
    if(!tr) return;
    const isDup  = r.phone&&r.phone.trim()&&phoneCount[r.phone.trim()]>1;
    const hasPh  = r.phone&&r.phone.trim();
    const isValidPh = hasPh&&/^[0-9]{9,15}$/.test(r.phone.trim().replace(/[+\s-]/g,''));
    const status = !hasPh?'empty':isDup?'dup':!isValidPh?'invalid':r.sent?'sent':'ready';
    const statusTxt  = {empty:'—',dup:'⚠️ مكرر',invalid:'❌ غير صالح',ready:'✅ جاهز',sent:'📤 أُرسلت'}[status];
    const statusClass= {empty:'status-empty',dup:'status-dup',invalid:'status-invalid',ready:'status-ready',sent:'status-sent'}[status];
    // خلية رقم الجوال: تحديث class فقط (القيمة يكتبها المستخدم مباشرة)
    const inp=tr.querySelector('.phone-input');
    if(inp){
      inp.className='cell-input phone-input'+(isDup?' phone-dup':isValidPh?' phone-valid':'');
    }
    // خلية الحالة
    const badge=tr.querySelector('.status-badge');
    if(badge){ badge.className='status-badge '+statusClass; badge.textContent=statusTxt; }
    // خلية الإرسال (td الثاني من الأخير)
    const tds=tr.querySelectorAll('td');
    const sendTd=tds[tds.length-3];
    if(sendTd){
      if(!hasPh||!isValidPh){
        if(!hasPh) sendTd.innerHTML='<span style="color:#4a6b54">—</span>';
        else sendTd.innerHTML=`<span class="send-btn" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);color:#f87171;cursor:not-allowed;pointer-events:none;">⚠ غير صالح</span>`;
      } else if(r.sent){
        sendTd.innerHTML=`<a class="send-btn send-sent" href="${buildWaLink(r)}" target="_blank" onclick="markRowSent(${r.id})">${isDup?'🔁 مكرر — ✔ أُرسلت':'✔ أُرسلت'}</a>`;
      } else if(lim){
        sendTd.innerHTML=`<span class="send-btn send-blocked">🚫</span>`;
      } else if(isDup){
        sendTd.innerHTML=`<a class="send-btn send-ready" href="${buildWaLink(r)}" target="_blank" onclick="markRowSent(${r.id})" style="background:rgba(243,156,18,.13);border-color:rgba(243,156,18,.35);color:#f39c12;">🔁 مكرر ▶</a>`;
      } else {
        sendTd.innerHTML=`<a class="send-btn send-ready" href="${buildWaLink(r)}" target="_blank" onclick="markRowSent(${r.id})">▶ إرسال</a>`;
      }
    }
    // خلية التكرار
    const dupTd=tds[tds.length-4];
    if(dupTd){
      dupTd.innerHTML=!hasPh?'—':isDup?'<span class="dup-badge">✗ مكرر</span>':'—';
    }
  });
}
function addRow(){waRows.push({id:++wa_idCtr,phone:'',notes:'',name:'',msg1:'',msg2:'',msg3:'',sent:false});saveWaRows();renderTable();}
function deleteRow(id){waRows=waRows.filter(r=>r.id!==id);waSelected.delete(id);saveWaRows();renderTable();}
function clearMsg(id,field){updateRow(id,field,'');}
function markRowSent(id){if(isLimited()){waToast('error','🚫 تم الوصول للحد الأقصى');return;}const r=waRows.find(r=>r.id===id);if(!r)return;r.sent=true;incSend();saveWaRows();setTimeout(()=>renderTable(),50);}
function resendRow(id){if(isLimited()){waToast('error','🚫 الحد الأقصى');return;}const r=waRows.find(r=>r.id===id);if(!r)return;window.open(buildWaLink(r),'_blank');incSend();waToast('info','🔁 تم إعادة الإرسال');renderStats();}
function clearAllWa(){if(!waRows.length){waToast('info','لا توجد سجلات');return;}showConfirm('مسح <b>جميع</b> سجلات واتساب؟',()=>{waRows=[];waSelected=new Set();wa_idCtr=100;saveWaRows();renderTable();},'🗑');}
function toggleWaSel(id,chk){const n=Number(id);if(chk)waSelected.add(n);else waSelected.delete(n);const tr=document.querySelector(`#wa-tableBody tr[data-id="${n}"]`);if(tr){tr.classList.toggle('row-selected',chk);}sv('wa-selCount',`${waSelected.size} محدد`);const f=getFiltered();const allCh=f.length>0&&f.every(r=>waSelected.has(Number(r.id)));const sa=$('wa-selectAll');if(sa){sa.checked=allCh;sa.indeterminate=!allCh&&f.some(r=>waSelected.has(Number(r.id)));}}
function toggleAll(chk){getFiltered().forEach(r=>{if(chk)waSelected.add(Number(r.id));else waSelected.delete(Number(r.id));});document.querySelectorAll('#wa-tableBody tr[data-id]').forEach(tr=>{const id=Number(tr.getAttribute('data-id'));tr.classList.toggle('row-selected',waSelected.has(id));const cb=tr.querySelector('.row-check');if(cb)cb.checked=waSelected.has(id);});sv('wa-selCount',`${waSelected.size} محدد`);}
function deleteSelected(){const n=waSelected.size;if(!n){waToast('warning','حدد سجلاً');return;}showConfirm(`حذف <b>${n}</b> سجل محدد؟`,()=>{waRows=waRows.filter(r=>!waSelected.has(Number(r.id)));waSelected=new Set();saveWaRows();renderTable();});}
function markSelectedSent(){if(!waSelected.size){waToast('warning','لم تحدد أي سجل');return;}const n=waSelected.size;waRows.forEach(r=>{if(waSelected.has(r.id))r.sent=true;});saveWaRows();renderTable();waToast('success',`✅ تعليم ${n} كمرسل`);}
function openBulkModal(){
  const phoneCount2={};waRows.forEach(r=>{if(r.phone&&r.phone.trim())phoneCount2[r.phone.trim()]=(phoneCount2[r.phone.trim()]||0)+1;});
  const ready=getFiltered().filter(r=>waSelected.has(r.id)&&r.phone&&r.phone.trim()&&/^[0-9]{9,15}$/.test(r.phone.trim().replace(/[+\s-]/g,''))&&phoneCount2[r.phone.trim()]===1);if(!ready.length){waToast('error','لا توجد سجلات جاهزة محددة');return;}const rem=remaining();if(rem<=0){waToast('error','🚫 الحد الأقصى. انتظر '+minsLeft()+' دقيقة.');return;}waBulkQueue=ready.slice(0,rem);const mb=$('wa-bulkModalBody');if(mb)mb.innerHTML=`سيتم إرسال <b>${waBulkQueue.length}</b> رسالة<br><small style='color:#a3b8a8'>تأخير عشوائي 15–20 ثانية</small>`;const dtInput=$('wa-schedDatetime');if(dtInput){const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());dtInput.min=now.toISOString().slice(0,16);const def=new Date(Date.now()+60*60*1000);def.setMinutes(def.getMinutes()-def.getTimezoneOffset());dtInput.value=def.toISOString().slice(0,16);}const preset=$('wa-schedPreset');if(preset)preset.value='60';const customRow=$('wa-schedCustomRow');if(customRow)customRow.style.display='none';waSchedUpdateInfo();$('wa-schedCountdownBox').style.display='none';const actDiv=document.querySelector('#wa-bulkModal .modal-actions');if(actDiv)actDiv.style.display='flex';$('wa-schedBox').style.display='block';const bm=$('wa-bulkModal');if(bm)bm.classList.add('show');}

/*  WA SCHEDULER  */
function waSchedPresetChange(){const v=$('wa-schedPreset')?.value;const cr=$('wa-schedCustomRow');if(v==='custom'){if(cr)cr.style.display='flex';}else{if(cr)cr.style.display='none';if(v!=='0'){const dt=$('wa-schedDatetime');if(dt){const t=new Date(Date.now()+parseInt(v)*60000);t.setMinutes(t.getMinutes()-t.getTimezoneOffset());dt.value=t.toISOString().slice(0,16);}}}waSchedUpdateInfo();}
function waSchedGetTargetMs(){const v=$('wa-schedPreset')?.value;if(v==='0')return 0;if(v==='custom'){const raw=$('wa-schedDatetime')?.value;if(!raw)return 0;const ts=new Date(raw).getTime();return ts>Date.now()?ts:0;}return Date.now()+parseInt(v)*60000;}
function waSchedUpdateInfo(){const info=$('wa-schedInfo');if(!info)return;const v=$('wa-schedPreset')?.value;if(v==='0'){info.innerHTML='🚀 سيبدأ الإرسال فوراً';const btn=$('wa-schedConfirmBtn');if(btn)btn.textContent='✅ ابدأ الإرسال الآن';return;}const targetMs=waSchedGetTargetMs();if(!targetMs){info.innerHTML='<span style="color:#f87171">⚠️ وقت غير صالح</span>';return;}const diff=targetMs-Date.now();const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);const timeStr=new Date(targetMs).toLocaleString('ar-SA');info.innerHTML=`📅 سيُرسَل في: <b style="color:#25D366">${timeStr}</b> (بعد ${h>0?h+' ساعة و':''}${m} دقيقة)`;const btn=$('wa-schedConfirmBtn');if(btn)btn.textContent='📅 جدولة الإرسال';}
function scheduleOrSendBulk(){const targetMs=waSchedGetTargetMs();if(targetMs===0||targetMs-Date.now()<5000){startBulkSend();return;}if(targetMs-Date.now()>24*3600000){waToast('error','⚠️ لا يمكن الجدولة لأكثر من 24 ساعة');return;}scheduledBulkTimestamp=targetMs;$('wa-schedBox').style.display='none';$('wa-schedCountdownBox').style.display='block';const actDiv=document.querySelector('#wa-bulkModal .modal-actions');if(actDiv)actDiv.style.display='none';clearInterval(scheduledBulkCountdown);scheduledBulkCountdown=setInterval(()=>{const rem=scheduledBulkTimestamp-Date.now();if(rem<=0){clearInterval(scheduledBulkCountdown);closeBulkModal();startBulkSend();waToast('success','⏰ انطلق الإرسال المجدول!');return;}const hh=String(Math.floor(rem/3600000)).padStart(2,'0');const mm=String(Math.floor((rem%3600000)/60000)).padStart(2,'0');const ss=String(Math.floor((rem%60000)/1000)).padStart(2,'0');sv('wa-schedCountdown',`${hh}:${mm}:${ss}`);},1000);const timeStr=new Date(targetMs).toLocaleString('ar-SA');waToast('success',`📅 تمت الجدولة — ${timeStr}`);if(typeof addNotif==='function')addNotif('⏰','جدولة إرسال WA',`${waBulkQueue.length} رسالة في ${timeStr}`);}
function cancelScheduledBulk(){clearInterval(scheduledBulkCountdown);clearTimeout(scheduledBulkTimer);scheduledBulkTimestamp=null;$('wa-schedBox').style.display='block';$('wa-schedCountdownBox').style.display='none';const actDiv=document.querySelector('#wa-bulkModal .modal-actions');if(actDiv)actDiv.style.display='flex';waSchedUpdateInfo();waToast('warn','❌ تم إلغاء الجدولة');}
/*  CUSTOM CONFIRM MODAL   defined in head script */
/*  HIGHLIGHT + COPY  */
function hlText(text,query){const safeT=escHtml(String(text??''));if(!query||!safeT)return safeT;const safeQ=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return safeT.replace(new RegExp('('+safeQ+')','gi'),'<mark class="hl">$1</mark>');}
function copyResult(){const nameEl=$('resName');const name=(nameEl?.firstChild?.textContent||nameEl?.innerText||'').trim();const id=$('resId')?.innerText||'';const text=$('resText')?.innerText||'';const tags=$('resTags')?.innerText||'';const full=[name,id,'─'.repeat(28),text,'─'.repeat(28),tags].filter(Boolean).join('\n').trim();navigator.clipboard.writeText(full).then(()=>toast('📋 تم نسخ النتيجة','ok')).catch(()=>toast('⚠️ تعذّر النسخ','warn'));}
/*  SESSION RESTORE  moved to DOMContentLoaded after _initUsers  */
/*  GLOBAL SEARCH  */
let _globalResults=[];
function toggleGlobalSearch(on){const sel=$('searchFileSelect');const hint=$('globalSearchHint');const cnt=$('globalSearchFilesCount');if(sel)sel.style.display=on?'none':'';if(hint)hint.style.display=on?'inline':'none';if(cnt)cnt.textContent=appState.files.length;if(!on){$('globalResContainer').style.display='none';_globalResults=[];}}
async function handleGlobalSearch(){const query=($('searchInput')?.value||'').trim();const nameQ=($('searchInputName')?.value||'').trim().toLowerCase();const phoneQ=($('searchInputPhone')?.value||'').trim();if(!query&&!nameQ&&!phoneQ){toast('⚠️ أدخل قيمة بحث','warn');return;}if(!appState.files.length){toast('⚠️ لا توجد ملفات مرفوعة','warn');return;}const btn=$('searchBtn');btn.disabled=true;sv('searchBtnTxt','⏳ جاري...');$('globalResContainer').style.display='block';$('globalResList').innerHTML='<div class="global-search-loading">🔍 جاري البحث في '+appState.files.length+' ملف...</div>';sv('globalResCount','...');_globalResults=[];for(let fi=0;fi<appState.files.length;fi++){const f=appState.files[fi];let rows=[];if(query){if(f.idIndex){const i=f.idIndex.get(query.trim());if(i!==undefined)rows.push(f.data[i]);}else rows=f.data.filter(r=>String(r[f.idCol]??'').trim()===query);}if(!rows.length&&nameQ&&f.nameCol>=0){const nn=normalizeAr(nameQ);if(f.nameIndex){const m=[];f.nameIndex.forEach((ia,k)=>{if(k.includes(nn))m.push(...ia);});rows=m.map(i=>f.data[i]);}else rows=f.data.filter(r=>normalizeAr(r[f.nameCol]).includes(nn));}if(!rows.length&&phoneQ){const pN=phoneQ.replace(/[\s+\-]/g,'');if(f.phoneColIdx!==undefined&&f.phoneColIdx>=0)rows=f.data.filter(r=>String(r[f.phoneColIdx]??'').replace(/[\s+\-]/g,'').includes(pN));if(!rows.length)rows=f.data.filter(r=>f.extraCols.some(i=>String(r[i]??'').replace(/[\s+\-]/g,'').includes(pN)));}if(!rows.length){const nq=normalizeAr(query||nameQ||phoneQ);rows=f.data.filter(r=>f.extraCols.some(i=>normalizeAr(String(r[i]??'')).includes(nq)));}rows.forEach(row=>{const name=f.nameCol>=0?(row[f.nameCol]??'—'):'—';const id=row[f.idCol]??'—';const pd={};f.extraCols.forEach(i=>{if(f.headers[i])pd[f.headers[i]]=row[i]??'';});_globalResults.push({fileIdx:fi,fileName:f.name,row,name,id,personData:pd});});}const fh=[...new Set(_globalResults.map(r=>r.fileName))];sv('globalResCount',_globalResults.length);sv('globalResFileCount',_globalResults.length?`في ${fh.length} ملف`:'');renderGlobalResults();btn.disabled=false;sv('searchBtnTxt','🔍 بحث');if(!_globalResults.length){toast('❌ لم يتم العثور على نتائج','err');$('globalResList').innerHTML='<div class="global-search-loading">لا توجد نتائج</div>';}else toast(`🌐 ${_globalResults.length} نتيجة في ${fh.length} ملف`,'ok');addAudit('search',`بحث شامل: ${query||nameQ||phoneQ}`,`${_globalResults.length} نتيجة`);}
function renderGlobalResults(){const list=$('globalResList');if(!list)return;if(!_globalResults.length){list.innerHTML='<div class="global-search-loading">لا توجد نتائج</div>';return;}const q=($('searchInput')?.value||$('searchInputName')?.value||$('searchInputPhone')?.value||'').trim();list.innerHTML=_globalResults.slice(0,100).map((r,i)=>`<div class="global-res-card"><div class="global-res-file-badge">📁 ${escHtml(r.fileName)}</div><div class="global-res-name">${hlText(r.name,q)}</div><div class="global-res-id">رقم الهوية: ${hlText(String(r.id),q)}</div><div class="global-res-tags">${Object.entries(r.personData).slice(0,6).map(([k,v])=>`<span class="global-res-tag"><b>${escHtml(k)}:</b> ${hlText(String(v),q)}</span>`).join('')}</div><div style="margin-top:8px;display:flex;gap:6px;"><button class="btn btn-secondary btn-sm" onclick="globalResViewFull(${i})">👁 عرض كامل</button><button class="btn btn-outline btn-sm" onclick="globalResCopy(${i})">📋 نسخ</button></div></div>`).join('')+(_globalResults.length>100?`<div class="global-search-loading">أول 100 من ${_globalResults.length}</div>`:'');}
function globalResViewFull(idx){const r=_globalResults[idx];if(!r)return;const t=$('globalSearchToggle');if(t){t.checked=false;toggleGlobalSearch(false);}const s=$('searchFileSelect');if(s)s.value=r.fileIdx;$('searchInput').value=r.id;handleSearch();}
function globalResCopy(idx){const r=_globalResults[idx];if(!r)return;const txt=`الاسم: ${r.name}\nرقم الهوية: ${r.id}\nالملف: ${r.fileName}\n`+Object.entries(r.personData).map(([k,v])=>`${k}: ${v}`).join('\n');navigator.clipboard?.writeText(txt).then(()=>toast('📋 تم النسخ','ok'));}
function exportGlobalResults(){if(!_globalResults.length){toast('لا توجد نتائج','warn');return;}const ak=[...new Set(_globalResults.flatMap(r=>Object.keys(r.personData)))];const rows=[['الملف','الاسم','رقم الهوية',...ak]];_globalResults.forEach(r=>rows.push([r.fileName,r.name,r.id,...ak.map(k=>r.personData[k]??'')]));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'نتائج البحث الشامل');safeExportXLSX('global-search-results.xlsx',wb);}
function closeBulkModal(){const bm=$('wa-bulkModal');if(bm)bm.classList.remove('show');}
let _bulkStopped = false;
function stopBulkSend(){
  _bulkStopped = true;
  sv('wa-bulkStatusTxt','⏹ تم إيقاف الإرسال');
  waToast('warning','⏹ تم إيقاف الإرسال الجماعي');
  // إظهار ملخص قصير قبل الإخفاء
  const countEl=$('wa-bulkProgCount');
  const countTxt=countEl?countEl.textContent:'';
  if(countTxt) sv('wa-bulkStatusTxt',`⏹ توقف عند: ${countTxt}`);
  setTimeout(()=>{const prog=$('wa-bulkProg');if(prog)prog.style.display='none';renderTable();},3500);
}
function startBulkSend(){closeBulkModal();const queue=[...waBulkQueue];let idx=0;_bulkStopped=false;const prog=$('wa-bulkProg');const stopBtn=$('wa-bulkStopBtn');if(prog)prog.style.display='block';if(stopBtn)stopBtn.style.display='inline-flex';function next(){if(_bulkStopped){if(stopBtn)stopBtn.style.display='none';return;}if(idx>=queue.length){sv('wa-bulkStatusTxt','اكتمل الإرسال! ✅');waToast('success',`✅ تم إرسال ${queue.length} رسالة`);if(stopBtn)stopBtn.style.display='none';setTimeout(()=>{if(prog)prog.style.display='none';renderTable();},4000);return;}const rd=getRateData();if(rd.hourlyCount>=getMaxPerHour()){sv('wa-bulkStatusTxt','⚠️ توقف: تجاوز حد الساعة');if(stopBtn)stopBtn.style.display='none';setTimeout(()=>{if(prog)prog.style.display='none';renderTable();},4000);return;}const r=queue[idx];window.open(buildWaLink(r),'_blank');incSend();r.sent=true;idx++;saveWaRows();const pct=Math.round((idx/queue.length)*100);const bf=$('wa-bulkBarFill');if(bf)bf.style.width=pct+'%';sv('wa-bulkProgCount',`${idx}/${queue.length}`);sv('wa-bulkStatusTxt',`⏳ جاري الإرسال (${idx}/${queue.length})...`);if(idx<queue.length)setTimeout(next,getBulkDelay());else{sv('wa-bulkStatusTxt','اكتمل! ✅');waToast('success',`✅ تم إرسال ${idx} رسالة`);if(stopBtn)stopBtn.style.display='none';setTimeout(()=>{if(prog)prog.style.display='none';renderTable();},4000);}}next();}
/*       WA  */
function openImportFromSystemFiles(){
  if(!appState.files.length){waToast('error','⚠️ لا توجد ملفات مرفوعة في النظام');return;}
  const existing=document.getElementById('sysImportModal');if(existing)existing.remove();
  const m=document.createElement('div');m.id='sysImportModal';m.className='modal-ov show';
  m.innerHTML=`<div class="modal" style="max-width:480px;">
    <div class="modal-hd"><div class="modal-title">🗂 استيراد من ملفات النظام</div><button class="modal-close" onclick="document.getElementById('sysImportModal').remove()">✕</button></div>
    <div class="fg"><label class="lbl">اختر الملف</label>
      <select class="inp" id="sysImportFile" onchange="updateSysImportCols()">
        ${appState.files.map((f,i)=>`<option value="${i}">${esc(f.name)} (${f.data.length} سجل)</option>`).join('')}
      </select>
    </div>
    <div class="fg"><label class="lbl">عمود رقم الهاتف</label><select class="inp" id="sysImportPhone"></select></div>
    <div class="fg"><label class="lbl">عمود الاسم (اختياري)</label><select class="inp" id="sysImportName"><option value="-1">— لا شيء —</option></select></div>
    <div class="flex gap-3" style="margin-top:14px;">
      <button class="btn btn-primary u-flex1" onclick="doImportFromSystem()">✅ استيراد</button>
      <button class="btn btn-outline u-flex1" onclick="document.getElementById('sysImportModal').remove()">إلغاء</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  updateSysImportCols();
}
function updateSysImportCols(){
  const fi=parseInt($('sysImportFile')?.value||0);const f=appState.files[fi];if(!f)return;
  const ph=$('sysImportPhone'),nm=$('sysImportName');if(!ph||!nm)return;
  ph.innerHTML=f.headers.map((h,i)=>`<option value="${i}">${h}</option>`).join('');
  nm.innerHTML='<option value="-1">— لا شيء —</option>'+f.headers.map((h,i)=>`<option value="${i}" ${i===f.nameCol?'selected':''}>${h}</option>`).join('');
  // اقتراح عمود الهاتف
  const phoneIdx=f.headers.findIndex(h=>/هاتف|جوال|phone|mobile|tel/i.test(h));
  if(phoneIdx>=0) ph.value=phoneIdx;
  else { const ec=f.extraCols[0];if(ec!==undefined)ph.value=ec; }
}
function doImportFromSystem(){
  const fi=parseInt($('sysImportFile')?.value||0);
  const phoneCol=parseInt($('sysImportPhone')?.value??-1);
  const nameCol=parseInt($('sysImportName')?.value??-1);
  const f=appState.files[fi];if(!f||phoneCol<0){waToast('error','⚠️ حدد عمود الهاتف');return;}
  let n=0;
  f.data.forEach(row=>{
    const ph=String(row[phoneCol]||'').trim().replace(/\D/g,'');
    if(!ph) return;
    const name=nameCol>=0?String(row[nameCol]||'').trim():'';
    waRows.push({id:++wa_idCtr,phone:ph,name,notes:'',msg1:'',msg2:'',msg3:'',sent:false});
    n++;
  });
  saveWaRows();renderTable();
  document.getElementById('sysImportModal')?.remove();
  waToast('success',`✅ تم استيراد ${n} سجل من "${f.name}"`);
  addNotif('🗂','استيراد WA',`${n} سجل من ${f.name}`);
}

function importFile(inp){const file=inp.files[0];if(!file)return;const ext=file.name.split('.').pop().toLowerCase();const parseRows=data=>{let n=0;data.slice(1).forEach(row=>{const ph=String(row[0]||'').trim();if(ph||String(row[2]||'').trim()){waRows.push({id:++wa_idCtr,phone:ph,notes:String(row[1]||'').trim(),name:String(row[2]||'').trim(),msg1:String(row[3]||'').trim(),msg2:String(row[4]||'').trim(),msg3:String(row[5]||'').trim(),sent:false});n++;}});saveWaRows();renderTable();waToast('success',`📥 تم استيراد ${n} سجل`);};if(ext==='csv'){const r=new FileReader();r.onload=e=>{const lines=e.target.result.split('\n').filter(l=>l.trim());const data=lines.map(l=>l.split(',').map(v=>v.trim().replace(/^"|"$/g,'')));parseRows(data);};r.readAsText(file,'UTF-8');}else{const r=new FileReader();r.onload=e=>{try{const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});parseRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false}));}catch(err){waToast('error','❌ خطأ في قراءة الملف');}};r.readAsArrayBuffer(file);}inp.value='';}
function doExportCSV(){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['رقم الجوال','ملاحظات','الاسم','الرسالة الأساسية','رسالة 2','رسالة 3'],...waRows.map(r=>[r.phone||'',r.notes||'',r.name||'',r.msg1||'',r.msg2||'',r.msg3||''])]),'الرسائل');safeExportXLSX('WA_Export.xlsx',wb);}
function renderCP(){_syncWaUsers();const rd=getRateData();const mph=getMaxPerHour();const cpSB=$('wa-cpStatsBody');if(cpSB)cpSB.innerHTML=`<div style="font-size:13px;line-height:2.2;color:#7cb88a"><div>📋 السجلات: <b style="color:#25D366">${waRows.length}</b></div><div>✅ مع أرقام: <b style="color:#25D366">${waRows.filter(r=>r.phone&&r.phone.trim()).length}</b></div><div>📤 تم الإرسال: <b style="color:#3498db">${waRows.filter(r=>r.sent).length}</b></div><div>⏱️ هذه الساعة: <b style="color:${rd.hourlyCount>=mph?'#e74c3c':'#25D366'}">${rd.hourlyCount}/${mph}</b></div><div>📅 اليوم: <b style="color:#9b59b6">${rd.dailyCount}</b></div></div>`;
  const ul=$('wa-userList');if(!ul)return;
  ul.innerHTML=waUsers.map((u,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#162118;border-radius:9px;border:1px solid #2a3d31;margin-bottom:8px;"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#128C7E,#075E54);display:flex;align-items:center;justify-content:center;font-size:15px;">${u.role==='admin'?'👑':'👤'}</div><div class="u-flex1"><div style="font-size:13px;font-weight:700;color:#e8f5e9;">${escHtml(u.username)}</div><div style="font-size:11px;color:#4a6b54;">${escHtml(u.fullName||'—')}</div></div><span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:${u.role==='admin'?'rgba(37,211,102,.2)':'rgba(243,156,18,.2)'};color:${u.role==='admin'?'#25D366':'#f39c12'}">${escHtml(u.role)}</span></div>`).join('');
}
function switchTab(tab){
  const all=['messages','templates','mySettings','control'];
  all.forEach(t=>{
    const pg=$('wa-page'+t.charAt(0).toUpperCase()+t.slice(1));
    const tb=$('wa-tab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(pg) pg.style.display = t===tab ? 'block' : 'none';
    if(tb) tb.classList.toggle('active',t===tab);
  });
  if(tab==='control') renderCP();
  if(tab==='templates') renderTemplates();
  if(tab==='mySettings') renderEmpWaSettings();
}

/*       */
// مفتاح إعدادات الموظف خاص بكل مستخدم لمنع التسريب بين الموظفين
function _empWaCfgKey(){ return 'cc_emp_wa_cfg_' + (appState.user?.user || appState.user?.id || 'shared'); }

function loadEmpWaCfg(){
  const adminCfg = loadWaCfg();   // إعدادات الأدمن (السقف)
  const saved = lsLoad(_empWaCfgKey(), {});
  // الحد الأقصى للموظف: لا يتجاوز حد الأدمن
  const empMax   = Math.min(adminCfg.maxPerHour, Math.max(1, saved.empMax || adminCfg.maxPerHour));
  // التأخير: لا يقل عن حد الأدمن
  const empDelay = Math.max(adminCfg.minDelay, saved.empDelay || adminCfg.minDelay);
  return { adminMax: adminCfg.maxPerHour, minDelay: adminCfg.minDelay, empMax, empDelay };
}

function saveEmpWaSettings(){
  const adminCfg = loadWaCfg();
  const maxInp   = $('emp-waMaxInp');
  const delayInp = $('emp-waDelay');
  if(!maxInp || !delayInp) return;

  let empMax   = Math.min(adminCfg.maxPerHour, Math.max(1, parseInt(maxInp.value)  || adminCfg.maxPerHour));
  let empDelay = Math.max(adminCfg.minDelay,   Math.min(120, parseInt(delayInp.value) || adminCfg.minDelay));

  maxInp.value   = empMax;
  delayInp.value = empDelay;

  lsSave(_empWaCfgKey(), { empMax, empDelay });
  if(typeof isSupabaseReady==='function' && isSupabaseReady()){
    const _empOwner = appState.user?.user || 'emp';
    sbSaveSettings('emp_waconfig_'+_empOwner, { empMax, empDelay });
  }
  waToast('success', `✅ تم الحفظ — الحد: ${empMax} رسالة/ساعة | التأخير: ${empDelay}ث`);
  addAudit('settings', 'موظف عدّل إعدادات واتساب', `حد: ${empMax} | تأخير: ${empDelay}ث`);
}

function clampEmpMax(inp){
  const adminCfg = loadWaCfg();
  const hint = $('emp-waMaxHint');
  const val  = parseInt(inp.value) || 0;
  if(val > adminCfg.maxPerHour){
    inp.style.borderColor = '#e74c3c';
    if(hint) hint.innerHTML = `<span style="color:#f87171;">⚠️ لا يمكن تجاوز حد المدير: ${adminCfg.maxPerHour} رسالة/ساعة</span>`;
  } else if(val < 1){
    inp.style.borderColor = '#f59e0b';
    if(hint) hint.innerHTML = `<span style="color:#fbbf24;">⚠️ الحد الأدنى: 1 رسالة</span>`;
  } else {
    inp.style.borderColor = '#25D366';
    if(hint) hint.innerHTML = `<span style="color:#7cb88a;">✅ مقبول (${val} من أصل ${adminCfg.maxPerHour})</span>`;
  }
}

function clampEmpDelay(inp){
  const adminCfg = loadWaCfg();
  const hint = $('emp-waDelayHint');
  const val = parseInt(inp.value) || 0;
  if(val < adminCfg.minDelay){
    inp.style.borderColor = '#e74c3c';
    if(hint) hint.innerHTML = `<span style="color:#f87171;">⚠️ الحد الأدنى المسموح: ${adminCfg.minDelay} ثانية</span>`;
  } else {
    inp.style.borderColor = '#25D366';
    if(hint) hint.innerHTML = `<span style="color:#7cb88a;">✅ مقبول</span>`;
  }
}

function renderEmpWaSettings(){
  const cfg = loadEmpWaCfg();
  const rd  = getRateData();

  // سقف الأدمن (معلوماتي)
  const ceilEl      = $('emp-waAdminCeiling');
  const delayCeilEl = $('emp-waAdminDelayCeiling');
  if(ceilEl)      ceilEl.textContent      = cfg.adminMax;
  if(delayCeilEl) delayCeilEl.textContent = cfg.minDelay;

  // شريط الاستخدام (نسبة من حد الموظف نفسه)
  const pct = Math.min(100, Math.round((rd.hourlyCount / cfg.empMax) * 100));
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#25D366';
  const usageBar = $('emp-waUsageBar');
  const usageTxt = $('emp-waUsageText');
  if(usageBar){ usageBar.style.width = pct+'%'; usageBar.style.background = barColor; }
  if(usageTxt) usageTxt.textContent = `${rd.hourlyCount} / ${cfg.empMax}`;

  // حقل الحد الأقصى
  const maxInp  = $('emp-waMaxInp');
  const maxHint = $('emp-waMaxHint');
  if(maxInp){
    maxInp.value = cfg.empMax;
    maxInp.max   = cfg.adminMax;
    if(maxHint) maxHint.innerHTML = `<span style="color:#7cb88a;">الحد الأقصى المسموح من المدير: <b>${cfg.adminMax}</b> رسالة/ساعة</span>`;
    maxInp.style.borderColor = '#25D366';
  }

  // حقل التأخير
  const delayInp  = $('emp-waDelay');
  const delayHint = $('emp-waDelayHint');
  if(delayInp){
    delayInp.value = cfg.empDelay;
    delayInp.min   = cfg.minDelay;
    if(delayHint) delayHint.innerHTML = `<span style="color:#7cb88a;">الحد الأدنى المسموح من المدير: <b>${cfg.minDelay}</b> ثانية</span>`;
    delayInp.style.borderColor = '#25D366';
  }
}

/* getMaxPerHour       */
const _origGetMaxPerHour = getMaxPerHour;
window.getMaxPerHour = function(){
  if(appState.user?.role === 'subuser'){
    return loadEmpWaCfg().empMax;
  }
  return _origGetMaxPerHour();
};

/* getBulkDelay      */
const _origGetBulkDelay = getBulkDelay;
window.getBulkDelay = function(){
  if(appState.user?.role === 'subuser'){
    const cfg = loadEmpWaCfg();
    return Math.floor(Math.random()*5000) + (cfg.empDelay * 1000);
  }
  return _origGetBulkDelay();
};

/* 
       - Security Features v2
 */

/*  1.   2FA (TOTP)  */
const LS_2FA = 'cc_2fa_configs';
function get2FAConfigs(){ return lsLoad(LS_2FA, {}); }
function save2FAConfigs(obj){ lsSave(LS_2FA, obj); }

function generate2FASecret(){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let s = '';
  for(let i=0;i<32;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function base32Decode(input){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', out = [];
  for(let c of input.toUpperCase().replace(/=/g,'')){
    const val = chars.indexOf(c); if(val<0) continue;
    bits += val.toString(2).padStart(5,'0');
  }
  for(let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.slice(i,i+8),2));
  return new Uint8Array(out);
}

async function generateTOTP(secret, timeStep=30){
  try{
    const keyData = base32Decode(secret);
    const time = Math.floor(Date.now()/1000/timeStep);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(4, time, false);
    const key = await crypto.subtle.importKey('raw', keyData, {name:'HMAC',hash:'SHA-1'}, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, buf);
    const arr = new Uint8Array(sig);
    const offset = arr[19] & 0xf;
    const code = ((arr[offset]&0x7f)<<24)|((arr[offset+1]&0xff)<<16)|((arr[offset+2]&0xff)<<8)|(arr[offset+3]&0xff);
    return String(code % 1000000).padStart(6,'0');
  }catch(e){ return null; }
}

async function verify2FA(userId, inputCode){
  const configs = get2FAConfigs();
  const cfg = configs[userId];
  if(!cfg || !cfg.enabled) return true; // 2FA غير مفعّل = السماح
  const expected = await generateTOTP(cfg.secret);
  const prev = await generateTOTP(cfg.secret, 30); // نافذة زمنية إضافية
  return inputCode === expected || inputCode === prev;
}

function show2FASetupModal(userId){
  if(!appState.user || appState.user.role !== 'admin'){toast('⛔ للمدير فقط','err'); return;}
  const secret = generate2FASecret();
  const user = registeredUsers.find(u=>u.id===userId);
  if(!user){ toast('❌ مستخدم غير موجود','err'); return; }
  const old = document.getElementById('_2faSetupModal'); if(old) old.remove();
  const div = document.createElement('div');
  div.id = '_2faSetupModal';
  div.className = 'modal-ov show';
  div.innerHTML = `<div class="modal" style="max-width:480px;">
    <div class="modal-hd"><div class="modal-title">🔐 إعداد المصادقة الثنائية (2FA)</div><button class="modal-close" onclick="document.getElementById('_2faSetupModal').remove()">✕</button></div>
    <div style="background:var(--b50);border:1px solid var(--b200);border-radius:10px;padding:14px;margin-bottom:14px;">
      <p style="font-size:12.5px;color:var(--s600);margin-bottom:8px;">🔑 المستخدم: <strong>${escHtml(user.name)}</strong></p>
      <p style="font-size:12px;color:var(--s500);">1. افتح تطبيق المصادقة (Google Authenticator / Authy)</p>
      <p style="font-size:12px;color:var(--s500);">2. أضف حساباً جديداً وأدخل المفتاح يدوياً:</p>
      <div style="background:#0f172a;color:#60a5fa;font-family:monospace;font-size:15px;letter-spacing:4px;padding:12px;border-radius:8px;text-align:center;margin:10px 0;font-weight:700;user-select:all;">${secret}</div>
      <p style="font-size:12px;color:var(--s500);">3. أدخل الرمز المُولَّد للتحقق:</p>
    </div>
    <div class="fg"><label class="lbl">رمز التحقق المؤقت (6 أرقام)</label>
      <input class="inp" id="_2faVerifyInput" maxlength="6" inputmode="numeric" placeholder="000000" style="font-size:22px;letter-spacing:8px;text-align:center;"/>
    </div>
    <div class="flex gap-3" style="margin-top:14px;">
      <button class="btn btn-primary u-flex1" onclick="confirm2FASetup(${userId},'${secret}')">✅ تفعيل 2FA</button>
      <button class="btn btn-danger btn-sm" onclick="disable2FA(${userId})">🗑 إلغاء 2FA</button>
    </div>
    <p style="font-size:11px;color:var(--err);margin-top:8px;">⚠️ احتفظ بالمفتاح في مكان آمن. لا يمكن استعادته لاحقاً.</p>
  </div>`;
  div.addEventListener('click', e=>{ if(e.target===div) div.remove(); });
  document.body.appendChild(div);
}

async function confirm2FASetup(userId, secret){
  const input = document.getElementById('_2faVerifyInput');
  if(!input || input.value.length !== 6){ toast('⚠️ أدخل رمز التحقق (6 أرقام)','warn'); return; }
  const tempCfg = { enabled: true, secret };
  const expected = await generateTOTP(secret);
  if(input.value !== expected){ toast('❌ الرمز غير صحيح. تأكد من وقت جهازك','err'); return; }
  const configs = get2FAConfigs();
  configs[userId] = { enabled: true, secret };
  save2FAConfigs(configs);
  document.getElementById('_2faSetupModal')?.remove();
  toast('✅ تم تفعيل المصادقة الثنائية بنجاح','ok');
  addAudit('security','🔐 تفعيل 2FA للمستخدم: '+registeredUsers.find(u=>u.id===userId)?.name,'');
}

function disable2FA(userId){
  const configs = get2FAConfigs();
  delete configs[userId];
  save2FAConfigs(configs);
  document.getElementById('_2faSetupModal')?.remove();
  toast('🗑 تم إلغاء المصادقة الثنائية','warn');
  addAudit('security','🔓 إلغاء 2FA للمستخدم: '+registeredUsers.find(u=>u.id===userId)?.name,'');
}

/*  2FA         2FA  */
let _pending2FAUserId = null;
function show2FALoginModal(userId, onSuccess){
  _pending2FAUserId = userId;
  const old = document.getElementById('_2faLoginModal'); if(old) old.remove();
  const div = document.createElement('div');
  div.id = '_2faLoginModal';
  div.className = 'modal-ov show';
  div.innerHTML = `<div class="modal" style="max-width:380px;text-align:center;">
    <div style="font-size:48px;margin-bottom:12px;">🔐</div>
    <div style="font-size:18px;font-weight:800;color:var(--s800);margin-bottom:6px;">التحقق بخطوتين</div>
    <p style="font-size:12.5px;color:var(--s500);margin-bottom:18px;">أدخل رمز التحقق من تطبيق المصادقة</p>
    <input class="inp" id="_2faLoginCode" maxlength="6" inputmode="numeric" placeholder="000000" style="font-size:28px;letter-spacing:10px;text-align:center;font-weight:700;" autofocus/>
    <button class="btn btn-primary btn-full" style="margin-top:14px;" onclick="verify2FALogin(${userId})">✅ تحقق</button>
    <p style="font-size:11px;color:var(--s400);margin-top:8px;">الرمز صالح لـ 30 ثانية</p>
  </div>`;
  div.querySelector('#_2faLoginCode').addEventListener('keydown', e=>{ if(e.key==='Enter') verify2FALogin(userId); });
  document.body.appendChild(div);
  window._2faSuccessCb = onSuccess;
}
async function verify2FALogin(userId){
  const input = document.getElementById('_2faLoginCode');
  if(!input) return;
  const code = input.value.trim();
  const ok = await verify2FA(userId, code);
  if(!ok){ toast('❌ رمز التحقق غير صحيح','err'); input.value=''; input.focus(); return; }
  document.getElementById('_2faLoginModal')?.remove();
  if(typeof window._2faSuccessCb === 'function') window._2faSuccessCb();
}

/*  2.  IP  */
const LS_IP_WHITELIST = 'cc_ip_whitelist';
const LS_IP_ENABLED   = 'cc_ip_enabled';

function getIPWhitelist(){ return lsLoad(LS_IP_WHITELIST, []); }
function isIPRestrictionEnabled(){ return lsLoad(LS_IP_ENABLED, false); }

async function getClientIP(){
  try{
    // نستخدم ip-api.com للحصول على IP (للاستخدام المحلي فقط)
    const r = await fetch('https://api.ipify.org?format=json');
    const d = await r.json();
    return d.ip || 'unknown';
  }catch(e){ return 'unknown'; }
}

async function checkIPRestriction(){
  if(!isIPRestrictionEnabled()) return true;
  const wl = getIPWhitelist();
  if(!wl.length) return true;
  const ip = await getClientIP();
  return wl.some(entry => {
    if(entry.includes('*')){
      const pattern = entry.replace(/\./g,'\\.').replace(/[*]/g,'.*');
      return new RegExp('^'+pattern+'$').test(ip);
    }
    return entry === ip;
  });
}

function showIPSettingsModal(){
  if(!appState.user || appState.user.role !== 'admin'){ toast('⛔ للمدير فقط','err'); return; }
  const wl = getIPWhitelist();
  const enabled = isIPRestrictionEnabled();
  const old = document.getElementById('_ipModal'); if(old) old.remove();
  const div = document.createElement('div');
  div.id = '_ipModal';
  div.className = 'modal-ov show';
  div.innerHTML = `<div class="modal" style="max-width:520px;">
    <div class="modal-hd"><div class="modal-title">🌐 تقييد الوصول بـ IP</div><button class="modal-close" onclick="document.getElementById('_ipModal').remove()">✕</button></div>
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:${enabled?'rgba(16,185,129,.07)':'rgba(239,68,68,.07)'};border:1px solid ${enabled?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'};border-radius:10px;margin-bottom:14px;">
      <span style="font-size:24px;">${enabled?'🔒':'🔓'}</span>
      <div class="u-flex1"><strong>تقييد IP</strong><br><span style="font-size:12px;color:var(--s500);">${enabled?'مفعّل — يسمح فقط للـ IPs المدرجة':'معطّل — السماح لجميع العناوين'}</span></div>
      <label class="perm-toggle" style="flex-shrink:0;"><input type="checkbox" id="_ipToggle" ${enabled?'checked':''} onchange="toggleIPRestriction(this.checked)"/><span class="perm-slider"></span></label>
    </div>
    <div class="fg"><label class="lbl">قائمة العناوين المسموح بها (سطر لكل عنوان، يدعم *)</label>
      <textarea class="inp" id="_ipList" rows="6" placeholder="مثال:&#10;192.168.1.*&#10;10.0.0.1&#10;203.0.113.42" style="font-family:monospace;font-size:13px;">${wl.join('\n')}</textarea>
    </div>
    <p style="font-size:11px;color:var(--s400);margin-bottom:12px;">⚠️ إذا أضفت IP غير صحيح ستُحجب عن النظام. أضف عنوانك الحالي أولاً.</p>
    <div class="flex gap-3">
      <button class="btn btn-primary u-flex1" onclick="saveIPWhitelist()">💾 حفظ القائمة</button>
      <button class="btn btn-outline u-flex1" onclick="document.getElementById('_ipModal').remove()">إغلاق</button>
    </div>
  </div>`;
  div.addEventListener('click', e=>{ if(e.target===div) div.remove(); });
  document.body.appendChild(div);
}

function toggleIPRestriction(val){
  lsSave(LS_IP_ENABLED, val);
  addAudit('security', val?'تفعيل تقييد IP':'إلغاء تقييد IP', appState.user?.name||'');
  toast(val?'🔒 تم تفعيل تقييد IP':'🔓 تم إلغاء تقييد IP', val?'ok':'warn');
}

function saveIPWhitelist(){
  const raw = (document.getElementById('_ipList')?.value||'').trim();
  const list = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  lsSave(LS_IP_WHITELIST, list);
  document.getElementById('_ipModal')?.remove();
  addAudit('security','تحديث قائمة IP المسموح بها', `${list.length} عنوان`);
  toast(`✅ تم حفظ ${list.length} عنوان IP`, 'ok');
}

/*  3.    (Regex)  */
function isRegexSearch(q){
  return q.startsWith('/') && q.length > 2;
}
function parseRegexSearch(q){
  const m = q.match(/^\/(.+)\/([gimsuy]*)$/);
  if(m) return new RegExp(m[1], m[2]);
  const body = q.slice(1);
  return new RegExp(body);
}
function regexSearchFile(f, pattern){
  return f.data.filter(row =>
    f.headers.some((_, i) => {
      try { return pattern.test(String(row[i]??'')); }
      catch(e){ return false; }
    })
  );
}

/*  4.  Widgets   */
const LS_WIDGETS = 'cc_widgets';
const DEFAULT_WIDGETS = [
  {id:'wg_files',   label:'الملفات',       icon:'📁', enabled:true,  order:1},
  {id:'wg_records', label:'السجلات',       icon:'📝', enabled:true,  order:2},
  {id:'wg_queries', label:'الاستعلامات',   icon:'🔍', enabled:true,  order:3},
  {id:'wg_users',   label:'الموظفون',      icon:'👥', enabled:true,  order:4},
  {id:'wg_success', label:'ناجحة',         icon:'✅', enabled:true,  order:5},
  {id:'wg_fail',    label:'فاشلة',         icon:'❌', enabled:false, order:6},
  {id:'wg_lastq',   label:'آخر استعلام',   icon:'🕐', enabled:false, order:7},
];

function getWidgets(){ return lsLoad(LS_WIDGETS, DEFAULT_WIDGETS); }
function saveWidgets(w){ lsSave(LS_WIDGETS, w); }

function showWidgetsModal(){
  const widgets = getWidgets();
  const old = document.getElementById('_widgetsModal'); if(old) old.remove();
  const div = document.createElement('div');
  div.id = '_widgetsModal';
  div.className = 'modal-ov show';
  div.innerHTML = `<div class="modal" style="max-width:480px;">
    <div class="modal-hd"><div class="modal-title">🧩 تخصيص لوحة التحكم (Widgets)</div><button class="modal-close" onclick="document.getElementById('_widgetsModal').remove()">✕</button></div>
    <p style="font-size:12.5px;color:var(--s500);margin-bottom:14px;">اختر الإحصائيات التي تريد إظهارها في لوحة التحكم</p>
    <div id="_widgetsList" style="display:flex;flex-direction:column;gap:8px;">
      ${widgets.map(w=>`
        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--b50);border:1px solid var(--border);border-radius:10px;">
          <span style="font-size:20px;">${w.icon}</span>
          <span style="flex:1;font-weight:600;font-size:13px;">${w.label}</span>
          <label class="perm-toggle"><input type="checkbox" data-wgid="${w.id}" ${w.enabled?'checked':''}/><span class="perm-slider"></span></label>
        </div>`).join('')}
    </div>
    <div class="flex gap-3" style="margin-top:16px;">
      <button class="btn btn-primary u-flex1" onclick="saveWidgetsConfig()">💾 حفظ</button>
      <button class="btn btn-outline u-flex1" onclick="document.getElementById('_widgetsModal').remove()">إلغاء</button>
    </div>
  </div>`;
  div.addEventListener('click', e=>{ if(e.target===div) div.remove(); });
  document.body.appendChild(div);
}

function saveWidgetsConfig(){
  const widgets = getWidgets();
  document.querySelectorAll('[data-wgid]').forEach(inp=>{
    const w = widgets.find(x=>x.id===inp.dataset.wgid);
    if(w) w.enabled = inp.checked;
  });
  saveWidgets(widgets);
  document.getElementById('_widgetsModal')?.remove();
  renderWidgetsDashboard();
  toast('✅ تم حفظ إعدادات الـ Widgets', 'ok');
}

function renderWidgetsDashboard(){
  const widgets = getWidgets().filter(w=>w.enabled).sort((a,b)=>a.order-b.order);
  const totalRecords = appState.files.reduce((s,f)=>s+f.data.length,0);
  const succ = appState.history.filter(h=>h.success).length;
  const fail = appState.history.length - succ;
  const lastQ = appState.history[0]?.time || '—';
  const vals = {
    wg_files:   appState.files.length,
    wg_records: totalRecords,
    wg_queries: appState.history.length,
    wg_users:   registeredUsers.length,
    wg_success: succ,
    wg_fail:    fail,
    wg_lastq:   lastQ,
  };
  const colors = {
    wg_files:   'rgba(59,130,246,.15)',
    wg_records: 'rgba(16,185,129,.12)',
    wg_queries: 'rgba(245,158,11,.12)',
    wg_users:   'rgba(124,58,237,.12)',
    wg_success: 'rgba(16,185,129,.12)',
    wg_fail:    'rgba(239,68,68,.12)',
    wg_lastq:   'rgba(100,116,139,.12)',
  };
  const container = document.querySelector('#page-dashboard .g4');
  if(!container) return;
  container.innerHTML = widgets.map(w=>`
    <div class="stat" style="--sc:${colors[w.id]||'rgba(59,130,246,.15)'};">
      <div class="stat-lbl">${w.label}</div>
      <div class="stat-val">${vals[w.id]??'—'}</div>
      <div class="stat-ico" style="background:${colors[w.id]||'var(--b100)'};">${w.icon}</div>
    </div>`).join('');
  // إضافة زر التخصيص
  container.insertAdjacentHTML('beforeend',
    `<div onclick="showWidgetsModal()" title="تخصيص الـ Widgets" style="cursor:pointer;display:flex;align-items:center;justify-content:center;background:rgba(59,130,246,.06);border:2px dashed rgba(59,130,246,.25);border-radius:14px;padding:16px;gap:8px;transition:all .2s;color:var(--b500);font-size:13px;font-weight:600;" onmouseover="this.style.background='rgba(59,130,246,.12)'" onmouseout="this.style.background='rgba(59,130,246,.06)'">🧩 تخصيص</div>`
  );
}

/*  5.   (  )  */
const LS_SCHED_REPORT = 'cc_sched_report';
function getSchedReport(){ return lsLoad(LS_SCHED_REPORT, {enabled:false, email:'', day:'sunday', lastSent:null}); }
function saveSchedReport(obj){ lsSave(LS_SCHED_REPORT, obj); }

function showSchedReportModal(){
  const cfg = getSchedReport();
  const old = document.getElementById('_schedModal'); if(old) old.remove();
  const div = document.createElement('div');
  div.id = '_schedModal';
  div.className = 'modal-ov show';
  div.innerHTML = `<div class="modal" style="max-width:460px;">
    <div class="modal-hd"><div class="modal-title">📅 تقارير مجدولة أسبوعية</div><button class="modal-close" onclick="document.getElementById('_schedModal').remove()">✕</button></div>
    <div style="background:var(--b50);border:1px solid var(--b200);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:20px;">📧</span>
        <span style="font-size:13px;font-weight:600;">إرسال تقرير أسبوعي بالبريد الإلكتروني</span>
        <label class="perm-toggle" style="margin-right:auto;"><input type="checkbox" id="_schedEnabled" ${cfg.enabled?'checked':''}/><span class="perm-slider"></span></label>
      </div>
      <p style="font-size:12px;color:var(--s500);">سيُولَّد ملف Excel بإحصائيات الأسبوع وإرسال رابط تنزيله للبريد المحدد.</p>
    </div>
    <div class="fg"><label class="lbl">البريد الإلكتروني</label><input class="inp" type="email" id="_schedEmail" value="${escHtml(cfg.email)}" placeholder="admin@example.com"/></div>
    <div class="fg"><label class="lbl">يوم الإرسال</label>
      <select class="inp" id="_schedDay">
        ${['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map((d,i)=>
          `<option value="${d}" ${cfg.day===d?'selected':''}>
            ${{sunday:'الأحد',monday:'الاثنين',tuesday:'الثلاثاء',wednesday:'الأربعاء',thursday:'الخميس',friday:'الجمعة',saturday:'السبت'}[d]}
          </option>`
        ).join('')}
      </select>
    </div>
    ${cfg.lastSent?`<p style="font-size:11px;color:var(--s400);">آخر إرسال: ${cfg.lastSent}</p>`:''}
    <div class="flex gap-3" style="margin-top:14px;">
      <button class="btn btn-primary u-flex1" onclick="saveSchedReportConfig()">💾 حفظ</button>
      <button class="btn btn-secondary btn-sm" onclick="sendWeeklyReportNow()">📤 إرسال الآن</button>
      <button class="btn btn-outline u-flex1" onclick="document.getElementById('_schedModal').remove()">إغلاق</button>
    </div>
  </div>`;
  div.addEventListener('click', e=>{ if(e.target===div) div.remove(); });
  document.body.appendChild(div);
}

function saveSchedReportConfig(){
  const email = document.getElementById('_schedEmail')?.value.trim();
  const day   = document.getElementById('_schedDay')?.value;
  const enabled = document.getElementById('_schedEnabled')?.checked;
  if(enabled && !email){ toast('⚠️ أدخل البريد الإلكتروني','warn'); return; }
  saveSchedReport({ enabled, email, day, lastSent: getSchedReport().lastSent });
  document.getElementById('_schedModal')?.remove();
  addAudit('settings', enabled?'تفعيل التقارير الأسبوعية':'إيقاف التقارير الأسبوعية', email||'');
  toast(enabled?`✅ سيُرسَل التقرير كل ${day} إلى ${email}`:'🔕 تم إيقاف التقارير المجدولة', enabled?'ok':'warn');
  if(enabled) scheduleWeeklyCheck();
}

function sendWeeklyReportNow(){
  const cfg = getSchedReport();
  const email = document.getElementById('_schedEmail')?.value.trim() || cfg.email;
  if(!email){ toast('⚠️ أدخل البريد الإلكتروني','warn'); return; }
  generateAndSendWeeklyReport(email);
}

function generateAndSendWeeklyReport(email){
  const h = appState.history;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7*24*60*60*1000);
  const weekData = h.filter(x=>{
    const m = x.time?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m){ const d=new Date(+m[3],+m[2]-1,+m[1]); return d>=weekAgo; }
    return false;
  });
  const succ = weekData.filter(x=>x.success).length;
  const fail = weekData.length - succ;
  // توليد ملف Excel
  const wb = XLSX.utils.book_new();
  const rows = [
    ['Customer Care System v1.0 — التقرير الأسبوعي', '', ''],
    ['الفترة:', weekAgo.toLocaleDateString('ar-SA'), '—', now.toLocaleDateString('ar-SA')],
    [''],
    ['الإجمالي','الناجحة','الفاشلة'],
    [weekData.length, succ, fail],
    [''],
    ['رقم الهوية','الملف','الحالة','الوقت','المستخدم'],
    ...weekData.map(x=>[x.id,x.file,x.success?'ناجح':'فاشل',x.time,x.user])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'التقرير الأسبوعي');
  // محاولة الإرسال عبر mailto
  const sub = encodeURIComponent(`📊 التقرير الأسبوعي — Customer Care System v1.0 — ${now.toLocaleDateString('ar-SA')}`);
  const bod = encodeURIComponent(
    `التقرير الأسبوعي من ${weekAgo.toLocaleDateString('ar-SA')} إلى ${now.toLocaleDateString('ar-SA')}\n\n` +
    `إجمالي الاستعلامات: ${weekData.length}\n` +
    `ناجحة: ${succ}\nفاشلة: ${fail}\n\n` +
    `(الملف المرفق: أدخله يدوياً بعد تحميله)`
  );
  // تنزيل الملف أولاً
  safeExportXLSX(`weekly_report_${now.toISOString().slice(0,10)}.xlsx`, wb);
  // فتح بريد جاهز
  const a = document.createElement('a');
  a.href = `mailto:${email}?subject=${sub}&body=${bod}`;
  a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  // حفظ وقت الإرسال
  const cfg = getSchedReport();
  cfg.lastSent = now.toLocaleString('ar-SA');
  saveSchedReport(cfg);
  addAudit('export','إرسال التقرير الأسبوعي', email);
  toast(`✅ تم توليد التقرير وفتح البريد إلى ${email}`, 'ok');
}

function scheduleWeeklyCheck(){
  const cfg = getSchedReport();
  if(!cfg.enabled) return;
  const DAYS = {sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
  const targetDay = DAYS[cfg.day]??0;
  const now = new Date();
  const diff = (targetDay - now.getDay() + 7) % 7;
  const nextSend = new Date(now.getFullYear(),now.getMonth(),now.getDate()+diff,8,0,0);
  const ms = nextSend.getTime() - now.getTime();
  setTimeout(()=>{
    if(getSchedReport().enabled) generateAndSendWeeklyReport(getSchedReport().email);
    scheduleWeeklyCheck(); // جدوله مرة أخرى
  }, Math.max(ms, 1000));
}

/*  6.       */
function expandTemplateVars(text, row, headers){
  if(!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    // البحث عن العمود المطابق
    const idx = headers.findIndex(h => h.toLowerCase() === key.toLowerCase() || h === key);
    if(idx >= 0 && row[idx] !== undefined) return String(row[idx]);
    return match; // أبقِ المتغير كما هو إن لم يُوجَد
  });
}

function showTemplateVarsHelper(){
  const old = document.getElementById('_tplVarsModal'); if(old) old.remove();
  const div = document.createElement('div');
  div.id = '_tplVarsModal';
  div.className = 'modal-ov show';
  div.innerHTML = `<div class="modal" style="max-width:460px;">
    <div class="modal-hd"><div class="modal-title">💡 متغيرات القوالب الذكية</div><button class="modal-close" onclick="document.getElementById('_tplVarsModal').remove()">✕</button></div>
    <p style="font-size:13px;color:var(--s600);margin-bottom:14px;">استخدم المتغيرات التالية في قوالب رسائلك. سيتم استبدالها تلقائياً بقيم كل سجل:</p>
    <div style="background:var(--b50);border:1px solid var(--b200);border-radius:10px;padding:14px;">
      <table style="width:100%;font-size:12.5px;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);"><th style="padding:6px;text-align:right;">المتغير</th><th style="padding:6px;text-align:right;">الوصف</th></tr></thead>
        <tbody>
          ${[
            ['{{الاسم}}','اسم العميل'],
            ['{{رقم_الهوية}}','رقم الهوية الوطنية'],
            ['{{الرسالة}}','الرسالة الأولى'],
            ['{{رسالة_2}}','الرسالة الثانية'],
            ['{{التاريخ}}','التاريخ الحالي'],
            ['{{اسم_أي_عمود}}','يمكن كتابة أي اسم عمود من ملف البيانات'],
          ].map(([v,d])=>`<tr style="border-bottom:1px solid rgba(226,232,240,.4);">
            <td style="padding:6px;font-family:monospace;color:var(--b600);font-weight:700;">${v}</td>
            <td style="padding:6px;color:var(--s500);">${d}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p style="font-size:11.5px;color:var(--s400);margin-top:10px;">مثال: "عزيزي {{الاسم}}، رقم عميلك {{رقم_الهوية}}"</p>
    <button class="btn btn-primary btn-full" style="margin-top:14px;" onclick="document.getElementById('_tplVarsModal').remove()">✓ فهمت</button>
  </div>`;
  div.addEventListener('click', e=>{ if(e.target===div) div.remove(); });
  document.body.appendChild(div);
}

/*  CSS     */
(function(){
  const s = document.createElement('style');
  s.textContent = `
    .perm-toggle { position:relative; display:inline-block; width:44px; height:24px; flex-shrink:0; }
    .perm-toggle input { opacity:0; width:0; height:0; }
    .perm-slider { position:absolute; cursor:pointer; inset:0; background:#cbd5e1; border-radius:24px; transition:.3s; }
    .perm-slider:before { content:""; position:absolute; height:18px; width:18px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.3s; box-shadow:0 1px 4px rgba(0,0,0,.2); }
    .perm-toggle input:checked + .perm-slider { background:#22c55e; }
    .perm-toggle input:checked + .perm-slider:before { transform:translateX(20px); }
    .perm-save-btn { background:linear-gradient(135deg,var(--b600),var(--b700)); color:#fff; border:none; border-radius:8px; padding:6px 14px; font-family:Cairo,sans-serif; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s; }
    .perm-save-btn:hover { opacity:.88; transform:translateY(-1px); }
    .security-features-bar { display:flex; gap:8px; flex-wrap:wrap; padding:14px; background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(30,41,59,.96)); border-radius:14px; border:1px solid rgba(96,165,250,.18); margin-bottom:18px; }
    .sec-btn { display:flex; align-items:center; gap:7px; padding:8px 14px; border-radius:9px; cursor:pointer; font-size:12.5px; font-weight:700; font-family:Cairo,sans-serif; border:1px solid; transition:all .2s; }
    .sec-btn:hover { transform:translateY(-2px); }
    .sec-btn-2fa { background:rgba(124,58,237,.15); border-color:rgba(124,58,237,.35); color:#c4b5fd; }
    .sec-btn-ip  { background:rgba(59,130,246,.15); border-color:rgba(59,130,246,.35); color:#93c5fd; }
    .sec-btn-wg  { background:rgba(16,185,129,.12); border-color:rgba(16,185,129,.3); color:#6ee7b7; }
    .sec-btn-rep { background:rgba(245,158,11,.12); border-color:rgba(245,158,11,.3); color:#fcd34d; }
    .sec-btn-vars{ background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.3); color:#fca5a5; }
  `;
  document.head.appendChild(s);
})();

/*          */
(function addSecurityBar(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const settingsPage = document.getElementById('page-settings');
    if(!settingsPage) return;
    const bar = document.createElement('div');
    bar.className = 'security-features-bar';
    bar.innerHTML = `
      <div style="width:100%;font-size:13px;font-weight:800;color:rgba(255,255,255,.85);margin-bottom:6px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.1);">
        🔒 ميزات الأمان المتقدمة
      </div>
      <button class="sec-btn sec-btn-2fa" onclick="showAdminUsers2FA()">🔐 إدارة المصادقة الثنائية</button>
      <button class="sec-btn sec-btn-ip"  onclick="showIPSettingsModal()">🌐 تقييد IP</button>
      <button class="sec-btn sec-btn-wg"  onclick="showWidgetsModal()">🧩 تخصيص Widgets</button>
      <button class="sec-btn sec-btn-rep" onclick="showSchedReportModal()">📅 تقارير مجدولة</button>
      <button class="sec-btn sec-btn-vars" onclick="showTemplateVarsHelper()">💡 متغيرات القوالب</button>
    `;
    settingsPage.insertBefore(bar, settingsPage.firstChild);
    // تهيئة الـ Widgets
    renderWidgetsDashboard();
    // بدء الجدولة إن كانت مفعّلة
    scheduleWeeklyCheck();
  });
})();

function showAdminUsers2FA(){
  if(!appState.user || appState.user.role !== 'admin'){ toast('⛔ للمدير فقط','err'); return; }
  const configs = get2FAConfigs();
  const old = document.getElementById('_2faListModal'); if(old) old.remove();
  const div = document.createElement('div');
  div.id = '_2faListModal';
  div.className = 'modal-ov show';
  div.innerHTML = `<div class="modal" style="max-width:500px;">
    <div class="modal-hd"><div class="modal-title">🔐 إدارة المصادقة الثنائية (2FA)</div><button class="modal-close" onclick="document.getElementById('_2faListModal').remove()">✕</button></div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${registeredUsers.map(u=>{
        const has2FA = configs[u.id]?.enabled;
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--b50);border:1px solid var(--border);border-radius:10px;">
          <span style="font-size:18px;">${u.role==='admin'?'👑':'👤'}</span>
          <div class="u-flex1"><div style="font-weight:700;font-size:13px;">${escHtml(u.name)}</div><div style="font-size:11px;color:var(--s500);">@${escHtml(u.user)}</div></div>
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;background:${has2FA?'rgba(16,185,129,.12)':'rgba(239,68,68,.08)'};color:${has2FA?'#059669':'#dc2626'};">${has2FA?'✅ مفعّل':'❌ معطّل'}</span>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('_2faListModal').remove();show2FASetupModal(${u.id})">${has2FA?'⚙️ إعادة ضبط':'➕ تفعيل'}</button>
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-primary btn-full" style="margin-top:14px;" onclick="document.getElementById('_2faListModal').remove()">إغلاق</button>
  </div>`;
  div.addEventListener('click', e=>{ if(e.target===div) div.remove(); });
  document.body.appendChild(div);
}

/*     Regex  handleSearch  */
const _origHandleSearch = handleSearch;
window.handleSearch = async function(page){
  if(page !== undefined) return _origHandleSearch(page);
  const rawQ = document.getElementById('searchInput')?.value.trim() || '';
  if(isRegexSearch(rawQ)){
    const fileIdx = parseInt(document.getElementById('searchFileSelect')?.value??'');
    if(isNaN(fileIdx) || document.getElementById('searchFileSelect')?.value === ''){
      toast('⚠️ اختر ملفاً أولاً','warn'); return;
    }
    let pattern;
    try{ pattern = parseRegexSearch(rawQ); } catch(e){ toast('❌ تعبير نمطي غير صالح: '+e.message,'err'); return; }
    const f = appState.files[fileIdx];
    const rows = regexSearchFile(f, pattern);
    if(!rows.length){ toast(`❌ لم يتم العثور على نتائج للنمط: ${rawQ}`,'err'); return; }
    const cb = document.getElementById('searchCountBanner');
    if(cb){ cb.style.display='flex'; document.getElementById('searchCountText').textContent=`🔍 وُجد ${rows.length} سجل (Regex)`; document.getElementById('searchCountFile').textContent=`في: ${f.name}`; }
    // عرض أول نتيجة
    _searchResults = rows; _searchFileIdx = fileIdx; _searchQuery = rawQ;
    document.getElementById('_pg_search') ; _pg.search = 1;
    toast(`🔍 Regex: ${rows.length} نتيجة`,'info');
    _origHandleSearch(1);
    return;
  }
  return _origHandleSearch(page);
};


/*  INIT  */
document.addEventListener('DOMContentLoaded', async ()=>{
  // ── فرض HTTPS في بيئة الإنتاج ──
  if(location.protocol==='http:' && location.hostname!=='localhost' && location.hostname!=='127.0.0.1'){
    const httpsUrl = 'https://' + location.host + location.pathname + location.search;
    console.warn('🔒 تحويل إلى HTTPS:', httpsUrl);
    location.replace(httpsUrl);
    return;
  }
  _initUsers(); // فك تشفير كلمات المرور من localStorage
  userIdCounter = registeredUsers.reduce((m,u)=>Math.max(m,u.id),2)+1;

  /*        ""  */
  (async function restoreSession(){
    try{
      const rem=JSON.parse(localStorage.getItem('cc_remember')||'null');
      if(!rem||rem.exp<=Date.now()){localStorage.removeItem('cc_remember');return;}
      const regU=registeredUsers.find(x=>x.id===rem.userId);
      if(!regU){localStorage.removeItem('cc_remember');return;}
      if(regU.status==='inactive' && regU.role!=='admin' && regU.id!==1){localStorage.removeItem('cc_remember');return;}

      // ── فحص: هل تم تغيير كلمة المرور أو حُجبت الجلسة؟ ──
      const passChangedKey = 'cc_pass_changed_' + regU.id;
      const blockKey       = 'cc_session_blocked_' + regU.id;
      if(localStorage.getItem(passChangedKey) || localStorage.getItem(blockKey)){
        // تم تغيير كلمة المرور أو حُجبت الجلسة — أبطل الدخول التلقائي
        localStorage.removeItem(passChangedKey);
        localStorage.removeItem('cc_remember');
        localStorage.removeItem(_empKey(regU.id));
        return;
      }

      const fullU=USERS.find(x=>x.id===rem.userId)||{
        id:regU.id, name:regU.name, user:regU.user, pass:regU.pass, role:regU.role,
        avatar:regU.role==='admin'?'👑':'👤',
        color:regU.role==='admin'?'#dc2626':'#d97706'
      };
      // ── فحص جلسة مكررة للموظف (تحديث صفحة مسموح، تبويب/متصفح آخر ممنوع) ──
      if(fullU.role==='subuser'){
        const stored=JSON.parse(localStorage.getItem(_empKey(fullU.id))||'null');
        const myPrevToken=rem.empSid||null; // sid المحفوظ من آخر جلسة لهذا الجهاز
        if(stored && (Date.now()-stored.ts)<SESSION_EXPIRY && stored.sid!==myPrevToken){
          // يوجد جلسة نشطة لجهاز آخر — لا تسمح بالدخول التلقائي
          localStorage.removeItem('cc_remember');
          return;
        }
      }
      const newToken=(typeof crypto!=='undefined'&&crypto.randomUUID
        ?crypto.randomUUID()
        :Math.random().toString(36).slice(2)+Date.now().toString(36))+':'+fullU.id;
      sessionStorage.setItem(SESSION_KEY,newToken);
      rem.token=newToken;
      if(rem.remember) rem.exp=Date.now()+7*24*60*60*1000;
      else rem.exp=Date.now()+24*60*60*1000;
      try{localStorage.setItem('cc_remember',JSON.stringify(rem));}catch(e){}
      appState.user=fullU;
      regU.lastLogin=new Date().toLocaleString('ar-SA');
      saveUsersToLS();
      const ls=document.getElementById('loginScreen');
      const as=document.getElementById('appShell');
      if(ls)ls.style.display='none';
      if(as)as.style.display='flex';
      setupForRole(fullU.role);
      startAutoRefresh();
      _initSessionChannel();
      await _registerSession(fullU.id); // ✅ await: يضمن كتابة cc_sessions قبل sbLoadAudit/sbLoadHistory
      // احفظ الـ sid الجديد في cc_remember لتمييز هذا الجهاز لاحقاً
      if(fullU.role==='subuser'){
        try{
          const r2=JSON.parse(localStorage.getItem('cc_remember')||'{}');
          r2.empSid=_sessionId;
          localStorage.setItem('cc_remember',JSON.stringify(r2));
        }catch(e){}
      }
      // تحميل الملفات بعد تحديد المستخدم — لضمان تطبيق الصلاحيات الصحيحة
      if(typeof isSupabaseReady === 'function' && isSupabaseReady()){
        Promise.all([sbLoadFiles(), sbLoadHistory(), sbLoadAudit(), sbLoadMessages(), sbLoadSettings()]).then(()=>{
          updateAll();
          startRealtimeSync();
        });
      }
      setTimeout(()=>toast(`✅ أهلاً ${fullU.name}! تم الدخول تلقائياً`,'ok'),600);
    }catch(e){localStorage.removeItem('cc_remember');}
  })();
  /*       appState  */
  _initNetworkMonitor();
  _initKeyboardShortcuts();
  ['click','keydown','mousemove','touchstart'].forEach(ev=>document.addEventListener(ev, resetAutoLogout, {passive:true}));

  document.getElementById('footerYear').textContent=new Date().getFullYear();
  const uz=$('uploadZoneMain');
  if(uz){uz.addEventListener('dragover',e=>{e.preventDefault();uz.classList.add('dragover');});uz.addEventListener('dragleave',()=>uz.classList.remove('dragover'));uz.addEventListener('drop',e=>{e.preventDefault();uz.classList.remove('dragover');[...e.dataTransfer.files].forEach(handleFileUpload);});}
  const fi=$('fileInputMain');if(fi)fi.addEventListener('change',e=>{[...e.target.files].forEach(handleFileUpload);e.target.value='';});
  const si=$('searchInput');if(si)si.addEventListener('keydown',e=>{if(e.key==='Enter')handleSearch();});
  const lp=$('loginPass');if(lp)lp.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  const ci=$('clientIdInput');if(ci)ci.addEventListener('keydown',e=>{if(e.key==='Enter')clientSearch();});
  document.querySelectorAll('.modal-ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');}));
  renderUsersTable();
  setTheme(_currentTheme);
});
window.addEventListener('resize',()=>{
  if(window.innerWidth>767) closeSidebar();
  // إعادة رسم المخططات عند تغيير حجم النافذة (مهم عند تدوير الجوال)
  if(document.querySelector('#page-reports.active')) setTimeout(renderReports,150);
});

// كشف انقطاع الاتصال وعودته
window.addEventListener('offline', ()=>{
  toast('⚠️ انقطع الاتصال بالإنترنت — يعمل النظام بشكل محلي فقط', 'warn');
});
window.addEventListener('online', ()=>{
  toast('✅ عاد الاتصال بالإنترنت', 'ok');
});

/*  VISIBILITY GUARD            */
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden || !appState.user) return;
  // فحص أن token الجلسة ما زال صالحاً في sessionStorage
  if(!sessionStorage.getItem(SESSION_KEY)){
    // تحقق أن localStorage لا يزال يحتوي على جلسة صالحة (تجنب إخراج خاطئ)
    const rem=JSON.parse(localStorage.getItem('cc_remember')||'null');
    if(!rem||rem.exp<=Date.now()){
      _directLogout('انتهت جلستك. يرجى تسجيل الدخول مجدداً.');
      return;
    }
    // الجلسة ما زالت صالحة في localStorage — جدّد sessionStorage
    sessionStorage.setItem(SESSION_KEY, rem.token||'restored');
    return;
  }
  // فحص heartbeat — هل الجلسة ما زالت مسجّلة؟
  if(_sessionId){
    const sessions = _getActiveSessions();
    if(!sessions[_sessionId]){
      _handleForcedLogout('تم إنهاء جلستك من جهاز آخر.');
    }
  }
});

/* 
   ADMIN PROFILE     
   SECURITY ALERTS    
 */
const LS_ADMIN_EMAIL = 'cc_admin_alert_email';

/*       */
function loadAdminProfileFields(){
  if(!appState.user || appState.user.role !== 'admin') return;
  const ef=$('adminAlertEmail'), uf=$('adminNewUsername');
  if(ef) ef.value = lsLoad(LS_ADMIN_EMAIL,'');
  if(uf) uf.value = appState.user.user || '';
}

/*    */

/* 
        Reset Users Cache
     "   "    
   :   AES-GCM   
 */
async function resetUsersCache(){
  showConfirm(
    'هل تريد إعادة ضبط بيانات المستخدمين المحلية؟<br><small style="color:var(--s400)">سيتم حذف النسخة المخزّنة وإعادة تشفير البيانات بالمفتاح الحالي.<br>لن تتأثر كلمات المرور التي غيّرتها خلال هذه الجلسة.</small>',
    async () => {
      // 1. احفظ كلمات المرور الحالية من الذاكرة (مفكوكة بالفعل)
      const currentPasses = {};
      registeredUsers.forEach(u => {
        if(u.pass && /^[0-9a-f]{64}$/.test(u.pass)) currentPasses[u.id] = u.pass;
      });

      // 2. احذف النسخة القديمة من localStorage
      try { localStorage.removeItem(LS.users); } catch(e) {}

      // 3. أعد بناء registeredUsers مع كلمات المرور الحالية
      const fresh = _DEFAULT_USERS.map(d => {
        const current = registeredUsers.find(u => u.id === d.id);
        const pass = (current && currentPasses[d.id]) ? currentPasses[d.id] : d.pass;
        return current ? { ...current, pass } : { ...d };
      });
      // أضف المستخدمين الجدد (غير الموجودين في _DEFAULT_USERS)
      registeredUsers.forEach(u => {
        if(!fresh.find(f => f.id === u.id)) fresh.push(u);
      });
      registeredUsers = fresh;

      // 4. أعد الحفظ بالتشفير الصحيح
      saveUsersToLS();

      // 5. حدّث USERS
      USERS = registeredUsers.map(u => ({
        id: u.id, name: u.name, user: u.user, pass: u.pass, role: u.role,
        avatar: u.role === 'admin' ? '👑' : '👤',
        color: u.role === 'admin' ? '#dc2626' : '#d97706'
      }));

      addAudit('settings', 'إعادة ضبط ذاكرة المستخدمين', '');
      toast('✅ تمت إعادة الضبط — يمكن للموظفين تسجيل الدخول الآن', 'ok');
    }
  );
}

async function saveAdminProfile(){
  if(!appState.user || appState.user.role !== 'admin'){
    toast('⛔ هذه الميزة خاصة بمدير النظام فقط','err'); return;
  }
  const curPass   = $('adminCurrentPass').value.trim();
  const newUser   = $('adminNewUsername').value.trim();
  const newPass   = $('adminNewPass').value.trim();
  const conPass   = $('adminConfirmPass').value.trim();
  const alertEmail= $('adminAlertEmail').value.trim();

  if(!curPass){ toast('⚠️ أدخل كلمة المرور الحالية للتحقق من هويتك','warn'); return; }
  const adminReg = registeredUsers.find(u => u.id === appState.user.id);
  if(!adminReg){ toast('❌ حساب المدير غير موجود','err'); return; }
  // التحقق يتم داخل async
  // جلب الهاش الحالي من Supabase للتحقق الصحيح بدل الاعتماد على الذاكرة
  let _storedAdminHash = adminReg.pass;
  try{
    const _sbV = typeof getSB==='function'?getSB():null;
    if(_sbV && isSupabaseReady()){
      const {data:_dbA} = await _sbV.from('cc_users').select('pass').eq('id',adminReg.id).maybeSingle();
      if(_dbA?.pass) _storedAdminHash = _dbA.pass;
    }
  }catch(_ev){}

  // التحقق بـ 4 salt variants مثل _doLoginWithSB
  let hcur = await hashPass(curPass, adminReg.id);
  if(hcur !== _storedAdminHash) hcur = await hashPass(curPass, 1);
  if(hcur !== _storedAdminHash) hcur = await hashPass(curPass, '');
  if(hcur !== _storedAdminHash) hcur = await hashPass(curPass, adminReg.user||'admin');
  if(_storedAdminHash !== hcur){
    toast('❌ كلمة المرور الحالية غير صحيحة','err'); return;
  }
  if(alertEmail) lsSave(LS_ADMIN_EMAIL, alertEmail);
  if(newUser && newUser !== adminReg.user){
    const taken = registeredUsers.find(u => u.user === newUser && u.id !== adminReg.id);
    if(taken){ toast('❌ اسم المستخدم مستخدم بالفعل، اختر اسماً آخر','err'); return; }
    adminReg.user = newUser;
    appState.user.user = newUser;
  }
  if(newPass){
    const pvAdm=validatePassword(newPass); if(pvAdm){ toast('⚠️ '+pvAdm,'warn'); return; }
    if(newPass !== conPass){ toast('❌ كلمة المرور الجديدة وتأكيدها غير متطابقين','err'); return; }
    const hnew = await hashPass(newPass, adminReg.id);
    try{
      const _sb=typeof getSB==='function'?getSB():null;
      if(_sb && typeof isSupabaseReady==='function' && isSupabaseReady()){
        const {error:_pe}=await _sb.from('cc_users').update({pass:hnew}).eq('id',adminReg.id);
        if(_pe){ toast('❌ فشل حفظ كلمة المرور: '+_pe.message,'err'); return; }
      }
    }catch(e){ toast('❌ فشل الاتصال: '+e.message,'err'); return; }
    adminReg.pass = hnew;
    appState.user.pass = hnew;
  }
  saveUsersToLS();
  USERS = registeredUsers.map(u=>({id:u.id,name:u.name,user:u.user,pass:u.pass,role:u.role,
    avatar:u.role==='admin'?'👑':'👤',color:u.role==='admin'?'#dc2626':'#d97706'}));
  $('adminCurrentPass').value=''; $('adminNewPass').value=''; $('adminConfirmPass').value='';
  addAudit('user','✏️ تعديل بيانات حساب المدير', appState.user.name);
  toast('✅ تم حفظ بيانات المدير بنجاح','ok');
}

/*      */
function sendBreachAlertEmail(username, attempts, timestamp){
  const adminEmail = lsLoad(LS_ADMIN_EMAIL,'');
  // عرض البانر المرئي دائماً
  showBreachAlert(username, attempts, adminEmail||'(لم يُضبط بعد)', timestamp);
  // فتح رسالة بريد إلكتروني جاهزة إذا كان البريد مضبوطاً
  if(!adminEmail) return;
  const sub = encodeURIComponent('🚨 تنبيه أمني — محاولة اختراق | Customer Care System v1.0');
  const bod = encodeURIComponent(
    'السادة المحترمون،\n\n' +
    'نُحيطكم علماً بأنه تم رصد محاولة دخول مشبوهة على النظام:\n\n' +
    '┌─────────────────────────────┐\n' +
    '│  المستخدم المستهدف : ' + username  + '\n' +
    '│  عدد المحاولات    : ' + attempts  + '\n' +
    '│  وقت المحاولة     : ' + timestamp + '\n' +
    '└─────────────────────────────┘\n\n' +
    'يُرجى اتخاذ الإجراءات اللازمة فوراً.\n\n' +
    'نظام Customer Care System v1.0 — الحماية الأمنية'
  );
  const a = document.createElement('a');
  a.href = 'mailto:' + adminEmail + '?subject=' + sub + '&body=' + bod;
  a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/*      */
function showBreachAlert(username, attempts, email, timestamp){
  const old = $('breachAlertBanner'); if(old) old.remove();
  const banner = document.createElement('div');
  banner.id = 'breachAlertBanner';
  banner.style.cssText = [
    'position:fixed','top:20px','left:50%','transform:translateX(-50%)',
    'background:linear-gradient(135deg,#450a0a,#7f1d1d)',
    'color:#fff','border-radius:16px','padding:18px 22px',
    'box-shadow:0 10px 40px rgba(220,38,38,.6)',
    'z-index:99999','max-width:500px','width:92%',
    'border:1px solid rgba(255,150,150,.35)',
    'animation:breachSlide .35s cubic-bezier(.34,1.56,.64,1)'
  ].join(';');
  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:14px;">
      <div style="font-size:32px;flex-shrink:0;animation:breachPulse 1s ease infinite;">🚨</div>
      <div class="u-flex1">
        <div style="font-weight:800;font-size:15px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.15);">
          تنبيه أمني — محاولة اختراق مشبوهة!
        </div>
        <div style="font-size:12.5px;line-height:2.1;opacity:.92;">
          👤 المستخدم المستهدف : <b>${esc(String(username??''))}</b><br>
          🔢 المحاولات الفاشلة : <b>${Number(attempts)||0} / 5</b><br>
          🕐 وقت المحاولة      : <b>${esc(String(timestamp??''))}</b><br>
          📧 تم إخطار           : <b>${esc(String(email??''))}</b>
        </div>
      </div>
      <button onclick="document.getElementById('breachAlertBanner').remove()"
        style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);
               color:#fff;border-radius:8px;width:30px;height:30px;cursor:pointer;
               font-size:15px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>`;
  document.body.appendChild(banner);
  setTimeout(()=>{ const b=$('breachAlertBanner'); if(b) b.remove(); }, 15000);
}

/*  CSS    */
(function(){
  const s = document.createElement('style');
  s.textContent = `
    @keyframes breachSlide {
      from { opacity:0; transform:translateX(-50%) translateY(-28px) scale(.95); }
      to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
    }
    @keyframes breachPulse {
      0%,100% { transform:scale(1); }
      50%      { transform:scale(1.18); }
    }
  `;
  document.head.appendChild(s);
})();












// ── دوال مدمجة ──

// ── updateSBStatus: تحديث شارة الاتصال ──
window.updateSBStatus = function() {
  var badge   = document.getElementById('sbStatusBadge');
  var testBtn = document.getElementById('sbTestBtn');
  var eu = document.getElementById('sbUrlInput');
  var ek = document.getElementById('sbKeyInput');
  var url = (eu && eu.value.trim()) ? eu.value.trim() : (window.SUPABASE_URL||'');
  var key = (ek && ek.value.trim()) ? ek.value.trim() : (window.SUPABASE_KEY||'');
  var ok  = !!(url && url!=='YOUR_SUPABASE_URL' && url.startsWith('https://')
           && key && key!=='YOUR_SUPABASE_ANON_KEY' && key.length>20);
  var BASE = 'padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;';
  if(badge) {
    badge.setAttribute('style', BASE + (ok
      ? 'background:rgba(16,185,129,.2);color:#6ee7b7;border:1px solid rgba(16,185,129,.35);'
      : 'background:rgba(239,68,68,.2);color:#fca5a5;border:1px solid rgba(239,68,68,.35);'));
    badge.textContent = ok ? '🟢 متصل' : '⚫ غير متصل';
  }
  if(testBtn){ testBtn.disabled=!ok; testBtn.style.opacity=ok?'1':'0.45'; }
};

// ── saveSBConfig: حفظ دائم ──
window.saveSBConfig = function() {
  var eu=document.getElementById('sbUrlInput'), ek=document.getElementById('sbKeyInput');
  var url=(eu?eu.value:'').trim(), key=(ek?ek.value:'').trim();
  if(!url||!key){ toast('⚠️ يرجى إدخال Supabase URL و Anon Key','warn'); return; }
  if(!url.startsWith('https://')){ toast('⚠️ الرابط يجب أن يبدأ بـ https://','warn'); return; }
  window.SUPABASE_URL=url; window.SUPABASE_KEY=key;
  try{ localStorage.setItem('cc_sb_url',url); localStorage.setItem('cc_sb_key',key); }catch(e){}
  if(eu) eu.value=url; if(ek) ek.value=key;
  window.updateSBStatus();
  _sb=null;
  toast('✅ تم الحفظ — ستُستعاد البيانات تلقائياً عند كل فتح','ok');
  sbInit();
};

// ── testSBConnection: اختبار مع تحديث الشارة ──
window.testSBConnection = async function() {
  var eu=document.getElementById('sbUrlInput'), ek=document.getElementById('sbKeyInput');
  var url=(eu&&eu.value.trim())||window.SUPABASE_URL||'';
  var key=(ek&&ek.value.trim())||window.SUPABASE_KEY||'';
  var badge=document.getElementById('sbStatusBadge');
  var testBtn=document.getElementById('sbTestBtn');
  if(!url||url==='YOUR_SUPABASE_URL'||!key||key==='YOUR_SUPABASE_ANON_KEY'){
    toast('⚠️ أدخل URL و Anon Key أولاً','warn'); return;
  }
  var BASE='padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;';
  if(badge){badge.setAttribute('style',BASE+'background:rgba(245,158,11,.2);color:#fcd34d;border:1px solid rgba(245,158,11,.35);');badge.textContent='🔄 جاري...';}
  if(testBtn){testBtn.disabled=true;testBtn.textContent='⏳';}
  try{
    var res=await fetch(url.replace(/\/+$/,'')+'/rest/v1/cc_users?select=id&limit=1',{
      headers:{'apikey':key,'Authorization':'Bearer '+key}
    });
    if(res.ok||res.status===406){
      if(badge){badge.setAttribute('style',BASE+'background:rgba(16,185,129,.2);color:#6ee7b7;border:1px solid rgba(16,185,129,.35);');badge.textContent='🟢 متصل';}
      toast('✅ الاتصال ناجح!','ok');
      window.SUPABASE_URL=url; window.SUPABASE_KEY=key;
      try{localStorage.setItem('cc_sb_url',url);localStorage.setItem('cc_sb_key',key);}catch(e){}
      if(eu)eu.value=url; if(ek)ek.value=key;
      _sb=null; sbInit();
    } else { throw new Error('HTTP '+res.status); }
  }catch(err){
    if(badge){badge.setAttribute('style',BASE+'background:rgba(239,68,68,.2);color:#fca5a5;border:1px solid rgba(239,68,68,.35);');badge.textContent='🔴 فشل';}
    toast('❌ فشل: '+err.message,'err');
  }finally{
    if(testBtn){testBtn.disabled=false;testBtn.style.opacity='1';testBtn.textContent='🔌 اختبار الاتصال';}
  }
};

// ── تحميل الملف للمدير من شاشة البحث ──
window.checkAdminFileDownload = function() {
  const btn = document.getElementById('adminDownloadFileBtn');
  const sel = document.getElementById('searchFileSelect');
  if (!btn || !sel) return;

  if (appState.user && appState.user.role === 'admin' && sel.value !== '' && sel.value !== 'all') {
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
};

window.downloadSelectedSearchFile = function() {
  const sel = document.getElementById('searchFileSelect');
  if (!sel) return;
  const idx = parseInt(sel.value);
  if (isNaN(idx)) return;

  const f = appState.files[idx];
  if (!f) return;

  // تحويل البيانات إلى CSV
  let csv = '\uFEFF'; // لدعم اللغة العربية
  csv += f.headers.join(',') + '\n';
  f.data.forEach(row => {
    const cleanRow = row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`);
    csv += cleanRow.join(',') + '\n';
  });

  safeExportText(f.name + '.csv', csv, 'text/csv');
  addAudit('export', `تحميل ملف من البحث`, f.name);
};
(function _fixLoginInputs(){
  function _bind(){
    const lu=document.getElementById('loginUser');
    const lp=document.getElementById('loginPass');
    if(lu){ lu.removeAttribute('disabled'); lu.removeAttribute('readonly');
      lu.addEventListener('keydown',function(e){
        if(e.key==='Enter'){ e.preventDefault(); if(typeof doLogin==='function') doLogin(); }
      });
    }
    if(lp){ lp.removeAttribute('disabled'); lp.removeAttribute('readonly');
      lp.addEventListener('keydown',function(e){
        if(e.key==='Enter'){ e.preventDefault(); if(typeof doLogin==='function') doLogin(); }
      });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_bind);
  else _bind();
})();

/* شعار مخصص للموظف في modal التعديل */
function previewEditUserLogo(type,val){
  const emoji=$('editUserLogoPreviewEmoji'),img=$('editUserLogoPreviewImg');
  if(!emoji||!img)return;
  if(type==='url'){
    if(!val){img.style.display='none';emoji.style.display='';return;}
    img.src=val;img.style.display='block';emoji.style.display='none';
    img.onerror=()=>{img.style.display='none';emoji.style.display='';};
  }else if(type==='file'&&val.files&&val.files[0]){
    const reader=new FileReader();
    reader.onload=e=>{
      appState._pendingEditUserLogo=e.target.result;
      if(img){img.src=e.target.result;img.style.display='block';}
      if(emoji)emoji.style.display='none';
      const u=$('editUserLogoUrl');if(u)u.value='';
    };
    reader.readAsDataURL(val.files[0]);
  }
}
function clearEditUserLogo(){
  appState._pendingEditUserLogo=null;
  const emoji=$('editUserLogoPreviewEmoji'),img=$('editUserLogoPreviewImg'),u=$('editUserLogoUrl');
  if(emoji)emoji.style.display='';if(img){img.style.display='none';img.src='';}if(u)u.value='';
}
// إظهار/إخفاء قسم الشعار عند تغيير الدور في نموذج التعديل
(function(){
  const roleEl=$('editRole');
  if(roleEl)roleEl.addEventListener('change',function(){
    const sec=$('editUserLogoSection');if(sec)sec.style.display=this.value==='subuser'?'block':'none';
  });
})();

