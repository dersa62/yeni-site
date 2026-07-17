const STORAGE_KEY='personal-finance-dashboard-v1';
const categories=['Transfer','Market','Yemek','Fatura','Yakıt','Ulaşım','Sağlık','Eğitim','Vergi','Maaş','Freelance','Kira','Eğlence','Diğer'];
const accountNames=['Kurumsal Yapı Kredi','Bireysel Yapı Kredi','Diğer Hesaplar'];
const now=new Date();
const monthKey=d=>d.slice(0,7);
const today=()=>new Date().toISOString().slice(0,10);
const money=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(n)||0);
const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());

const defaultState={
  transactions:[],
  cards:[],
  budgets:[
    {id:uid(),name:'Market',limit:5000},
    {id:uid(),name:'Yemek',limit:4000},
    {id:uid(),name:'Ulaşım',limit:2500}
  ]
};
let state=load();
let activeMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

const els={
  summary:document.querySelector('#summaryGrid'),accounts:document.querySelector('#accounts'),cards:document.querySelector('#creditCards'),
  categories:document.querySelector('#categorySummary'),budgets:document.querySelector('#budgets'),netWorth:document.querySelector('#netWorth'),
  month:document.querySelector('#monthFilter'),search:document.querySelector('#searchInput'),dialog:document.querySelector('#cardDialog'),form:document.querySelector('#cardForm')
};
els.month.value=activeMonth;

function load(){try{return {...defaultState,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return structuredClone(defaultState)}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function filteredTransactions(){const q=els.search.value.trim().toLocaleLowerCase('tr');return state.transactions.filter(t=>monthKey(t.date)===activeMonth&&(!q||`${t.title} ${t.category}`.toLocaleLowerCase('tr').includes(q)))}
function totals(){const tx=filteredTransactions();const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);const expense=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);const allBalance=state.transactions.reduce((s,t)=>s+(t.type==='income'?1:-1)*Number(t.amount),0);const debt=state.cards.reduce((s,c)=>s+Number(c.debt),0);return{income,expense,net:income-expense,allBalance,debt,netWorth:allBalance-debt}}

function renderSummary(){const t=totals();const cards=[['Bu Ay Gelir',money(t.income),'success','Tüm hesaplar'],['Bu Ay Gider',money(t.expense),'danger','Tüm hesaplar'],['Aylık Net',money(t.net),t.net>=0?'success':'danger','Gelir − gider'],['Toplam Nakit',money(t.allBalance),'','Tüm zamanlar'],['Kart Borcu',money(t.debt),'danger',`${state.cards.length} kart`],['Net Varlık',money(t.netWorth),t.netWorth>=0?'success':'danger','Nakit − borç']];els.summary.innerHTML=cards.map(c=>`<article class="summary-card ${c[2]}"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[3]}</small></article>`).join('');els.netWorth.textContent=money(t.netWorth)}

function categoryOptions(selected){return categories.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('')}
function blankTransaction(account){return{id:'new-'+account,account,date:today(),title:'',type:'expense',category:'Diğer',amount:''}}
function renderAccounts(){const tx=filteredTransactions();els.accounts.innerHTML=accountNames.map(account=>{const rows=tx.filter(t=>t.account===account);const balance=state.transactions.filter(t=>t.account===account).reduce((s,t)=>s+(t.type==='income'?1:-1)*Number(t.amount),0);const list=[...rows,blankTransaction(account)];return `<article class="account-card"><header class="account-header"><div><h3>${account}</h3><small class="muted">${rows.length} aylık işlem</small></div><div class="account-balance"><small>Güncel bakiye</small><strong>${money(balance)}</strong></div></header><div class="rows"><div class="transaction-head"><span>Tarih</span><span>Açıklama</span><span>Tür</span><span>Kategori</span><span>Tutar</span><span></span></div>${list.map(row=>transactionRow(row)).join('')}</div></article>`}).join('');bindTransactionRows()}
function transactionRow(t){const isNew=t.id.startsWith('new-');return `<div class="transaction-row" data-id="${t.id}" data-account="${t.account}" data-new="${isNew}"><input class="tx-date" type="date" value="${t.date}"><input class="tx-title" placeholder="${isNew?'Yeni işlem ekle...':'İşlem açıklaması'}" value="${escapeHtml(t.title)}"><select class="tx-type"><option value="expense" ${t.type==='expense'?'selected':''}>Gider</option><option value="income" ${t.type==='income'?'selected':''}>Gelir</option></select><select class="tx-category">${categoryOptions(t.category)}</select><input class="tx-amount" type="number" min="0" step="0.01" placeholder="0,00" value="${t.amount}"><button class="delete icon-btn" title="Sil">×</button></div>`}
function bindTransactionRows(){document.querySelectorAll('.transaction-row').forEach(row=>{const fields=row.querySelectorAll('input,select');fields.forEach(el=>el.addEventListener('change',()=>upsertRow(row)));row.querySelector('.tx-title').addEventListener('blur',()=>upsertRow(row));row.querySelector('.delete').addEventListener('click',()=>{if(row.dataset.new==='true')return;state.transactions=state.transactions.filter(t=>t.id!==row.dataset.id);save()})})}
function upsertRow(row){const data={id:row.dataset.new==='true'?uid():row.dataset.id,account:row.dataset.account,date:row.querySelector('.tx-date').value||today(),title:row.querySelector('.tx-title').value.trim(),type:row.querySelector('.tx-type').value,category:row.querySelector('.tx-category').value,amount:Number(row.querySelector('.tx-amount').value)||0};if(!data.title&&!data.amount)return;if(row.dataset.new==='true')state.transactions.push(data);else state.transactions=state.transactions.map(t=>t.id===data.id?data:t);save()}

function renderCards(){if(!state.cards.length){els.cards.innerHTML='<div class="empty">Henüz kredi kartı eklenmedi.</div>';return}els.cards.innerHTML=state.cards.map(c=>{const ratio=c.limit?Math.min(100,(c.debt/c.limit)*100):0;return `<article class="credit-card"><div class="credit-card-head"><div><small>Kredi kartı</small><h3>${escapeHtml(c.name)}</h3></div><button class="icon-btn delete-card" data-id="${c.id}">×</button></div><strong>${money(c.debt)}</strong><small>Güncel borç</small><div class="progress"><i style="width:${ratio}%"></i></div><div class="card-meta"><span>Limit: ${money(c.limit)}</span><span>${c.dueDate?'Son ödeme: '+formatDate(c.dueDate):''}</span></div></article>`}).join('');document.querySelectorAll('.delete-card').forEach(b=>b.onclick=()=>{state.cards=state.cards.filter(c=>c.id!==b.dataset.id);save()})}

function renderCategories(){const expenses=filteredTransactions().filter(t=>t.type==='expense');const sums={};expenses.forEach(t=>sums[t.category]=(sums[t.category]||0)+Number(t.amount));const items=Object.entries(sums).sort((a,b)=>b[1]-a[1]);const total=items.reduce((s,[,v])=>s+v,0);els.categories.innerHTML=items.length?items.map(([name,val])=>`<div class="category-row"><span class="badge">${name}</span><span>${total?Math.round(val/total*100):0}%</span><strong>${money(val)}</strong></div>`).join(''):'<div class="empty">Bu ay için gider kaydı bulunmuyor.</div>'}

function renderBudgets(){const expenses=filteredTransactions().filter(t=>t.type==='expense');els.budgets.innerHTML=state.budgets.length?state.budgets.map(b=>{const spent=expenses.filter(t=>t.category===b.name).reduce((s,t)=>s+Number(t.amount),0);const pct=b.limit?Math.min(100,spent/b.limit*100):0;return `<div class="budget-row" data-id="${b.id}"><input class="budget-name" value="${escapeHtml(b.name)}"><span class="money">${money(spent)}</span><input class="budget-limit" type="number" min="0" value="${b.limit}" title="Bütçe limiti"><div class="budget-bar"><i style="width:${pct}%"></i></div></div>`}).join(''):'<div class="empty">Henüz bütçe kategorisi yok.</div>';document.querySelectorAll('.budget-row').forEach(r=>r.querySelectorAll('input').forEach(i=>i.onchange=()=>{const b=state.budgets.find(x=>x.id===r.dataset.id);b.name=r.querySelector('.budget-name').value.trim()||'Diğer';b.limit=Number(r.querySelector('.budget-limit').value)||0;save()}))}

function renderAll(){renderSummary();renderCards();renderAccounts();renderCategories();renderBudgets()}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatDate(d){return new Intl.DateTimeFormat('tr-TR').format(new Date(d+'T00:00:00'))}

els.month.onchange=e=>{activeMonth=e.target.value;renderAll()};
els.search.oninput=renderAll;
document.querySelector('#addCardBtn').onclick=()=>els.dialog.showModal();
els.form.onsubmit=e=>{e.preventDefault();const submitter=e.submitter;if(submitter?.value==='cancel'){els.dialog.close();return}const f=new FormData(els.form);state.cards.push({id:uid(),name:f.get('name'),debt:Number(f.get('debt'))||0,limit:Number(f.get('limit'))||0,dueDate:f.get('dueDate')||''});els.form.reset();els.dialog.close();save()};
document.querySelector('#addBudgetBtn').onclick=()=>{state.budgets.push({id:uid(),name:'Yeni Kategori',limit:0});save()};
document.querySelector('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`finans-yedek-${today()}.json`;a.click();URL.revokeObjectURL(a.href)};
document.querySelector('#importInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.transactions)||!Array.isArray(data.cards))throw new Error();state={...defaultState,...data};save();alert('Veriler başarıyla içe aktarıldı.')}catch{alert('Geçersiz yedek dosyası.')}e.target.value=''};
renderAll();