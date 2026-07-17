const STORAGE_KEY='personal-finance-dashboard-v2';
const LEGACY_KEY='personal-finance-dashboard-v1';
const categories=['Transfer','Market','Yemek','Fatura','Yakıt','Ulaşım','Sağlık','Eğitim','Vergi','Maaş','Freelance','Kira','Eğlence','Konaklama','Uçak','Alışveriş','Diğer'];
const accountNames=['Kurumsal Yapı Kredi','Bireysel Yapı Kredi','Diğer Hesaplar'];
const now=new Date();
const monthKey=d=>(d||'').slice(0,7);
const today=()=>new Date().toISOString().slice(0,10);
const money=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(n)||0);
const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());

const defaultState={
  transactions:[],cards:[],expenseGroups:[],
  budgets:[{id:uid(),name:'Market',limit:5000},{id:uid(),name:'Yemek',limit:4000},{id:uid(),name:'Ulaşım',limit:2500}]
};
let state=load();
let activeMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
let editingGroupId=null;
let draftGroupItems=[];

const els={
  summary:document.querySelector('#summaryGrid'),accounts:document.querySelector('#accounts'),cards:document.querySelector('#creditCards'),
  categories:document.querySelector('#categorySummary'),budgets:document.querySelector('#budgets'),netWorth:document.querySelector('#netWorth'),
  month:document.querySelector('#monthFilter'),search:document.querySelector('#searchInput'),dialog:document.querySelector('#cardDialog'),form:document.querySelector('#cardForm'),
  groups:document.querySelector('#expenseGroups'),groupDialog:document.querySelector('#groupDialog'),groupForm:document.querySelector('#groupForm'),
  groupItems:document.querySelector('#groupItems'),groupTotal:document.querySelector('#groupRunningTotal'),deleteGroupBtn:document.querySelector('#deleteGroupBtn')
};
els.month.value=activeMonth;

function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_KEY)||'{}';
    const parsed=JSON.parse(raw);
    return {...structuredClone(defaultState),...parsed,expenseGroups:Array.isArray(parsed.expenseGroups)?parsed.expenseGroups:[]};
  }catch{return structuredClone(defaultState)}
}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function filteredTransactions(){const q=els.search.value.trim().toLocaleLowerCase('tr');return state.transactions.filter(t=>monthKey(t.date)===activeMonth&&(!q||`${t.title} ${t.category}`.toLocaleLowerCase('tr').includes(q)))}
function totals(){const tx=filteredTransactions();const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);const expense=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);const allBalance=state.transactions.reduce((s,t)=>s+(t.type==='income'?1:-1)*Number(t.amount),0);const debt=state.cards.reduce((s,c)=>s+Number(c.debt),0);return{income,expense,net:income-expense,allBalance,debt,netWorth:allBalance-debt}}
function groupTotal(group){return (group.items||[]).reduce((s,item)=>s+Number(item.amount||0),0)}

function renderSummary(){const t=totals();const monthGroups=state.expenseGroups.filter(g=>groupMatchesMonth(g));const groupSpend=monthGroups.reduce((s,g)=>s+groupTotal(g),0);const cards=[['Bu Ay Gelir',money(t.income),'success','Tüm hesaplar'],['Bu Ay Gider',money(t.expense),'danger','Tüm hesaplar'],['Aylık Net',money(t.net),t.net>=0?'success':'danger','Gelir − gider'],['Grup Harcamaları',money(groupSpend),'danger',`${monthGroups.length} harcama grubu`],['Kart Borcu',money(t.debt),'danger',`${state.cards.length} kart`],['Net Varlık',money(t.netWorth),t.netWorth>=0?'success':'danger','Nakit − borç']];els.summary.innerHTML=cards.map(c=>`<article class="summary-card ${c[2]}"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[3]}</small></article>`).join('');els.netWorth.textContent=money(t.netWorth)}
function groupMatchesMonth(g){if(!g.startDate&&!g.endDate)return true;const start=monthKey(g.startDate||g.endDate);const end=monthKey(g.endDate||g.startDate);return activeMonth>=start&&activeMonth<=end}

function renderGroups(){
  const groups=state.expenseGroups.filter(groupMatchesMonth).sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));
  if(!groups.length){els.groups.innerHTML='<div class="empty">Bu ay için harcama grubu yok. “Harcama grubu” düğmesiyle tatil, etkinlik veya proje klasörü oluşturabilirsin.</div>';return}
  els.groups.innerHTML=groups.map(g=>{
    const items=g.items||[];const total=groupTotal(g);const dateText=g.startDate?`${formatDate(g.startDate)}${g.endDate?' – '+formatDate(g.endDate):''}`:'Tarih belirtilmedi';
    const preview=items.slice(0,3).map(i=>`<span>${escapeHtml(i.title||i.category)} <b>${money(i.amount)}</b></span>`).join('');
    return `<button class="group-card" data-id="${g.id}"><div class="group-card-top"><span class="group-icon">📁</span><div><h3>${escapeHtml(g.name)}</h3><small>${dateText} · ${items.length} kalem</small></div><strong>${money(total)}</strong></div>${g.note?`<p>${escapeHtml(g.note)}</p>`:''}<div class="group-preview">${preview||'<span>Detay eklenmedi</span>'}${items.length>3?`<span class="more">+${items.length-3} kalem</span>`:''}</div><div class="group-open">Detayları aç →</div></button>`
  }).join('');
  document.querySelectorAll('.group-card').forEach(card=>card.onclick=()=>openGroupDialog(card.dataset.id));
}

function openGroupDialog(id=null){
  editingGroupId=id;const group=id?state.expenseGroups.find(g=>g.id===id):null;
  els.groupForm.reset();els.groupForm.elements.groupId.value=id||'';els.groupForm.elements.name.value=group?.name||'';els.groupForm.elements.startDate.value=group?.startDate||'';els.groupForm.elements.endDate.value=group?.endDate||'';els.groupForm.elements.note.value=group?.note||'';
  document.querySelector('#groupDialogTitle').textContent=group?'Harcama grubunu düzenle':'Yeni harcama grubu';
  els.deleteGroupBtn.hidden=!group;draftGroupItems=(group?.items||[]).map(i=>({...i}));ensureBlankGroupItem();renderGroupItems();els.groupDialog.showModal();
}
function blankGroupItem(){return{id:'draft-'+uid(),date:today(),title:'',category:'Diğer',account:'Bireysel Yapı Kredi',amount:''}}
function ensureBlankGroupItem(){if(!draftGroupItems.length||draftGroupItems.at(-1).title||Number(draftGroupItems.at(-1).amount))draftGroupItems.push(blankGroupItem())}
function renderGroupItems(){
  ensureBlankGroupItem();
  els.groupItems.innerHTML=`<div class="group-item-head"><span>Tarih</span><span>Açıklama</span><span>Kategori</span><span>Hesap</span><span>Tutar</span><span></span></div>`+draftGroupItems.map((i,index)=>`<div class="group-item-row" data-index="${index}"><input class="gi-date" type="date" value="${i.date||today()}"><input class="gi-title" placeholder="Harcama açıklaması" value="${escapeHtml(i.title||'')}"><select class="gi-category">${categoryOptions(i.category)}</select><select class="gi-account">${accountNames.map(a=>`<option ${a===i.account?'selected':''}>${a}</option>`).join('')}</select><input class="gi-amount" type="number" min="0" step="0.01" placeholder="0,00" value="${i.amount}"><button type="button" class="icon-btn gi-delete">×</button></div>`).join('');
  bindGroupItems();updateGroupRunningTotal();
}
function bindGroupItems(){document.querySelectorAll('.group-item-row').forEach(row=>{const index=Number(row.dataset.index);row.querySelectorAll('input,select').forEach(input=>input.addEventListener('change',()=>updateDraftItem(row,index)));row.querySelector('.gi-title').addEventListener('input',()=>updateDraftItem(row,index,false));row.querySelector('.gi-amount').addEventListener('input',()=>updateDraftItem(row,index,false));row.querySelector('.gi-delete').onclick=()=>{draftGroupItems.splice(index,1);renderGroupItems()}})}
function updateDraftItem(row,index,rerender=true){draftGroupItems[index]={...draftGroupItems[index],date:row.querySelector('.gi-date').value||today(),title:row.querySelector('.gi-title').value.trim(),category:row.querySelector('.gi-category').value,account:row.querySelector('.gi-account').value,amount:Number(row.querySelector('.gi-amount').value)||''};updateGroupRunningTotal();const isLast=index===draftGroupItems.length-1;if(isLast&&(draftGroupItems[index].title||draftGroupItems[index].amount)&&rerender)renderGroupItems()}
function updateGroupRunningTotal(){els.groupTotal.textContent=money(draftGroupItems.reduce((s,i)=>s+Number(i.amount||0),0))}

function categoryOptions(selected){return categories.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('')}
function blankTransaction(account){return{id:'new-'+account,account,date:today(),title:'',type:'expense',category:'Diğer',amount:''}}
function renderAccounts(){const tx=filteredTransactions();els.accounts.innerHTML=accountNames.map(account=>{const rows=tx.filter(t=>t.account===account);const balance=state.transactions.filter(t=>t.account===account).reduce((s,t)=>s+(t.type==='income'?1:-1)*Number(t.amount),0);const list=[...rows,blankTransaction(account)];return `<article class="account-card"><header class="account-header"><div><h3>${account}</h3><small class="muted">${rows.length} aylık işlem</small></div><div class="account-balance"><small>Güncel bakiye</small><strong>${money(balance)}</strong></div></header><div class="rows"><div class="transaction-head"><span>Tarih</span><span>Açıklama</span><span>Tür</span><span>Kategori</span><span>Tutar</span><span></span></div>${list.map(row=>transactionRow(row)).join('')}</div></article>`}).join('');bindTransactionRows()}
function transactionRow(t){const isNew=t.id.startsWith('new-');return `<div class="transaction-row" data-id="${t.id}" data-account="${t.account}" data-new="${isNew}"><input class="tx-date" type="date" value="${t.date}"><input class="tx-title" placeholder="${isNew?'Yeni işlem ekle...':'İşlem açıklaması'}" value="${escapeHtml(t.title)}"><select class="tx-type"><option value="expense" ${t.type==='expense'?'selected':''}>Gider</option><option value="income" ${t.type==='income'?'selected':''}>Gelir</option></select><select class="tx-category">${categoryOptions(t.category)}</select><input class="tx-amount" type="number" min="0" step="0.01" placeholder="0,00" value="${t.amount}"><button class="delete icon-btn" title="Sil">×</button></div>`}
function bindTransactionRows(){document.querySelectorAll('.transaction-row').forEach(row=>{const fields=row.querySelectorAll('input,select');fields.forEach(el=>el.addEventListener('change',()=>upsertRow(row)));row.querySelector('.tx-title').addEventListener('blur',()=>upsertRow(row));row.querySelector('.delete').addEventListener('click',()=>{if(row.dataset.new==='true')return;state.transactions=state.transactions.filter(t=>t.id!==row.dataset.id);save()})})}
function upsertRow(row){const data={id:row.dataset.new==='true'?uid():row.dataset.id,account:row.dataset.account,date:row.querySelector('.tx-date').value||today(),title:row.querySelector('.tx-title').value.trim(),type:row.querySelector('.tx-type').value,category:row.querySelector('.tx-category').value,amount:Number(row.querySelector('.tx-amount').value)||0};if(!data.title&&!data.amount)return;if(row.dataset.new==='true')state.transactions.push(data);else state.transactions=state.transactions.map(t=>t.id===data.id?data:t);save()}
function renderCards(){if(!state.cards.length){els.cards.innerHTML='<div class="empty">Henüz kredi kartı eklenmedi.</div>';return}els.cards.innerHTML=state.cards.map(c=>{const ratio=c.limit?Math.min(100,(c.debt/c.limit)*100):0;return `<article class="credit-card"><div class="credit-card-head"><div><small>Kredi kartı</small><h3>${escapeHtml(c.name)}</h3></div><button class="icon-btn delete-card" data-id="${c.id}">×</button></div><strong>${money(c.debt)}</strong><small>Güncel borç</small><div class="progress"><i style="width:${ratio}%"></i></div><div class="card-meta"><span>Limit: ${money(c.limit)}</span><span>${c.dueDate?'Son ödeme: '+formatDate(c.dueDate):''}</span></div></article>`}).join('');document.querySelectorAll('.delete-card').forEach(b=>b.onclick=()=>{state.cards=state.cards.filter(c=>c.id!==b.dataset.id);save()})}
function renderCategories(){const expenses=filteredTransactions().filter(t=>t.type==='expense');const sums={};expenses.forEach(t=>sums[t.category]=(sums[t.category]||0)+Number(t.amount));const items=Object.entries(sums).sort((a,b)=>b[1]-a[1]);const total=items.reduce((s,[,v])=>s+v,0);els.categories.innerHTML=items.length?items.map(([name,val])=>`<div class="category-row"><span class="badge">${name}</span><span>${total?Math.round(val/total*100):0}%</span><strong>${money(val)}</strong></div>`).join(''):'<div class="empty">Bu ay için gider kaydı bulunmuyor.</div>'}
function renderBudgets(){const expenses=filteredTransactions().filter(t=>t.type==='expense');els.budgets.innerHTML=state.budgets.length?state.budgets.map(b=>{const spent=expenses.filter(t=>t.category===b.name).reduce((s,t)=>s+Number(t.amount),0);const pct=b.limit?Math.min(100,spent/b.limit*100):0;return `<div class="budget-row" data-id="${b.id}"><input class="budget-name" value="${escapeHtml(b.name)}"><span class="money">${money(spent)}</span><input class="budget-limit" type="number" min="0" value="${b.limit}" title="Bütçe limiti"><div class="budget-bar"><i style="width:${pct}%"></i></div></div>`}).join(''):'<div class="empty">Henüz bütçe kategorisi yok.</div>';document.querySelectorAll('.budget-row').forEach(r=>r.querySelectorAll('input').forEach(i=>i.onchange=()=>{const b=state.budgets.find(x=>x.id===r.dataset.id);b.name=r.querySelector('.budget-name').value.trim()||'Diğer';b.limit=Number(r.querySelector('.budget-limit').value)||0;save()}))}
function renderAll(){renderSummary();renderCards();renderGroups();renderAccounts();renderCategories();renderBudgets()}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatDate(d){return new Intl.DateTimeFormat('tr-TR').format(new Date(d+'T00:00:00'))}

els.month.onchange=e=>{activeMonth=e.target.value;renderAll()};els.search.oninput=renderAll;
document.querySelector('#addCardBtn').onclick=()=>els.dialog.showModal();
els.form.onsubmit=e=>{e.preventDefault();const submitter=e.submitter;if(submitter?.value==='cancel'){els.dialog.close();return}const f=new FormData(els.form);state.cards.push({id:uid(),name:f.get('name'),debt:Number(f.get('debt'))||0,limit:Number(f.get('limit'))||0,dueDate:f.get('dueDate')||''});els.form.reset();els.dialog.close();save()};
document.querySelector('#addGroupBtn').onclick=()=>openGroupDialog();
document.querySelector('#closeGroupDialog').onclick=()=>els.groupDialog.close();document.querySelector('#cancelGroupBtn').onclick=()=>els.groupDialog.close();
els.groupForm.onsubmit=e=>{e.preventDefault();const f=new FormData(els.groupForm);const group={id:editingGroupId||uid(),name:String(f.get('name')).trim(),startDate:f.get('startDate')||'',endDate:f.get('endDate')||'',note:String(f.get('note')||'').trim(),items:draftGroupItems.filter(i=>i.title||Number(i.amount)).map(i=>({...i,id:i.id.startsWith('draft-')?uid():i.id,amount:Number(i.amount)||0}))};if(!group.name)return;if(editingGroupId)state.expenseGroups=state.expenseGroups.map(g=>g.id===editingGroupId?group:g);else state.expenseGroups.push(group);els.groupDialog.close();save()};
els.deleteGroupBtn.onclick=()=>{if(!editingGroupId)return;if(confirm('Bu harcama grubu ve içindeki tüm detaylar silinsin mi?')){state.expenseGroups=state.expenseGroups.filter(g=>g.id!==editingGroupId);els.groupDialog.close();save()}};
document.querySelector('#addBudgetBtn').onclick=()=>{state.budgets.push({id:uid(),name:'Yeni Kategori',limit:0});save()};
document.querySelector('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`finans-yedek-${today()}.json`;a.click();URL.revokeObjectURL(a.href)};
document.querySelector('#importInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.transactions)||!Array.isArray(data.cards))throw new Error();state={...structuredClone(defaultState),...data,expenseGroups:Array.isArray(data.expenseGroups)?data.expenseGroups:[]};save();alert('Veriler başarıyla içe aktarıldı.')}catch{alert('Geçersiz yedek dosyası.')}e.target.value=''};
renderAll();