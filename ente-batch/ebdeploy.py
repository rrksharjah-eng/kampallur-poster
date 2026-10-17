import sys,json,gzip,hashlib,subprocess,urllib.request,time
SITE='ente-batch';BASE=sys.argv[1].rstrip('/')+'/';NAMES=sys.argv[2:] or ['index.html']
tok=subprocess.check_output(['gcloud','auth','print-access-token']).decode().strip()
API='https://firebasehosting.googleapis.com/v1beta1/'
def call(method,path,body=None,raw=None,url=None,ct='application/json'):
    data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req=urllib.request.Request(url or API+path,data=data,method=method,headers={'Authorization':'Bearer '+tok,'Content-Type':ct})
    try:
        r=urllib.request.urlopen(req).read();return json.loads(r or b'{}')
    except urllib.error.HTTPError as e:
        print('HTTP',e.code,e.read().decode()[:600]);sys.exit(1)
FILES={}
for n in NAMES:
    parts=n.split('=')[1].split('+') if '=' in n else [n];n=n.split('=')[0]
    b=b''.join(urllib.request.urlopen(BASE+x+'?t='+str(time.time())).read() for x in parts);assert len(b)>1000,n
    if n.endswith('.json'):json.loads(b)
    FILES['/'+n]=b
assert 'ente-batch' in FILES['/index.html'].decode()
rel=call('GET',f'sites/{SITE}/releases?pageSize=1')['releases'][0]
src=rel['version']['name'];print('current',src)
op=call('POST',f'sites/{SITE}/versions:clone',{'sourceVersion':src,'finalize':False})
for i in range(30):
    o=call('GET',op['name'])
    if o.get('done'):break
    time.sleep(2)
ver=o['response']['name'];print('clone',ver)
GZ={};HM={}
for n,b in FILES.items():
    gz=gzip.compress(b,mtime=0);h=hashlib.sha256(gz).hexdigest();GZ[h]=gz;HM[n]=h
p=call('POST',f'{ver}:populateFiles',{'files':HM})
for h in p.get('uploadRequiredHashes',[]):
    call('POST',None,raw=GZ[h],url=p['uploadUrl']+'/'+h,ct='application/octet-stream')
print('files',list(HM))
call('PATCH',f'{ver}?update_mask=status',{'status':'FINALIZED'})
r=call('POST',f'sites/{SITE}/releases?versionName={ver}',{})
print('RELEASED',r.get('name'))
