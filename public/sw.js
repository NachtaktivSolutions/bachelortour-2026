const CACHE_NAME="firestarter-v25";
const OFFLINE_ROUTES=["/","/program","/packing-list","/tour-tools","/members"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(OFFLINE_ROUTES)).catch(()=>undefined));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response;
    }).catch(async()=>await caches.match(request)||await caches.match("/")||Response.error()));
    return;
  }

  if(url.pathname.startsWith("/_next/static/")||url.pathname.startsWith("/api/branding/")||/\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname)){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response;})));
  }
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()}}
  const timestamp=Number(data.timestamp)||Date.now();
  const tag=data.tag||`firestarter-${timestamp}-${Math.random().toString(36).slice(2,8)}`;
  event.waitUntil(self.registration.showNotification(data.title||"Firestarter 2026",{
    body:data.body||"Es gibt Neuigkeiten.",
    icon:"/api/branding/icon?v=47",
    badge:"/api/branding/icon?v=47",
    image:data.image||undefined,
    tag,
    renotify:true,
    requireInteraction:false,
    timestamp,
    vibrate:[220,90,220],
    silent:false,
    data:{url:data.url||"/"}
  }));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if("focus" in client){client.navigate(event.notification.data.url);return client.focus()}
    }
    return clients.openWindow(event.notification.data.url);
  }));
});
