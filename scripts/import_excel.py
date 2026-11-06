"""Génère le SQL d'import de la feuille « Journal quotidien » + un rapport JSON.

Usage : python3 scripts/import_excel.py fichier.xlsx <user_id> import.sql rapport.json
Le SQL est transactionnel : un doublon de date (contrainte journees_date_unique) annule tout.
"""
import sys, re, datetime as dt, json
import openpyxl

def lire_journal(chemin):
    ws = openpyxl.load_workbook(chemin, read_only=True, data_only=False)["Journal quotidien"]
    lignes, vides = [], 0
    for row in ws.iter_rows(values_only=True):
        vide = all(v is None or (isinstance(v, str) and v.startswith('=')) for v in row)
        vides = vides + 1 if vide else 0
        if vides > 500:  # le fichier contient des formules recopiées sur 1 048 576 lignes
            break
        lignes.append(row)
    return lignes

f = lire_journal(sys.argv[1]); uid = sys.argv[2]
COLS={2:'ca_14h',3:'ca_cloture',5:'tickets_14h',6:'tickets_cloture',11:'cb_caisse_14h',12:'cb_caisse_cloture',
 14:'cb_tpe_14h',15:'cb_tpe_cloture',18:'especes_caisse_14h',19:'especes_caisse_cloture',21:'especes_comptees_14h',
 22:'especes_comptees_cloture',24:'tr_14h',25:'tr_cloture',27:'autres_paiements',28:'fond_caisse'}
LBL={2:'CA 14h',15:'CB TPE clôture',22:'Espèces comptées clôture'}
rapport={'importees':[], 'rejetees':[], 'corrections':[]}
def q(s): return "'"+s.replace("'","''")+"'"
stmts=[]; seen=set()
for r,row in enumerate(f[1:],2):
    if all(x is None or (isinstance(x,str) and x.startswith('=')) for x in row): continue
    date=row[0]
    if not isinstance(date,dt.datetime): rapport['rejetees'].append({'ligne':r,'raison':'date invalide','valeur':str(date)}); continue
    dj=date.date()
    if dj in seen: rapport['rejetees'].append({'ligne':r,'date':dj.isoformat(),'raison':'date en double'}); continue
    seen.add(dj)
    vals={}; notes=[]
    for i,c in COLS.items():
        x=row[i]
        if isinstance(x,(int,float)): vals[c]=x
        elif isinstance(x,str) and not x.startswith('='):
            if x.strip():
                notes.append(f"{LBL.get(i,c)} : « {x.strip()} »")
                rapport['corrections'].append({'ligne':r,'date':dj.strftime('%d/%m/%Y'),'champ':LBL.get(i,c),'valeur':x.strip(),'action':'laissé vide'})
            else:
                rapport['corrections'].append({'ligne':r,'date':dj.strftime('%d/%m/%Y'),'champ':LBL.get(i,c),'valeur':'(espace)','action':'laissé vide'})
    sorties=[]
    if isinstance(row[29],str) and row[29].strip():
        for part in row[29].split('/'):
            m=re.match(r"\s*(.*?)\s*-\s*(\d+(?:[.,]\d+)?)\s*$", part)
            if not m: raise SystemExit(f"sortie illisible ligne {r}: {part!r}")
            sorties.append((m.group(1), float(m.group(2).replace(',','.'))))
        rapport['corrections'].append({'ligne':r,'date':dj.strftime('%d/%m/%Y'),'champ':'Sorties espèces','valeur':row[29],'action':f'{len(sorties)} sortie(s) créée(s), total {sum(m for _,m in sorties):.2f} €'})
    com=[x for x in [row[31] if isinstance(row[31],str) else None] if x]
    if notes: com.append("Import Excel : " + " ; ".join(notes))
    cols=['user_id','date_jour','source']+list(vals)+(['commentaire'] if com else [])
    v=[q(uid),q(dj.isoformat()),"'import'"]+[repr(round(x,2)) for x in vals.values()]+([q(' | '.join(com))] if com else [])
    s=f"with j as (insert into public.journees ({', '.join(cols)}) values ({', '.join(v)}) returning id)"
    if sorties:
        s+=" insert into public.sorties_especes (journee_id, motif, montant) select j.id, x.motif, x.montant from j, (values "+", ".join(f"({q(a)}, {b})" for a,b in sorties)+") as x(motif, montant)"
    else: s+=" select 1 from j"
    stmts.append(s+";")
    rapport['importees'].append({'ligne':r,'date':dj.strftime('%d/%m/%Y'),'cloture':'connue' if 'ca_cloture' in vals else 'inconnue','ca_cloture':vals.get('ca_cloture')})
cats=["Viennoiseries","Pâtisseries","Pains","Snacking"]
stmts.append("insert into public.categories (user_id, nom, ordre) values "+", ".join(f"({q(uid)}, {q(c)}, {i+1})" for i,c in enumerate(cats))+" on conflict do nothing;")
open(sys.argv[3],'w').write("begin;\n"+"\n".join(stmts)+"\ncommit;\n")
json.dump(rapport, open(sys.argv[4],'w'), ensure_ascii=False, indent=1)
print(len(rapport['importees']),"importées,",len(rapport['rejetees']),"rejetées,",len(rapport['corrections']),"corrections")
